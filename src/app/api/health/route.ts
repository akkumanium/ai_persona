import { NextResponse } from "next/server";
import { assertValidBillingCatalog } from "@/lib/billing";
import { env, hasSupabaseEnv } from "@/lib/env";
import { validateWhopCatalogWithProvider } from "@/lib/server/whop";

export async function GET() {
  const missing = [
    !hasSupabaseEnv() && "Supabase public configuration",
    !env.supabaseServiceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    !env.whopWebhookSecret && "WHOP_WEBHOOK_SECRET",
    !env.whopApiKey && "WHOP_API_KEY",
    !env.whopCompanyId && "WHOP_COMPANY_ID",
    !env.wavespeedApiKey && "WAVESPEED_API_KEY",
    !env.elevenLabsApiKey && "ELEVENLABS_API_KEY",
    !env.cronSecret && "CRON_SECRET",
  ].filter(Boolean);
  try { assertValidBillingCatalog(); } catch (error) { missing.push(error instanceof Error ? error.message : "Whop catalog"); }
  if (env.whopApiKey && env.whopCompanyId && !missing.some((item) => typeof item === "string" && item.includes("Whop plan"))) {
    try { await validateWhopCatalogWithProvider(); } catch (error) { missing.push(error instanceof Error ? error.message : "Whop catalog verification failed"); }
  }
  return NextResponse.json(
    { status: missing.length ? "not_ready" : "ready", checks: { configuration: missing.length ? "failed" : "ok" }, missing },
    { status: missing.length ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
