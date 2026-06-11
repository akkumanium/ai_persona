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

export async function persistGenerationRecords({
  userId,
  job,
  assets,
  inputParams,
}: PersistGenerationInput) {
  if (!hasSupabaseEnv() || !userId) return;

  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceSupabaseClient()
      : await createServerSupabaseClient();
    const outputAssetIds = assets.map((asset) => asset.id);

    await supabase.from("generation_jobs").insert({
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
    });

    if (assets.length) {
      await supabase.from("assets").insert(
        assets.map((asset) => ({
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
        })),
      );
    }
  } catch (error) {
    console.error("Failed to persist generation records", error);
  }
}
