import { NextResponse } from "next/server";
import { getBillingOptionByPriceId } from "@/lib/billing";
import { env } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!env.paddleApiKey || !env.supabaseServiceRoleKey) return NextResponse.json({ error: "Billing reconciliation is not configured." }, { status: 503 });
  const service = createServiceSupabaseClient();
  const cancellations = await processCancellationOutbox(service, apiBaseForEnvironment());
  const { data: subscriptions, error } = await service.from("billing_subscriptions").select("subscription_id,user_id,status,last_event_occurred_at").order("updated_at", { ascending: true }).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const apiBase = apiBaseForEnvironment();
  const outcomes = await Promise.allSettled((subscriptions ?? []).map(async (local) => {
    const response = await fetch(`${apiBase}/subscriptions/${encodeURIComponent(local.subscription_id)}`, {
      headers: { Authorization: `Bearer ${env.paddleApiKey}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Paddle subscription lookup failed (${response.status}).`);
    const payload = await response.json() as { data?: Record<string, unknown> };
    const data = payload.data;
    if (!data) throw new Error("Paddle subscription response is empty.");
    const items = Array.isArray(data.items) ? data.items : [];
    const first = items[0] && typeof items[0] === "object" ? items[0] as Record<string, unknown> : undefined;
    const price = first?.price && typeof first.price === "object" ? first.price as Record<string, unknown> : undefined;
    const priceId = typeof price?.id === "string" ? price.id : undefined;
    const option = getBillingOptionByPriceId(priceId);
    if (!option || option.kind !== "subscription") throw new Error("Paddle subscription uses an unknown price.");
    const paddleStatus = typeof data.status === "string" ? data.status : "canceled";
    const status = ["refunded", "disputed"].includes(local.status) && ["active", "trialing"].includes(paddleStatus) ? local.status : paddleStatus;
    const { error: updateError } = await service.from("billing_subscriptions").update({
      status, plan_id: option.id, price_id: priceId, paddle_customer_id: typeof data.customer_id === "string" ? data.customer_id : null,
      scheduled_change: data.scheduled_change ?? null, current_period_starts_at: nestedDate(data, "current_billing_period", "starts_at"),
      current_period_ends_at: nestedDate(data, "current_billing_period", "ends_at"), updated_at: new Date().toISOString(),
    }).eq("subscription_id", local.subscription_id);
    if (updateError) throw updateError;
    return local.subscription_id;
  }));
  return NextResponse.json({ cancellations, checked: outcomes.length, reconciled: outcomes.filter((result) => result.status === "fulfilled").length, failed: outcomes.filter((result) => result.status === "rejected").length });
}

async function processCancellationOutbox(service: ReturnType<typeof createServiceSupabaseClient>, apiBase: string) {
  const { data: operations } = await service.from("billing_operations_outbox").select("id,subscription_id,attempts").eq("status", "pending").order("created_at").limit(5);
  let completed = 0;
  for (const operation of operations ?? []) {
    const { data: claimed } = await service.from("billing_operations_outbox").update({ status: "processing", attempts: operation.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", operation.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const response = await fetch(`${apiBase}/subscriptions/${encodeURIComponent(operation.subscription_id)}/cancel`, {
        method: "POST", headers: { Authorization: `Bearer ${env.paddleApiKey!}`, "Content-Type": "application/json" },
        body: JSON.stringify({ effective_from: "immediately" }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Paddle cancellation failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
      await service.from("billing_operations_outbox").update({ status: "completed", last_error: null, updated_at: new Date().toISOString() }).eq("id", operation.id);
      completed += 1;
    } catch (error) {
      await service.from("billing_operations_outbox").update({ status: "pending", last_error: error instanceof Error ? error.message : "Cancellation failed", updated_at: new Date().toISOString() }).eq("id", operation.id);
    }
  }
  return { checked: operations?.length ?? 0, completed };
}

function apiBaseForEnvironment() {
  return env.paddleEnvironment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function nestedDate(record: Record<string, unknown>, objectKey: string, valueKey: string) {
  const nested = record[objectKey];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
  const value = (nested as Record<string, unknown>)[valueKey];
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}
