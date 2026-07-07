import type { SupabaseClient } from "@supabase/supabase-js";
import { getPersonaLimitForPlan, getPlanById, type BillingPlanId } from "@/lib/billing";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type AccountProfileRow = {
  credit_balance_cents: number | null;
  account_metadata?: Record<string, unknown> | null;
};

type BillingSubscriptionRow = {
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
  const [{ data: profile }, subscriptions] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("credit_balance_cents, account_metadata")
      .eq("user_id", userId)
      .maybeSingle<AccountProfileRow>(),
    supabase
      .from("billing_subscriptions")
      .select("status, plan_id")
      .eq("user_id", userId)
      .in("status", Array.from(ACTIVE_SUBSCRIPTION_STATUSES))
      .returns<BillingSubscriptionRow[]>(),
  ]);

  const balanceCents = Math.max(0, profile?.credit_balance_cents ?? 0);
  const metadataSubscription = getMetadataSubscription(profile?.account_metadata);
  const hasActiveMetadataSubscription = ACTIVE_SUBSCRIPTION_STATUSES.has(metadataSubscription.status);
  const activePlanId = resolveActivePlanId(
    subscriptions.data ?? [],
    hasActiveMetadataSubscription ? metadataSubscription.planId : undefined,
  );
  const hasActiveSubscription =
    Boolean(subscriptions.data?.length) || hasActiveMetadataSubscription;

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
  return {
    status: typeof status === "string" ? status : "",
    planId: typeof planId === "string" ? planId : undefined,
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
