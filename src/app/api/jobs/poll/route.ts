import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { reconcileWavespeedJob } from "@/lib/server/wavespeed-job-completion";
import { markPendingGenerationJobFailed } from "@/lib/server/studio-persistence";
import { mapAsset, mapJob } from "@/lib/studio-records";
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
        .select("id, user_id, persona_id, status, provider, provider_job_id, model, generation_type, input_params, cost_estimate_cents, raw_provider_response, error_message, created_at, updated_at")
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
        const { data: assetRows } = await supabase
          .from("assets")
          .select("id,kind,public_url,storage_bucket,storage_path,title,prompt,persona_id,reference_asset_ids,reference_slot,is_default_reference,generation_type,provider,provider_job_id,provider_asset_id,model,mime_type,created_at,expires_at")
          .eq("provider_job_id", String(providerJobId));
        const assets = (assetRows ?? []).map(mapAsset);
        return NextResponse.json({ job: mapJob(job), asset: assets[0], assets });
      }

      if (job.provider_job_id !== String(providerJobId) || job.provider !== "wavespeed") {
        return NextResponse.json({ error: "Stored provider job metadata is invalid." }, { status: 409 });
      }
      try {
        const reconciled = await reconcileWavespeedJob(job);
        return NextResponse.json({ job: reconciled?.job ?? mapJob(job), asset: reconciled?.assets[0], assets: reconciled?.assets ?? [] });
      } catch (error) {
        // Preserve retries for transient provider/storage errors, but do not let
        // a job whose provider task was accepted remain running indefinitely.
        if (Date.now() - Date.parse(job.created_at) < 45 * 60 * 1000) {
          throw error;
        }
        const message = error instanceof Error ? error.message : "Could not retrieve the completed WaveSpeed generation.";
        await markPendingGenerationJobFailed({ userId: auth.user.id, jobId: job.id, error: message }).catch(() => undefined);
        return NextResponse.json({
          job: {
            id: job.id,
            status: "failed",
            provider: job.provider,
            providerJobId: job.provider_job_id ?? undefined,
            model: job.model,
            generationType: job.generation_type,
            prompt: typeof (job.input_params as Record<string, unknown> | null)?.prompt === "string" ? (job.input_params as Record<string, string>).prompt : "",
            personaId: job.persona_id ?? undefined,
            costEstimateCents: job.cost_estimate_cents,
            errorMessage: message,
            createdAt: job.created_at,
            updatedAt: new Date().toISOString(),
          },
        });
      }
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
