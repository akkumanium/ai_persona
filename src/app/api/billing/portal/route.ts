import { NextResponse } from "next/server";
import { env, hasSupabaseEnv } from "@/lib/env";
import { getWhopClient } from "@/lib/server/whop";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasSupabaseEnv() || !env.whopApiKey || !env.whopCompanyId) return NextResponse.json({ error: "Billing management is not configured." }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data: subscription, error } = await supabase.from("billing_subscriptions")
    .select("subscription_id, manage_url")
    .eq("user_id", user.id)
    .eq("provider", "whop")
    .in("status", ["active", "trialing", "canceling"])
    .order("updated_at", { ascending: false }).limit(1)
    .maybeSingle<{ subscription_id: string; manage_url: string | null }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscription?.subscription_id) return NextResponse.json({ error: "No subscription is connected to this account yet." }, { status: 404 });
  if (subscription.manage_url) return NextResponse.json({ url: subscription.manage_url });

  try {
    const membership = await getWhopClient().memberships.retrieve(subscription.subscription_id);
    if (membership.company.id !== env.whopCompanyId) throw new Error("Whop membership belongs to another company.");
    if (!membership.manage_url) throw new Error("Whop did not return a membership management link.");
    await createServiceSupabaseClient().from("billing_subscriptions").update({ manage_url: membership.manage_url }).eq("subscription_id", subscription.subscription_id);
    return NextResponse.json({ url: membership.manage_url });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", operation: "whop_billing_portal", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Could not open billing management." }, { status: 502 });
  }
}
