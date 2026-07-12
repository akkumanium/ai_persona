import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cleanupExpiredUploadIntents } from "@/lib/server/direct-media-upload";
import { reconcileWavespeedJob } from "@/lib/server/wavespeed-job-completion";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.supabaseServiceRoleKey) return NextResponse.json({ error: "Service database access is not configured." }, { status: 503 });
  const expiredUploadsCleaned = await cleanupExpiredUploadIntents();
  const service = createServiceSupabaseClient();
  const { data: jobs, error } = await service.from("generation_jobs")
    .select("id,user_id,persona_id,status,provider,provider_job_id,model,generation_type,input_params,cost_estimate_cents,created_at")
    .in("status", ["queued", "running"]).not("provider_job_id", "is", null).order("updated_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const outcomes = await Promise.allSettled((jobs ?? []).map(reconcileWavespeedJob));
  return NextResponse.json({ checked: outcomes.length, completed: outcomes.filter((result) => result.status === "fulfilled").length, failed: outcomes.filter((result) => result.status === "rejected").length, expiredUploadsCleaned });
}
