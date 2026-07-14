import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { assertValidBillingCatalog, getBillingOptionById, hasWhopBillingEnv } from "@/lib/billing";
import { env } from "@/lib/env";
import { getBillingAccess } from "@/lib/server/billing-access";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { getWhopClient, getWhopEnvironment } from "@/lib/server/whop";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_RETURN_PATHS = new Set(["/pricing", "/studio"]);

export async function POST(request: Request) {
  try {
    const limited = await rateLimitRequest(request, { key: "billing-checkout-session", limit: 10, windowMs: 60_000 });
    if (limited) return limited;
    if (!env.supabaseServiceRoleKey || !hasWhopBillingEnv()) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    if (!auth.user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

    assertValidBillingCatalog();
    const body = (await readJsonRequest(request, 4 * 1024) ?? {}) as { optionId?: unknown; returnPath?: unknown };
    const option = getBillingOptionById(typeof body.optionId === "string" ? body.optionId : undefined);
    if (!option?.providerPlanId) return NextResponse.json({ error: "Unknown billing option." }, { status: 400 });
    if (typeof body.returnPath !== "string" || !ALLOWED_RETURN_PATHS.has(body.returnPath)) {
      return NextResponse.json({ error: "Unknown checkout return path." }, { status: 400 });
    }
    const returnPath = body.returnPath;

    const session = await createServerSupabaseClient();
    const access = await getBillingAccess(session, auth.user.id);
    if (option.kind === "topup" && !access.hasActiveSubscription) {
      return NextResponse.json({ error: "An active subscription is required for top-ups." }, { status: 409 });
    }
    if (option.kind === "subscription" && access.hasActiveSubscription) {
      return NextResponse.json({ error: "Manage the existing subscription instead of opening a second checkout." }, { status: 409 });
    }

    const service = createServiceSupabaseClient();
    const { data: intent, error: insertError } = await service.from("billing_checkout_intents").insert({
      user_id: auth.user.id,
      option_id: option.id,
      provider: "whop",
      provider_plan_id: option.providerPlanId,
      return_path: returnPath,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    }).select("id").single<{ id: string }>();
    if (insertError || !intent) throw insertError ?? new Error("Could not create checkout intent.");

    const returnUrl = new URL(returnPath, env.siteUrl);
    returnUrl.searchParams.set("checkout", "return");
    try {
      const checkout = await getWhopClient().checkoutConfigurations.create({
        plan_id: option.providerPlanId,
        mode: "payment",
        allow_promo_codes: false,
        redirect_url: returnUrl.toString(),
        source_url: new URL(returnPath, env.siteUrl).toString(),
        metadata: {
          schema_version: "1",
          app_user_id: auth.user.id,
          checkout_intent_id: intent.id,
          option_id: option.id,
          return_path: returnPath,
        },
      });
      if (!checkout.plan?.id || checkout.plan.id !== option.providerPlanId) {
        throw new Error("Whop returned an unexpected plan for checkout.");
      }
      const { error: updateError } = await service.from("billing_checkout_intents").update({
        provider_checkout_session_id: checkout.id,
      }).eq("id", intent.id);
      if (updateError) throw updateError;

      return NextResponse.json({
        checkoutIntentId: intent.id,
        sessionId: checkout.id,
        planId: checkout.plan.id,
        environment: getWhopEnvironment(),
        returnUrl: returnUrl.toString(),
      });
    } catch (error) {
      await service.from("billing_checkout_intents").update({
        status: "failed",
        failure_message: error instanceof Error ? error.message.slice(0, 500) : "Whop checkout failed",
      }).eq("id", intent.id);
      throw error;
    }
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    console.error(JSON.stringify({ level: "error", operation: "whop_checkout_session", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Could not prepare secure checkout." }, { status: 500 });
  }
}
