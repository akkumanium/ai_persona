import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingOptionById, getBillingOptionByPriceId } from "@/lib/billing";
import { env, hasSupabaseEnv } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaddleWebhookEvent = {
  event_id?: string;
  event_type?: string;
  data?: Record<string, unknown>;
};

type BillingEventDetails = {
  userId?: string;
  planId?: string;
  priceId?: string;
  amountCents: number;
  isSubscriptionPayment: boolean;
  subscriptionId?: string;
  customerId?: string;
  subscriptionStatus: string;
  entityId?: string;
};

export async function POST(request: Request) {
  if (!env.paddleWebhookSecretKey) {
    return NextResponse.json({ error: "Paddle webhook secret is not configured." }, { status: 500 });
  }
  if (!hasSupabaseEnv() || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("paddle-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Paddle signature." }, { status: 400 });
  }
  if (!verifyPaddleSignature(signature, rawBody, env.paddleWebhookSecretKey)) {
    return NextResponse.json({ error: "Invalid Paddle signature." }, { status: 401 });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Webhook payload is not valid JSON." }, { status: 400 });
  }

  const eventId = event.event_id;
  const eventType = event.event_type;
  if (!eventId || !eventType || !event.data) {
    return NextResponse.json({ error: "Webhook payload is missing required fields." }, { status: 400 });
  }

  const details = getBillingEventDetails(eventType, event.data);
  const supabase = createServiceSupabaseClient();

  if (eventType.startsWith("adjustment.")) {
    const processed = await processRefundAdjustmentEvent(supabase, eventId, eventType, event.data, event);
    return NextResponse.json({ received: true, processed });
  }

  if (!details.userId || !details.planId || !details.priceId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const { data, error } = await supabase.rpc("apply_paddle_billing_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_user_id: details.userId,
    p_paddle_entity_id: details.entityId ?? null,
    p_subscription_id: details.subscriptionId ?? null,
    p_paddle_customer_id: details.customerId ?? null,
    p_subscription_status: details.subscriptionStatus,
    p_plan_id: details.planId,
    p_price_id: details.priceId,
    p_amount_cents: details.amountCents,
    p_payload: event,
    p_is_subscription_payment: details.isSubscriptionPayment,
  });

  if (error) {
    console.error("Failed to apply Paddle billing event", error);
    return NextResponse.json({ error: "Failed to process Paddle webhook." }, { status: 500 });
  }

  return NextResponse.json({ received: true, processed: Boolean(data) });
}

async function processRefundAdjustmentEvent(
  supabase: SupabaseClient,
  eventId: string,
  eventType: string,
  data: Record<string, unknown>,
  payload: PaddleWebhookEvent,
) {
  const adjustmentId = getString(data.id);
  if (!adjustmentId) return false;

  const { data: requestRow } = await supabase
    .from("billing_refund_requests")
    .select("id, user_id, amount_cents, status")
    .eq("paddle_adjustment_id", adjustmentId)
    .maybeSingle<{ id: string; user_id: string; amount_cents: number; status: string }>();

  const { error: eventError } = await supabase.from("billing_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    user_id: requestRow?.user_id ?? null,
    paddle_entity_id: adjustmentId,
    payload,
  });
  if (eventError) {
    if (eventError.code === "23505") return false;
    throw eventError;
  }

  if (!requestRow) return true;

  const status = getString(data.status)?.toLowerCase() ?? "unknown";
  if (["rejected", "failed", "canceled", "cancelled"].includes(status)) {
    await supabase
      .from("billing_refund_requests")
      .update({ status: "rejected", failure_message: `Paddle adjustment ${status}.` })
      .eq("id", requestRow.id)
      .neq("status", "approved");
    return true;
  }

  if (!["approved", "complete", "completed"].includes(status) || requestRow.status === "approved") {
    await supabase
      .from("billing_refund_requests")
      .update({ status: "submitted" })
      .eq("id", requestRow.id)
      .in("status", ["pending", "submitted"]);
    return true;
  }

  const { data: profile } = await supabase
    .from("account_profiles")
    .select("credit_balance_cents")
    .eq("user_id", requestRow.user_id)
    .single<{ credit_balance_cents: number | null }>();
  const nextBalance = Math.max(0, (profile?.credit_balance_cents ?? 0) - requestRow.amount_cents);
  await Promise.all([
    supabase
      .from("account_profiles")
      .update({ credit_balance_cents: nextBalance })
      .eq("user_id", requestRow.user_id),
    supabase.from("credit_ledger").insert({
      user_id: requestRow.user_id,
      amount_cents: -requestRow.amount_cents,
      description: `Paddle refund credit reversal: ${adjustmentId}`,
    }),
    supabase
      .from("billing_refund_requests")
      .update({ status: "approved" })
      .eq("id", requestRow.id),
  ]);

  return true;
}

function verifyPaddleSignature(signatureHeader: string, rawBody: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader
      .split(";")
      .map((part) => part.split("="))
      .filter((part): part is [string, string] => part.length === 2),
  );
  const timestamp = parts.ts;
  const signatures = signatureHeader
    .split(";")
    .filter((part) => part.startsWith("h1="))
    .map((part) => part.slice(3));

  if (!timestamp || !signatures.length) return false;

  const eventTime = Number(timestamp);
  if (!Number.isFinite(eventTime)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - eventTime);
  if (ageSeconds > 5) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "hex");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function getBillingEventDetails(eventType: string, data: Record<string, unknown>): BillingEventDetails {
  if (eventType === "transaction.completed") {
    const priceId = findPriceId(data);
    const plan = getBillingOptionById(getCustomDataValue(data, "plan_id")) ?? getBillingOptionByPriceId(priceId);
    return {
      userId: getCustomDataValue(data, "app_user_id"),
      planId: plan?.id,
      priceId: plan?.priceId,
      amountCents: plan?.creditCents ?? 0,
      isSubscriptionPayment: plan?.kind === "subscription",
      subscriptionId: getString(data.subscription_id),
      customerId: getString(data.customer_id),
      subscriptionStatus: plan?.kind === "topup" ? "top_up" : "active",
      entityId: getString(data.id),
    };
  }

  if (eventType.startsWith("subscription.")) {
    const priceId = findPriceId(data);
    const plan = getBillingOptionById(getCustomDataValue(data, "plan_id")) ?? getBillingOptionByPriceId(priceId);
    return {
      userId: getCustomDataValue(data, "app_user_id"),
      planId: plan?.id,
      priceId: plan?.priceId,
      amountCents: 0,
      isSubscriptionPayment: false,
      subscriptionId: getString(data.id),
      customerId: getString(data.customer_id),
      subscriptionStatus: getString(data.status) ?? statusFromSubscriptionEvent(eventType),
      entityId: getString(data.id),
    };
  }

  return { amountCents: 0, isSubscriptionPayment: false, subscriptionStatus: "unknown" };
}

function statusFromSubscriptionEvent(eventType: string) {
  if (eventType.endsWith(".canceled")) return "canceled";
  if (eventType.endsWith(".paused")) return "paused";
  if (eventType.endsWith(".past_due")) return "past_due";
  if (eventType.endsWith(".trialing")) return "trialing";
  return "active";
}

function getCustomDataValue(data: Record<string, unknown>, key: string) {
  const customData = data.custom_data;
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return undefined;
  return getString((customData as Record<string, unknown>)[key]);
}

function findPriceId(data: Record<string, unknown>) {
  const items = data.items;
  if (!Array.isArray(items)) return undefined;

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const itemRecord = item as Record<string, unknown>;
    const directPriceId = getString(itemRecord.price_id);
    if (directPriceId) return directPriceId;
    const price = itemRecord.price;
    if (price && typeof price === "object" && !Array.isArray(price)) {
      const nestedPriceId = getString((price as Record<string, unknown>).id);
      if (nestedPriceId) return nestedPriceId;
    }
  }

  return undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
