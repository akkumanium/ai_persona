import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function getTokenBalance(userId?: string) {
  if (!hasSupabaseEnv() || !userId) return undefined;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("account_profiles")
    .select("credit_balance_cents")
    .eq("user_id", userId)
    .maybeSingle<{ credit_balance_cents: number | null }>();

  return Math.max(0, profile?.credit_balance_cents ?? 0);
}

export async function assertSufficientTokens(userId: string | undefined, requiredTokens: number) {
  const balance = await getTokenBalance(userId);
  if (balance === undefined) return;

  if (balance < requiredTokens) {
    throw new InsufficientTokensError(requiredTokens, balance);
  }
}

export class InsufficientTokensError extends Error {
  constructor(
    public readonly requiredTokens: number,
    public readonly balanceTokens: number,
  ) {
    super(`Insufficient token balance. This generation costs ${requiredTokens} tokens, but your balance is ${balanceTokens}.`);
    this.name = "InsufficientTokensError";
  }
}
