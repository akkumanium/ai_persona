import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { referralCode?: unknown };
  const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim() : "";
  if (!referralCode) {
    return NextResponse.json({ claimed: false });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data, error: claimError } = await supabase.rpc("claim_referral", {
    p_referral_code: referralCode,
    p_referred_user_id: user.id,
  });

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  return NextResponse.json({ claimed: Boolean(data) });
}
