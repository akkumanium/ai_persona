import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  referral_code: string | null;
};

type ReferralRewardRow = {
  status: string | null;
  reward_amount_cents: number | null;
};

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: rewards, error: rewardsError }] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("referral_code")
      .eq("user_id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("referral_rewards")
      .select("status, reward_amount_cents")
      .eq("referrer_user_id", user.id)
      .returns<ReferralRewardRow[]>(),
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (rewardsError) {
    return NextResponse.json({ error: rewardsError.message }, { status: 500 });
  }

  const pendingCount = (rewards ?? []).filter((reward) => reward.status === "pending").length;
  const rewarded = (rewards ?? []).filter((reward) => reward.status === "rewarded");

  return NextResponse.json({
    referralCode: profile?.referral_code ?? "",
    pendingCount,
    rewardedCount: rewarded.length,
    rewardedCents: rewarded.reduce((total, reward) => total + Math.max(0, reward.reward_amount_cents ?? 0), 0),
  });
}
