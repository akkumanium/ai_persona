import { NextResponse } from "next/server";
import { getBillingOptionByProviderPlanId, mapWhopMembershipStatus } from "@/lib/billing";
import { env } from "@/lib/env";
import { processStoredWhopEvent, type NormalizedWhopEvent } from "@/lib/server/whop-billing-events";
import { getWhopClient } from "@/lib/server/whop";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type InboxRow = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  provider_entity_id: string | null;
  payload: Record<string, unknown>;
};

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.whopApiKey || !env.whopCompanyId || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Billing reconciliation is not configured." }, { status: 503 });
  }

  const service = createServiceSupabaseClient();
  const inbox = await retryInbox(service);
  const outbox = await retryOutbox(service);
  const memberships = await refreshMemberships(service);
  await service.from("billing_checkout_intents").update({ status: "expired" })
    .eq("provider", "whop").eq("status", "pending").lt("expires_at", new Date().toISOString());

  const counts = {
    processed: inbox.processed,
    retried: inbox.claimed + outbox.claimed,
    failed: inbox.failed + outbox.failed + memberships.failed,
    repaired: memberships.repaired,
  };
  console.info("billing.reconciliation.completed", counts);
  return NextResponse.json({ ...counts, inbox, outbox, memberships });
}

async function retryInbox(service: ReturnType<typeof createServiceSupabaseClient>) {
  const { data, error } = await service.rpc("claim_whop_billing_events", { p_limit: 25 });
  if (error) throw error;
  const rows = (data ?? []) as InboxRow[];
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const event: NormalizedWhopEvent = {
        eventId: row.event_id,
        eventType: row.event_type,
        occurredAt: row.occurred_at,
        entityId: row.provider_entity_id ?? undefined,
        companyId: env.whopCompanyId,
        payload: row.payload ?? {},
      };
      await processStoredWhopEvent(service, event);
      await service.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), error_message: null, next_attempt_at: null }).eq("event_id", row.event_id);
      processed += 1;
    } catch (cause) {
      failed += 1;
      await service.from("billing_webhook_events").update({
        processing_status: "failed",
        error_message: messageOf(cause),
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      }).eq("event_id", row.event_id);
    }
  }
  return { claimed: rows.length, processed, failed };
}

async function retryOutbox(service: ReturnType<typeof createServiceSupabaseClient>) {
  const now = new Date().toISOString();
  const { data: operations, error } = await service.from("billing_operations_outbox")
    .select("id,subscription_id,attempts").eq("status", "pending").or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at").limit(10);
  if (error) throw error;
  let completed = 0;
  let failed = 0;
  for (const operation of operations ?? []) {
    const { data: claimed } = await service.from("billing_operations_outbox")
      .update({ status: "processing", attempts: operation.attempts + 1, updated_at: now })
      .eq("id", operation.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      await getWhopClient().memberships.cancel(operation.subscription_id, { cancellation_mode: "immediate" });
      await service.from("billing_operations_outbox").update({ status: "completed", last_error: null, next_attempt_at: null, updated_at: new Date().toISOString() }).eq("id", operation.id);
      completed += 1;
    } catch (cause) {
      failed += 1;
      const delayMinutes = Math.min(60, 2 ** Math.min(operation.attempts + 1, 6));
      await service.from("billing_operations_outbox").update({
        status: "pending", last_error: messageOf(cause),
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", operation.id);
    }
  }
  return { claimed: operations?.length ?? 0, completed, failed };
}

async function refreshMemberships(service: ReturnType<typeof createServiceSupabaseClient>) {
  const { data: subscriptions, error } = await service.from("billing_subscriptions")
    .select("subscription_id,status,provider_updated_at").eq("provider", "whop")
    .order("updated_at", { ascending: true }).limit(25);
  if (error) throw error;
  let repaired = 0;
  let failed = 0;
  for (const local of subscriptions ?? []) {
    try {
      const membership = await getWhopClient().memberships.retrieve(local.subscription_id);
      if (membership.company.id !== env.whopCompanyId) throw new Error("Whop membership belongs to another company.");
      const option = getBillingOptionByProviderPlanId(membership.plan.id);
      if (!option || option.kind !== "subscription") throw new Error("Whop membership references an unknown subscription plan.");
      if (local.provider_updated_at && Date.parse(local.provider_updated_at) > Date.parse(membership.updated_at)) continue;
      const providerStatus = mapWhopMembershipStatus(membership.status, membership.cancel_at_period_end);
      const status = ["refunded", "disputed"].includes(local.status) && ["active", "trialing", "canceling"].includes(providerStatus)
        ? local.status : providerStatus;
      const { error: updateError } = await service.from("billing_subscriptions").update({
        status,
        plan_id: option.id,
        provider_plan_id: membership.plan.id,
        provider_user_id: membership.user?.id ?? null,
        provider_member_id: membership.member?.id ?? null,
        manage_url: membership.manage_url,
        cancel_at_period_end: membership.cancel_at_period_end,
        current_period_starts_at: membership.renewal_period_start,
        current_period_ends_at: membership.renewal_period_end,
        provider_updated_at: membership.updated_at,
        updated_at: new Date().toISOString(),
      }).eq("subscription_id", local.subscription_id).eq("provider", "whop");
      if (updateError) throw updateError;
      repaired += 1;
    } catch (cause) {
      failed += 1;
      console.error("billing.reconciliation.membership_failed", { membershipId: local.subscription_id, error: messageOf(cause) });
    }
  }
  return { checked: subscriptions?.length ?? 0, repaired, failed };
}

function messageOf(cause: unknown) {
  return cause instanceof Error ? cause.message.slice(0, 500) : "Unknown billing reconciliation failure";
}
