import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { assertValidBillingCatalog, getBillingOptionById } from "@/lib/billing";
import { env } from "@/lib/env";
import { getBillingAccess } from "@/lib/server/billing-access";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitRequest(request, { key: "billing-checkout-intent", limit: 10, windowMs: 60_000 });
    if (limited) return limited;
    if (!env.supabaseServiceRoleKey) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    if (!auth.user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    assertValidBillingCatalog();
    const body = (await readJsonRequest(request, 4 * 1024) ?? {}) as { optionId?: unknown };
    const option = getBillingOptionById(typeof body.optionId === "string" ? body.optionId : undefined);
    if (!option?.priceId) return NextResponse.json({ error: "Unknown billing option." }, { status: 400 });
    const session = await createServerSupabaseClient();
    const access = await getBillingAccess(session, auth.user.id);
    if (option.kind === "topup" && !access.hasActiveSubscription) {
      return NextResponse.json({ error: "An active subscription is required for top-ups." }, { status: 409 });
    }
    if (option.kind === "subscription" && access.hasActiveSubscription) {
      return NextResponse.json({ error: "Manage the existing subscription instead of opening a second checkout." }, { status: 409 });
    }
    const service = createServiceSupabaseClient();
    const { data, error } = await service.from("billing_checkout_intents").insert({
      user_id: auth.user.id,
      option_id: option.id,
      price_id: option.priceId,
      expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    }).select("id").single<{ id: string }>();
    if (error || !data) throw error ?? new Error("Could not create checkout intent.");
    return NextResponse.json({ checkoutIntentId: data.id });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare checkout." }, { status: 500 });
  }
}
