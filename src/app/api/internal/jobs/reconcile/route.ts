import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { videoProvider } from "@/lib/providers";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Asset, GenerationJob } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.supabaseServiceRoleKey) return NextResponse.json({ error: "Service database access is not configured." }, { status: 503 });
  const service = createServiceSupabaseClient();
  const { data: jobs, error } = await service.from("generation_jobs")
    .select("id,user_id,persona_id,status,provider,provider_job_id,model,generation_type,input_params,cost_estimate_cents,created_at")
    .in("status", ["queued", "running"]).not("provider_job_id", "is", null).order("updated_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const outcomes = await Promise.allSettled((jobs ?? []).map(async (job) => {
    const result = await videoProvider.poll(`${job.provider}:${job.provider_job_id}`);
    const inputParams = (job.input_params ?? {}) as Record<string, unknown>;
    const updatedAt = new Date().toISOString();
    const referenceAssetIds = Array.isArray(inputParams.referenceAssetIds) ? inputParams.referenceAssetIds.filter((id): id is string => typeof id === "string") : [];
    const asset: Asset | undefined = result.status === "succeeded" && result.asset ? await materializeGeneratedAsset({
      id: crypto.randomUUID(), kind: "video", title: `${typeof inputParams.personaName === "string" ? inputParams.personaName : "Generated"} video`,
      prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "", personaId: job.persona_id ?? undefined,
      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined, generationType: job.generation_type,
      provider: result.provider, providerJobId: result.providerJobId, model: result.model, createdAt: updatedAt, ...result.asset,
    }, job.user_id) : undefined;
    const persistedJob: GenerationJob = {
      id: job.id, status: result.status, provider: result.provider, providerJobId: result.providerJobId, model: result.model,
      generationType: job.generation_type, prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "", personaId: job.persona_id ?? undefined,
      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined, costEstimateCents: job.cost_estimate_cents,
      rawProviderResponse: sanitizeProviderPayload(result.raw), createdAt: job.created_at, updatedAt,
    };
    await persistGenerationRecords({ userId: job.user_id, job: persistedJob, assets: asset ? [asset] : [], inputParams });
    return job.id;
  }));
  return NextResponse.json({ checked: outcomes.length, completed: outcomes.filter((result) => result.status === "fulfilled").length, failed: outcomes.filter((result) => result.status === "rejected").length });
}
