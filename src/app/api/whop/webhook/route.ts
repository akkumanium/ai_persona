import { NextResponse } from "next/server";
import { env, hasSupabaseEnv } from "@/lib/env";
import { normalizeWhopEvent, processStoredWhopEvent } from "@/lib/server/whop-billing-events";
import { getWhopClient } from "@/lib/server/whop";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.whopApiKey || !env.whopWebhookSecret || !env.whopCompanyId || !hasSupabaseEnv() || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Billing webhook configuration is incomplete." }, { status: 503 });
  }
  const rawBody = await request.text();
  let event;
  try {
    const headers = Object.fromEntries(request.headers.entries());
    event = normalizeWhopEvent(getWhopClient().webhooks.unwrap(rawBody, { headers }));
  } catch {
    return NextResponse.json({ error: "Invalid Whop webhook signature or payload." }, { status: 401 });
  }
  if (event.companyId !== env.whopCompanyId) return NextResponse.json({ error: "Whop company does not match." }, { status: 403 });

  const service = createServiceSupabaseClient();
  const { error: insertError } = await service.from("billing_webhook_events").insert({
    event_id: event.eventId, event_type: event.eventType, provider: "whop", provider_entity_id: event.entityId ?? null,
    payload: event.payload, occurred_at: event.occurredAt, processing_status: "pending", attempts: 0,
  });
  if (insertError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (insertError) {
    console.error(JSON.stringify({ level: "error", operation: "whop_webhook_store", eventId: event.eventId, message: insertError.message }));
    return NextResponse.json({ error: "Could not persist billing event." }, { status: 500 });
  }

  try {
    const processed = await processStoredWhopEvent(service, event);
    await service.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), attempts: 1, error_message: null }).eq("event_id", event.eventId);
    return NextResponse.json({ received: true, processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing event processing failed";
    await service.from("billing_webhook_events").update({ processing_status: "failed", attempts: 1, error_message: message.slice(0, 1000), next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq("event_id", event.eventId);
    console.error(JSON.stringify({ level: "error", operation: "whop_webhook_process", eventId: event.eventId, eventType: event.eventType, message }));
    return NextResponse.json({ received: true, queuedForRetry: true }, { status: 202 });
  }
}
