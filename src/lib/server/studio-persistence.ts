import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "@/lib/env";
import { sanitizeProviderPayload } from "@/lib/server/media-storage";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Asset, GenerationJob } from "@/lib/types";

type PersistGenerationInput = {
  userId?: string;
  job: GenerationJob;
  assets: Asset[];
  inputParams: Record<string, unknown>;
};

type PersistPendingGenerationInput = {
  userId?: string;
  job: GenerationJob;
  inputParams: Record<string, unknown>;
};

export async function persistPendingGenerationJob({
  userId,
  job,
  inputParams,
}: PersistPendingGenerationInput) {
  if (!hasSupabaseEnv() || !userId) return;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();
  await assertOwnedReferences(supabase, userId, [job.personaId], []);

  const { error } = await supabase.from("generation_jobs").insert({
    id: job.id,
    user_id: userId,
    persona_id: job.personaId ?? null,
    status: job.status,
    provider: job.provider,
    provider_job_id: job.providerJobId ?? null,
    model: job.model,
    generation_type: job.generationType,
    input_params: inputParams,
    output_asset_ids: [],
    cost_estimate_cents: job.costEstimateCents,
    raw_provider_response: sanitizeProviderPayload(job.rawProviderResponse ?? null),
    error_message: job.errorMessage ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  });

  if (error) {
    throw new Error(`Failed to persist pending generation job: ${error.message}`);
  }
}

export async function recordProviderAcceptance({
  userId,
  jobId,
  providerJobId,
  raw,
}: {
  userId?: string;
  jobId: string;
  providerJobId?: string;
  raw: unknown;
}) {
  if (!hasSupabaseEnv() || !userId) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to record provider acceptance.");
  const { error } = await createServiceSupabaseClient().from("generation_jobs").update({
    status: "running",
    provider_job_id: providerJobId ?? null,
    raw_provider_response: sanitizeProviderPayload(raw),
    updated_at: new Date().toISOString(),
  }).eq("id", jobId).eq("user_id", userId).eq("status", "queued");
  if (error) throw new Error(`Failed to record provider acceptance: ${error.message}`);
}

export async function persistGenerationRecords({
  userId,
  job,
  assets,
  inputParams,
}: PersistGenerationInput) {
  if (!hasSupabaseEnv() || !userId) return;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to finalize generation records.");
  }
  const outputAssetIds = assets.map((asset) => asset.id);
  await assertOwnedReferences(
    supabase,
    userId,
    [job.personaId, ...assets.map((asset) => asset.personaId)],
    assets.flatMap((asset) => asset.referenceAssetIds ?? []),
  );

  const jobPayload = {
    id: job.id,
    user_id: userId,
    persona_id: job.personaId ?? null,
    status: job.status,
    provider: job.provider,
    provider_job_id: job.providerJobId ?? null,
    model: job.model,
    generation_type: job.generationType,
    input_params: inputParams,
    output_asset_ids: outputAssetIds,
    cost_estimate_cents: job.costEstimateCents,
    raw_provider_response: sanitizeProviderPayload(job.rawProviderResponse ?? null),
    error_message: job.errorMessage ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
  const assetPayload = assets.map((asset) => ({
        id: asset.id,
        user_id: userId,
        persona_id: asset.personaId ?? null,
        kind: asset.kind,
        storage_bucket: asset.storageBucket ?? null,
        storage_path: asset.storagePath ?? null,
        public_url: asset.url,
        title: asset.title,
        prompt: asset.prompt,
        reference_asset_ids: asset.referenceAssetIds ?? [],
        reference_slot: asset.referenceSlot ?? null,
        is_default_reference: Boolean(asset.isDefaultReference),
        generation_type: asset.generationType,
        provider: asset.provider,
        provider_job_id: asset.providerJobId ?? null,
        model: asset.model,
        mime_type: asset.mimeType,
        provider_asset_id: asset.providerAssetId,
        created_at: asset.createdAt,
      }));
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase.rpc("finalize_generation_job", {
      p_user_id: userId,
      p_job: jobPayload,
      p_assets: assetPayload,
    });
    if (!error) return;
    lastError = error;
  }
  await Promise.all(assets.map(async (asset) => {
    if (!asset.storageBucket || !asset.storagePath) return;
    await supabase.storage.from(asset.storageBucket).remove([asset.storagePath]);
  }));
  throw new Error(`Failed to finalize generation records transactionally: ${lastError?.message ?? "unknown database error"}`);
}

export async function markPendingGenerationJobFailed({
  userId,
  jobId,
  error,
}: {
  userId?: string;
  jobId: string;
  error: unknown;
}) {
  if (!hasSupabaseEnv() || !userId) return;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();
  const errorMessage = error instanceof Error ? error.message : "Generation failed before the provider accepted it.";
  const { error: updateError } = await supabase
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"]);

  if (updateError) {
    throw new Error(`Failed to mark generation job as failed: ${updateError.message}`);
  }
}

export async function cleanupStalePendingGenerationJobs(
  supabase: SupabaseClient,
  userId: string,
  maxAgeMs = 45 * 60 * 1000,
) {
  const writer = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceSupabaseClient() : supabase;
  const stalePendingCutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const { error } = await writer
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: "The provider did not accept this generation request.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .is("provider_job_id", null)
    .lt("updated_at", stalePendingCutoff);

  if (error) {
    throw new Error(`Failed to clean up stale generation jobs: ${error.message}`);
  }
}

async function assertOwnedReferences(
  supabase: SupabaseClient,
  userId: string,
  personaIds: Array<string | undefined>,
  assetIds: string[],
) {
  const uniquePersonaIds = [...new Set(personaIds.filter((id): id is string => Boolean(id)))];
  const uniqueAssetIds = [...new Set(assetIds.filter(Boolean))];

  if (uniquePersonaIds.length) {
    const { data, error } = await supabase
      .from("personas")
      .select("id")
      .eq("user_id", userId)
      .in("id", uniquePersonaIds)
      .returns<Array<{ id: string }>>();
    if (error || (data?.length ?? 0) !== uniquePersonaIds.length) {
      throw new Error("Persona reference is outside the current user scope.");
    }
  }

  if (uniqueAssetIds.length) {
    const { data, error } = await supabase
      .from("assets")
      .select("id")
      .eq("user_id", userId)
      .in("id", uniqueAssetIds)
      .returns<Array<{ id: string }>>();
    if (error || (data?.length ?? 0) !== uniqueAssetIds.length) {
      throw new Error("Asset reference is outside the current user scope.");
    }
  }
}
