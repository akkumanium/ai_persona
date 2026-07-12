import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { videoProvider } from "@/lib/providers";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

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

      if (job.provider_job_id !== String(providerJobId) || !["wavespeed", "wan", "kling", "seedance"].includes(job.provider)) {
        return NextResponse.json({ error: "Stored provider job metadata is invalid." }, { status: 409 });
      }
      const result = await videoProvider.poll(`${job.provider}:${job.provider_job_id}`);
      const updatedAt = nowIso();
      const inputParams = (job.input_params ?? {}) as Record<string, unknown>;
      const referenceAssetIds = Array.isArray(inputParams.referenceAssetIds)
        ? inputParams.referenceAssetIds.filter((id): id is string => typeof id === "string")
        : [];
      const asset: Asset | undefined = result.status === "succeeded" && result.asset
        ? await materializeGeneratedAsset({
            id: crypto.randomUUID(),
            kind: "video",
            title: `${typeof inputParams.personaName === "string" ? inputParams.personaName : "Generated"} video`,
            prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "",
            personaId: job.persona_id ?? undefined,
            referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
            generationType: job.generation_type,
            provider: result.provider,
            providerJobId: result.providerJobId,
            model: result.model,
            createdAt: updatedAt,
            ...result.asset,
          }, auth.user.id)
        : undefined;
      const persistedJob: GenerationJob = {
        id: job.id,
        status: result.status,
        provider: result.provider,
        providerJobId: result.providerJobId,
        model: result.model,
        generationType: job.generation_type,
        prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "",
        personaId: job.persona_id ?? undefined,
        referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
        costEstimateCents: job.cost_estimate_cents,
        rawProviderResponse: sanitizeProviderPayload(result.raw),
        createdAt: job.created_at,
        updatedAt,
      };
      await persistGenerationRecords({
        userId: auth.user.id,
        job: persistedJob,
        assets: asset ? [asset] : [],
        inputParams,
      });

      return NextResponse.json({ job: persistedJob, asset });
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
