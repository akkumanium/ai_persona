import { NextResponse } from "next/server";
import { env, hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasSupabaseEnv() || !env.paddleApiKey) {
    return NextResponse.json({ error: "Billing management is not configured." }, { status: 503 });
  }
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("account_profiles")
    .select("billing_customer_id")
    .eq("user_id", user.id)
    .maybeSingle<{ billing_customer_id: string | null }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile?.billing_customer_id) {
    return NextResponse.json({ error: "No subscription is connected to this account yet." }, { status: 404 });
  }

  const apiBase = env.paddleEnvironment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const response = await fetch(`${apiBase}/customers/${encodeURIComponent(profile.billing_customer_id)}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.paddleApiKey}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    data?: { urls?: { general?: { overview?: string } } };
    error?: { detail?: string };
  };
  const url = payload.data?.urls?.general?.overview;
  if (!response.ok || !url) {
    return NextResponse.json({ error: payload.error?.detail ?? "Could not open billing management." }, { status: 502 });
  }
  return NextResponse.json({ url });
}
