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

export async function reserveTokens(userId: string | undefined, requiredTokens: number, jobId: string, description: string) {
  if (!hasSupabaseEnv() || !userId) return undefined;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to reserve generation credits.");
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("consume_credits", {
    p_user_id: userId,
    p_amount_cents: requiredTokens,
    p_job_id: jobId,
    p_description: description,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (data === null) {
    const balance = await getTokenBalance(userId);
    throw new InsufficientTokensError(requiredTokens, balance ?? 0);
  }

  return Number(data);
}

export async function refundTokens(userId: string | undefined, amountTokens: number, jobId: string, description: string) {
  if (!hasSupabaseEnv() || !userId || amountTokens <= 0) return undefined;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to refund generation credits.");
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("refund_credits", {
    p_user_id: userId,
    p_amount_cents: amountTokens,
    p_job_id: jobId,
    p_description: description,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data);
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
