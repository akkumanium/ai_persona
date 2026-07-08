import type { SupabaseClient } from "@supabase/supabase-js";
import { getPersonaLimitForPlan, getPlanById, type BillingPlanId } from "@/lib/billing";
import { env } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type AccountProfileRow = {
  credit_balance_cents: number | null;
  account_metadata?: Record<string, unknown> | null;
};

type BillingSubscriptionRow = {
  subscription_id: string | null;
  status: string | null;
  plan_id: string | null;
};

export type BillingAccess = {
  balanceCents: number;
  hasActiveSubscription: boolean;
  hasStudioAccess: boolean;
  activePlanId?: BillingPlanId;
  personaLimit: number | null;
};

export async function getBillingAccess(supabase: SupabaseClient, userId: string): Promise<BillingAccess> {
  const billingSupabase = env.supabaseServiceRoleKey ? createServiceSupabaseClient() : supabase;
  const [profile, subscriptions] = await Promise.all([
    billingSupabase
      .from("account_profiles")
      .select("credit_balance_cents, account_metadata")
      .eq("user_id", userId)
      .maybeSingle<AccountProfileRow>(),
    billingSupabase
      .from("billing_subscriptions")
      .select("subscription_id, status, plan_id")
      .eq("user_id", userId)
      .returns<BillingSubscriptionRow[]>(),
  ]);

  if (profile.error) throw new Error(`Could not load billing profile: ${profile.error.message}`);
  if (subscriptions.error) throw new Error(`Could not load billing subscriptions: ${subscriptions.error.message}`);

  const balanceCents = Math.max(0, profile.data?.credit_balance_cents ?? 0);
  const metadataSubscription = getMetadataSubscription(profile.data?.account_metadata);
  const subscriptionRows = subscriptions.data ?? [];
  const activeSubscriptionRows = subscriptionRows.filter((row) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(row.status ?? ""),
  );
  const metadataRow = metadataSubscription.subscriptionId
    ? subscriptionRows.find((row) => row.subscription_id === metadataSubscription.subscriptionId)
    : undefined;
  const hasActiveMetadataSubscription =
    ACTIVE_SUBSCRIPTION_STATUSES.has(metadataSubscription.status) &&
    Boolean(metadataRow && ACTIVE_SUBSCRIPTION_STATUSES.has(metadataRow.status ?? ""));
  const activePlanId = resolveActivePlanId(
    activeSubscriptionRows,
    hasActiveMetadataSubscription ? metadataSubscription.planId : undefined,
  );
  const hasActiveSubscription =
    Boolean(activeSubscriptionRows.length) || hasActiveMetadataSubscription;

  return {
    balanceCents,
    hasActiveSubscription,
    // Authentication gates Studio. A subscription only controls generation credits.
    hasStudioAccess: true,
    activePlanId,
    personaLimit: activePlanId ? getPersonaLimitForPlan(activePlanId) : 0,
  };
}

function getMetadataSubscription(metadata?: Record<string, unknown> | null) {
  const paddle = metadata?.paddle;
  if (!paddle || typeof paddle !== "object" || Array.isArray(paddle)) return { status: "", planId: undefined };
  const status = (paddle as { subscriptionStatus?: unknown }).subscriptionStatus;
  const planId = (paddle as { planId?: unknown }).planId;
  const subscriptionId = (paddle as { subscriptionId?: unknown }).subscriptionId;
  return {
    status: typeof status === "string" ? status : "",
    planId: typeof planId === "string" ? planId : undefined,
    subscriptionId: typeof subscriptionId === "string" ? subscriptionId : undefined,
  };
}

function resolveActivePlanId(rows: BillingSubscriptionRow[], fallbackPlanId?: string) {
  const candidates = rows
    .map((row) => getPlanById(row.plan_id))
    .filter((plan) => plan !== undefined);
  const fallback = getPlanById(fallbackPlanId);
  if (fallback) candidates.push(fallback);

  return candidates.sort((left, right) => scorePlan(right.id) - scorePlan(left.id))[0]?.id;
}

function scorePlan(planId: BillingPlanId) {
  const limit = getPersonaLimitForPlan(planId);
  return limit === null ? Number.MAX_SAFE_INTEGER : limit;
}
