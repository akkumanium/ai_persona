import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type AccountProfileRow = {
  credit_balance_cents: number | null;
  account_metadata?: Record<string, unknown> | null;
};

type BillingSubscriptionRow = {
  status: string | null;
};

export type BillingAccess = {
  balanceCents: number;
  hasActiveSubscription: boolean;
  hasStudioAccess: boolean;
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
      .select("status")
      .eq("user_id", userId)
      .in("status", Array.from(ACTIVE_SUBSCRIPTION_STATUSES))
      .returns<BillingSubscriptionRow[]>(),
  ]);

  const balanceCents = Math.max(0, profile?.credit_balance_cents ?? 0);
  const metadataSubscription = getMetadataSubscriptionStatus(profile?.account_metadata);
  const hasActiveSubscription =
    Boolean(subscriptions.data?.length) || ACTIVE_SUBSCRIPTION_STATUSES.has(metadataSubscription);

  return {
    balanceCents,
    hasActiveSubscription,
    hasStudioAccess: hasActiveSubscription,
  };
}

function getMetadataSubscriptionStatus(metadata?: Record<string, unknown> | null) {
  const paddle = metadata?.paddle;
  if (!paddle || typeof paddle !== "object" || Array.isArray(paddle)) return "";
  const status = (paddle as { subscriptionStatus?: unknown }).subscriptionStatus;
  return typeof status === "string" ? status : "";
}
