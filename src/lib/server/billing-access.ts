import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanById, type BillingPlanId } from "@/lib/billing";
import { env } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "canceling"]);

type AccountProfileRow = {
  credit_balance_cents: number | null;
};

type BillingSubscriptionRow = {
  subscription_id: string | null;
  status: string | null;
  plan_id: string | null;
  current_period_ends_at: string | null;
};

export type BillingAccess = {
  balanceCents: number;
  hasActiveSubscription: boolean;
  hasStudioAccess: boolean;
  activePlanId?: BillingPlanId;
};

export async function getBillingAccess(supabase: SupabaseClient, userId: string): Promise<BillingAccess> {
  const billingSupabase = env.supabaseServiceRoleKey ? createServiceSupabaseClient() : supabase;
  const [profile, subscriptions] = await Promise.all([
    billingSupabase
      .from("account_profiles")
      .select("credit_balance_cents")
      .eq("user_id", userId)
      .maybeSingle<AccountProfileRow>(),
    loadSubscriptions(billingSupabase, userId),
  ]);

  if (profile.error) throw new Error(`Could not load billing profile: ${profile.error.message}`);
  if (subscriptions.error) throw new Error(`Could not load billing subscriptions: ${subscriptions.error.message}`);

  const balanceCents = Math.max(0, profile.data?.credit_balance_cents ?? 0);
  const subscriptionRows = subscriptions.data ?? [];
  const activeSubscriptionRows = subscriptionRows.filter(isActiveSubscriptionRow);
  const activePlanId = resolveActivePlanId(activeSubscriptionRows);
  const hasActiveSubscription = Boolean(activeSubscriptionRows.length);

  return {
    balanceCents,
    hasActiveSubscription,
    // Authentication gates Studio. A subscription only controls generation credits.
    hasStudioAccess: true,
    activePlanId,
  };
}

async function loadSubscriptions(supabase: SupabaseClient, userId: string) {
  const select = "subscription_id, status, plan_id, current_period_ends_at";
  const providerAwareResult = await supabase
    .from("billing_subscriptions")
    .select(select)
    .eq("user_id", userId)
    .eq("provider", "whop")
    .returns<BillingSubscriptionRow[]>();

  // Existing deployments from before migration 021 do not have provider yet.
  // Keep Studio available during the schema rollout; new deployments use Whop only.
  if (!isMissingProviderColumn(providerAwareResult.error)) return providerAwareResult;

  return supabase
    .from("billing_subscriptions")
    .select(select)
    .eq("user_id", userId)
    .returns<BillingSubscriptionRow[]>();
}

function isMissingProviderColumn(error: { code?: string | null; message?: string | null } | null) {
  return error?.code === "42703" && /billing_subscriptions\.provider/i.test(error.message ?? "");
}

function isActiveSubscriptionRow(row: BillingSubscriptionRow) {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(row.status ?? "")) return false;
  return row.status !== "canceling" || Boolean(row.current_period_ends_at && Date.parse(row.current_period_ends_at) > Date.now());
}

function resolveActivePlanId(rows: BillingSubscriptionRow[]) {
  const candidates = rows
    .map((row) => getPlanById(row.plan_id))
    .filter((plan) => plan !== undefined);
  return candidates.sort((left, right) => scorePlan(right.id) - scorePlan(left.id))[0]?.id;
}

function scorePlan(planId: BillingPlanId) {
  return planId === "yearly" ? 2 : 1;
}
