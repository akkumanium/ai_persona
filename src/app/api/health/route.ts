import { NextResponse } from "next/server";
import { assertValidBillingCatalog } from "@/lib/billing";
import { env, hasSupabaseEnv } from "@/lib/env";

export function GET() {
  const missing = [
    !hasSupabaseEnv() && "Supabase public configuration",
    !env.supabaseServiceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    !env.paddleWebhookSecretKey && "PADDLE_WEBHOOK_SECRET_KEY",
    !env.paddleApiKey && "PADDLE_API_KEY",
    !env.wavespeedApiKey && "WAVESPEED_API_KEY",
    !env.elevenLabsApiKey && "ELEVENLABS_API_KEY",
    !env.cronSecret && "CRON_SECRET",
  ].filter(Boolean);
  try { assertValidBillingCatalog(); } catch (error) { missing.push(error instanceof Error ? error.message : "Paddle catalog"); }
  return NextResponse.json(
    { status: missing.length ? "not_ready" : "ready", checks: { configuration: missing.length ? "failed" : "ok" }, missing },
    { status: missing.length ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
