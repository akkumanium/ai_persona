import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertValidBillingCatalog, getBillingOptionByPriceId } from "@/lib/billing";
import { env, hasSupabaseEnv } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaddleWebhookEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: Record<string, unknown>;
};

type CheckoutIntentRow = { id: string; user_id: string; option_id: string; price_id: string; expires_at: string; consumed_at: string | null };

export async function POST(request: Request) {
  if (!env.paddleWebhookSecretKey || !hasSupabaseEnv() || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Billing webhook configuration is incomplete." }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");
  if (!signature || !verifyPaddleSignature(signature, rawBody, env.paddleWebhookSecretKey)) {
    return NextResponse.json({ error: "Invalid Paddle signature." }, { status: 401 });
  }
  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Webhook payload is not valid JSON." }, { status: 400 });
  }
  if (!event.event_id || !event.event_type || !event.occurred_at || !event.data || !Number.isFinite(Date.parse(event.occurred_at))) {
    return NextResponse.json({ error: "Webhook payload is missing required fields." }, { status: 400 });
  }

  try {
    assertValidBillingCatalog();
    const service = createServiceSupabaseClient();
    if (event.event_type.startsWith("adjustment.")) {
      const processed = await processAdjustment(service, {
        ...event,
        event_id: event.event_id,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        data: event.data,
      });
      return NextResponse.json({ received: true, processed });
    }
    if (event.event_type !== "transaction.completed" && !event.event_type.startsWith("subscription.")) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const item = getSingleCatalogItem(event.data);
    if (!item) throw new Error("Paddle event must contain exactly one quantity-one catalog item.");
    const option = getBillingOptionByPriceId(item.priceId);
    if (!option) throw new Error("Paddle price is not present in the server catalog.");
    const currency = getString(event.data.currency_code) ?? getNestedString(event.data, "details", "totals", "currency_code");
    if (event.event_type === "transaction.completed" && currency?.toUpperCase() !== "USD") {
      throw new Error("Paddle transaction currency does not match the USD catalog.");
    }

    const subscriptionId = event.event_type.startsWith("subscription.") ? getString(event.data.id) : getString(event.data.subscription_id);
    const intent = await resolveCheckoutIntent(service, event.data, item.priceId, option.id, subscriptionId);
    if (!intent) throw new Error("Paddle event is not associated with a valid server checkout intent.");
    const paidAmount = getMoneyAmount(event.data);
    const { data: processed, error } = await service.rpc("apply_paddle_billing_event_v2", {
      p_event_id: event.event_id,
      p_event_type: event.event_type,
      p_occurred_at: event.occurred_at,
      p_user_id: intent.user_id,
      p_checkout_intent_id: intent.id,
      p_paddle_entity_id: getString(event.data.id) ?? subscriptionId ?? null,
      p_subscription_id: subscriptionId ?? null,
      p_paddle_customer_id: getString(event.data.customer_id) ?? null,
      p_subscription_status: getString(event.data.status) ?? statusFromSubscriptionEvent(event.event_type),
      p_plan_id: option.id,
      p_price_id: item.priceId,
      p_grant_amount_cents: event.event_type === "transaction.completed" ? option.creditCents : 0,
      p_paid_amount_minor: paidAmount,
      p_payload: event,
      p_is_subscription_payment: option.kind === "subscription" && event.event_type === "transaction.completed",
    });
    if (error) throw error;
    return NextResponse.json({ received: true, processed: Boolean(processed) });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", operation: "paddle_webhook", eventId: event.event_id, eventType: event.event_type, message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Failed to process Paddle webhook." }, { status: 500 });
  }
}

async function resolveCheckoutIntent(
  service: SupabaseClient,
  data: Record<string, unknown>,
  priceId: string,
  optionId: string,
  subscriptionId?: string,
) {
  const intentId = getCustomDataValue(data, "checkout_intent_id");
  if (intentId) {
    const { data: intent, error } = await service.from("billing_checkout_intents")
      .select("id, user_id, option_id, price_id, expires_at, consumed_at")
      .eq("id", intentId).maybeSingle<CheckoutIntentRow>();
    if (error || !intent || intent.price_id !== priceId || intent.option_id !== optionId || Date.parse(intent.expires_at) < Date.now()) return undefined;
    return intent;
  }
  if (!subscriptionId) return undefined;
  const { data: subscription } = await service.from("billing_subscriptions")
    .select("user_id, checkout_intent_id").eq("subscription_id", subscriptionId)
    .maybeSingle<{ user_id: string; checkout_intent_id: string | null }>();
  if (!subscription?.checkout_intent_id) return undefined;
  const { data: intent } = await service.from("billing_checkout_intents")
    .select("id, user_id, option_id, price_id, expires_at, consumed_at")
    .eq("id", subscription.checkout_intent_id).maybeSingle<CheckoutIntentRow>();
  return intent?.user_id === subscription.user_id && intent.price_id === priceId && intent.option_id === optionId ? intent : undefined;
}

async function processAdjustment(service: SupabaseClient, event: Required<Pick<PaddleWebhookEvent, "event_id" | "event_type" | "occurred_at" | "data">> & PaddleWebhookEvent) {
  const adjustmentId = getString(event.data.id);
  const transactionId = getString(event.data.transaction_id);
  if (!adjustmentId || !transactionId) throw new Error("Adjustment is missing its ID or transaction ID.");
  const { data, error } = await service.rpc("apply_paddle_adjustment_event", {
    p_event_id: event.event_id,
    p_event_type: event.event_type,
    p_occurred_at: event.occurred_at,
    p_adjustment_id: adjustmentId,
    p_transaction_id: transactionId,
    p_action: getString(event.data.action) ?? "unknown",
    p_adjustment_type: getString(event.data.type) ?? "unknown",
    p_status: getString(event.data.status) ?? "unknown",
    p_adjusted_amount_minor: getMoneyAmount(event.data),
    p_payload: event,
  });
  if (error) throw error;
  return Boolean(data);
}

export function verifyPaddleSignature(signatureHeader: string, rawBody: string, secret: string) {
  const timestamp = signatureHeader.split(";").find((part) => part.startsWith("ts="))?.slice(3);
  const signatures = signatureHeader.split(";").filter((part) => part.startsWith("h1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 5) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex"), "hex");
  return signatures.some((candidate) => {
    if (!/^[a-fA-F0-9]{64}$/.test(candidate)) return false;
    const actual = Buffer.from(candidate, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

function getSingleCatalogItem(data: Record<string, unknown>) {
  if (!Array.isArray(data.items) || data.items.length !== 1) return undefined;
  const item = data.items[0];
  if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
  const record = item as Record<string, unknown>;
  const price = record.price && typeof record.price === "object" && !Array.isArray(record.price) ? record.price as Record<string, unknown> : undefined;
  const priceId = getString(record.price_id) ?? getString(price?.id);
  const quantity = typeof record.quantity === "number" ? record.quantity : Number(record.quantity ?? 1);
  return priceId && quantity === 1 ? { priceId } : undefined;
}

function getMoneyAmount(data: Record<string, unknown>) {
  const value = getNestedString(data, "totals", "total") ?? getNestedString(data, "details", "totals", "total");
  const amount = Number(value ?? 0);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function getNestedString(record: Record<string, unknown>, ...path: string[]) {
  let value: unknown = record;
  for (const key of path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return getString(value);
}

function getCustomDataValue(data: Record<string, unknown>, key: string) {
  const custom = data.custom_data;
  return custom && typeof custom === "object" && !Array.isArray(custom) ? getString((custom as Record<string, unknown>)[key]) : undefined;
}

function statusFromSubscriptionEvent(eventType: string) {
  if (eventType.endsWith(".canceled")) return "canceled";
  if (eventType.endsWith(".paused")) return "paused";
  if (eventType.endsWith(".past_due")) return "past_due";
  if (eventType.endsWith(".trialing")) return "trialing";
  return "active";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
