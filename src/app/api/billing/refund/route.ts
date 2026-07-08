import { NextResponse } from "next/server";
import { env, hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

type LedgerRow = { amount_cents: number; created_at: string; description: string };
type EventRow = { paddle_entity_id: string | null; payload: Record<string, unknown>; processed_at: string };

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getRefundContext();
  if (context.response) return context.response;
  return NextResponse.json({
    eligible: context.eligible,
    reason: context.reason,
    amountCents: context.credit?.amount_cents ?? 0,
  });
}

export async function POST() {
  if (!env.paddleApiKey || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Automatic refunds are not configured." }, { status: 503 });
  }
  const context = await getRefundContext();
  if (context.response) return context.response;
  if (!context.eligible || !context.userId || !context.credit || !context.transactionId) {
    return NextResponse.json({ error: context.reason }, { status: 409 });
  }

  const service = createServiceSupabaseClient();
  const { data: existing } = await service
    .from("billing_refund_requests")
    .select("status")
    .eq("transaction_id", context.transactionId)
    .maybeSingle<{ status: string }>();
  if (existing) return NextResponse.json({ error: "A refund for this payment has already been requested." }, { status: 409 });

  const { data: requestRow, error: requestError } = await service.from("billing_refund_requests").insert({
    user_id: context.userId,
    transaction_id: context.transactionId,
    amount_cents: context.credit.amount_cents,
  }).select("id").single<{ id: string }>();
  if (requestError || !requestRow) return NextResponse.json({ error: requestError?.message ?? "Could not create refund request." }, { status: 500 });

  const apiBase = env.paddleEnvironment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const paddleResponse = await fetch(`${apiBase}/adjustments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.paddleApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "refund",
      type: "full",
      transaction_id: context.transactionId,
      reason: "Unused subscription credits",
    }),
  });
  const paddlePayload = await paddleResponse.json().catch(() => ({})) as {
    data?: { id?: string; status?: string };
    error?: { detail?: string };
  };
  if (!paddleResponse.ok || !paddlePayload.data?.id) {
    const message = paddlePayload.error?.detail ?? "Paddle rejected the refund request.";
    await service.from("billing_refund_requests").update({ status: "failed", failure_message: message }).eq("id", requestRow.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await service
    .from("billing_refund_requests")
    .update({
      status: paddlePayload.data.status === "rejected" ? "rejected" : "submitted",
      paddle_adjustment_id: paddlePayload.data.id,
    })
    .eq("id", requestRow.id);
  return NextResponse.json({
    submitted: true,
    message: "Your full refund was submitted to Paddle. Credits will be removed when Paddle confirms the refund.",
  });
}

async function getRefundContext() {
  if (!hasSupabaseEnv()) return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };

  const { data: credits } = await supabase.from("credit_ledger")
    .select("amount_cents, created_at, description")
    .eq("user_id", user.id)
    .gt("amount_cents", 0)
    .order("created_at", { ascending: false }).limit(20).returns<LedgerRow[]>();
  const credit = (credits ?? []).find((row) =>
    row.description.startsWith("Paddle welcome credits:") ||
    row.description.startsWith("Paddle subscription top-up:"),
  );
  if (!credit) return { userId: user.id, eligible: false, reason: "No refundable subscription payment was found." };

  const { count } = await supabase.from("credit_ledger").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).lt("amount_cents", 0).gt("created_at", credit.created_at);
  if ((count ?? 0) > 0) return { userId: user.id, credit, eligible: false, reason: "Credits have been used since the latest subscription payment, so it is not eligible for an automatic refund." };

  const { data: events } = await supabase.from("billing_webhook_events")
    .select("paddle_entity_id, payload, processed_at").eq("user_id", user.id)
    .eq("event_type", "transaction.completed").order("processed_at", { ascending: false }).returns<EventRow[]>();
  const event = (events ?? []).find((row) => isSubscriptionTransaction(row.payload));
  if (!event?.paddle_entity_id) return { userId: user.id, credit, eligible: false, reason: "The matching Paddle payment could not be found." };
  return { userId: user.id, credit, transactionId: event.paddle_entity_id, eligible: true, reason: "Your latest subscription credits are unused and eligible for a full refund." };
}

function isSubscriptionTransaction(payload: Record<string, unknown>) {
  const data = payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const custom = (data as Record<string, unknown>).custom_data;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return false;
  return ["solo", "creator", "agency", "starter", "plus"].includes(String((custom as Record<string, unknown>).plan_id ?? ""));
}
