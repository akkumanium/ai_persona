import { NextResponse } from "next/server";
import { env, hasSupabaseEnv } from "@/lib/env";
import { rateLimitRequest } from "@/lib/server/request-security";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimitRequest(request, { key: "billing-refund", limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const context = await getRefundContext();
  if (context.response) return context.response;
  return NextResponse.json({ eligible: context.eligible, reason: context.reason, amountCents: context.amountCents ?? 0 });
}

export async function POST(request: Request) {
  const limited = await rateLimitRequest(request, { key: "billing-refund-submit", limit: 3, windowMs: 60 * 60_000 });
  if (limited) return limited;
  if (!env.paddleApiKey || !env.supabaseServiceRoleKey) return NextResponse.json({ error: "Automatic refunds are not configured." }, { status: 503 });
  const context = await getRefundContext();
  if (context.response) return context.response;
  if (!context.eligible || !context.userId || !context.transactionId) return NextResponse.json({ error: context.reason }, { status: 409 });
  const service = createServiceSupabaseClient();
  const { data: requestId, error: reserveError } = await service.rpc("create_refund_request_and_reserve", {
    p_user_id: context.userId,
    p_transaction_id: context.transactionId,
  });
  if (reserveError || !requestId) return NextResponse.json({ error: reserveError?.message ?? "Could not reserve refundable credits." }, { status: 409 });

  const apiBase = env.paddleEnvironment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  try {
    const paddleResponse = await fetch(`${apiBase}/adjustments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.paddleApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refund", type: "full", transaction_id: context.transactionId, reason: "Unused subscription credits" }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await paddleResponse.json().catch(() => ({})) as { data?: { id?: string; status?: string }; error?: { detail?: string } };
    if (!paddleResponse.ok || !payload.data?.id) throw new Error(payload.error?.detail ?? "Paddle rejected the refund request.");
    const status = payload.data.status === "rejected" ? "rejected" : "submitted";
    if (status === "rejected") {
      await service.rpc("release_refund_reservation", { p_request_id: requestId, p_failure_message: "Paddle rejected the refund request." });
      return NextResponse.json({ error: "Paddle rejected the refund request." }, { status: 502 });
    }
    const { error } = await service.from("billing_refund_requests").update({ status, paddle_adjustment_id: payload.data.id }).eq("id", requestId);
    if (error) throw error;
    return NextResponse.json({ submitted: true, message: "Refund submitted. The related credits are frozen until Paddle confirms the adjustment." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund submission failed.";
    await service.rpc("release_refund_reservation", { p_request_id: requestId, p_failure_message: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function getRefundContext() {
  if (!hasSupabaseEnv()) return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  const { data: payment, error } = await supabase.from("billing_payments")
    .select("transaction_id, granted_credit_cents, reversed_credit_cents, subscription_id")
    .eq("user_id", user.id).not("subscription_id", "is", null).order("occurred_at", { ascending: false }).limit(1)
    .maybeSingle<{ transaction_id: string; granted_credit_cents: number; reversed_credit_cents: number; subscription_id: string | null }>();
  if (error) return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!payment || payment.granted_credit_cents <= payment.reversed_credit_cents) return { userId: user.id, eligible: false, reason: "No refundable subscription payment was found." };
  const { data: profile } = await supabase.from("account_profiles").select("credit_balance_cents").eq("user_id", user.id).single<{ credit_balance_cents: number }>();
  const amountCents = payment.granted_credit_cents - payment.reversed_credit_cents;
  const eligible = (profile?.credit_balance_cents ?? 0) >= amountCents;
  return { userId: user.id, transactionId: payment.transaction_id, amountCents, eligible, reason: eligible ? "Unused subscription credits are eligible for a full refund." : "Refundable credits have already been used." };
}
