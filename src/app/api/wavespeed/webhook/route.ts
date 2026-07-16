import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { reconcileWavespeedJob } from "@/lib/server/wavespeed-job-completion";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookId = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  if (!webhookId || !timestamp || !signature || !verifySignature(webhookId, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid WaveSpeed webhook signature." }, { status: 401 });
  }
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Expired WaveSpeed webhook." }, { status: 401 });
  }
  let payload: { id?: unknown; status?: unknown; data?: { id?: unknown; status?: unknown } };
  try { payload = JSON.parse(rawBody) as { id?: unknown; status?: unknown; data?: { id?: unknown; status?: unknown } }; }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  // WaveSpeed callbacks are normally top-level, but some API responses wrap the
  // prediction in `data`. Accept both shapes so a completed task is never dropped.
  const providerJobId = typeof payload.id === "string"
    ? payload.id
    : typeof payload.data?.id === "string" ? payload.data.id : "";
  const status = String(payload.status ?? payload.data?.status ?? "").toLowerCase();
  if (!providerJobId || !["completed", "complete", "succeeded", "success", "failed", "error", "cancelled", "canceled", "expired"].includes(status)) {
    return NextResponse.json({ ok: true });
  }
  if (!env.supabaseServiceRoleKey) return NextResponse.json({ error: "Service database access is not configured." }, { status: 503 });
  const service = createServiceSupabaseClient();
  const { data: job, error } = await service.from("generation_jobs")
    .select("id,user_id,persona_id,status,provider,provider_job_id,model,generation_type,input_params,cost_estimate_cents,created_at")
    .eq("provider", "wavespeed").eq("provider_job_id", providerJobId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job || ["succeeded", "failed"].includes(job.status)) return NextResponse.json({ ok: true });
  try {
    await reconcileWavespeedJob(job);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WaveSpeed webhook finalization failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

function verifySignature(id: string, timestamp: string, rawBody: string, signatureHeader: string) {
  if (!env.wavespeedWebhookSecret || !/^\d{10,13}$/.test(timestamp)) return false;
  const key = env.wavespeedWebhookSecret.replace(/^whsec_/, "");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("hex");
  return signatureHeader.split(" ").some((entry) => {
    const [, signature] = entry.trim().split(",", 2);
    if (!signature || signature.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
}
