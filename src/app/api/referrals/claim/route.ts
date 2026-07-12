import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, { key: "referral-claim", limit: 10, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: { referralCode?: unknown };
  try {
    body = (await readJsonRequest(request, 8 * 1024) ?? {}) as { referralCode?: unknown };
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
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
