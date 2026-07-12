import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { reconcileWavespeedJob } from "@/lib/server/wavespeed-job-completion";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "jobs-poll", limit: 60, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const { providerJobId } = (await readJsonRequest(request, 8 * 1024) ?? {}) as {
      providerJobId?: unknown;
    };
    if (!providerJobId) {
      return NextResponse.json({ error: "providerJobId is required." }, { status: 400 });
    }

    if (hasSupabaseEnv() && auth.user) {
      const supabase = await createServerSupabaseClient();
      const { data: job, error } = await supabase
        .from("generation_jobs")
        .select("id, user_id, persona_id, status, provider, provider_job_id, model, generation_type, input_params, cost_estimate_cents, created_at")
        .eq("user_id", auth.user.id)
        .eq("provider_job_id", String(providerJobId))
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!job) {
        return NextResponse.json({ error: "Generation job was not found for this account." }, { status: 404 });
      }

      if (job.status === "succeeded" || job.status === "failed") {
        return NextResponse.json({ job });
      }

      if (job.provider_job_id !== String(providerJobId) || job.provider !== "wavespeed") {
        return NextResponse.json({ error: "Stored provider job metadata is invalid." }, { status: 409 });
      }
      const reconciled = await reconcileWavespeedJob(job);
      return NextResponse.json({ job: reconciled?.job ?? job, asset: reconciled?.assets[0] });
    }

    return NextResponse.json({ error: "Persistent job ownership is required for polling." }, { status: 503 });
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Polling failed." },
      { status: 500 },
    );
  }
}
