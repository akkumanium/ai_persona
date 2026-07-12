import { createHash } from "crypto";
import { imageProvider, videoProvider } from "@/lib/providers";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import type { Asset, GenerationJob } from "@/lib/types";

type StoredJob = {
  id: string; user_id: string; persona_id: string | null; status: string; provider: string;
  provider_job_id: string | null; model: string; generation_type: GenerationJob["generationType"];
  input_params: unknown; cost_estimate_cents: number; created_at: string;
};

export async function reconcileWavespeedJob(job: StoredJob) {
  if (!job.provider_job_id || !["queued", "running"].includes(job.status)) return undefined;
  const inputParams = (job.input_params ?? {}) as Record<string, unknown>;
  const isImage = ["image_from_prompt", "image_from_reference", "avatar_prompt", "avatar_image_blend", "avatar_normalization"].includes(job.generation_type);
  const result = isImage
    ? await imageProvider.poll(job.provider_job_id)
    : await videoProvider.poll(`${job.provider}:${job.provider_job_id}`);
  const updatedAt = new Date().toISOString();
  const referenceAssetIds = stringArray(inputParams.referenceAssetIds);
  const assetKind = isImage ? (["avatar_prompt", "avatar_image_blend", "avatar_normalization"].includes(job.generation_type) || inputParams.assetKind === "avatar" ? "avatar" : "image") : "video";
  const payloads = isImage
    ? (result as Awaited<ReturnType<typeof imageProvider.poll>>).assets
    : (() => { const video = result as Awaited<ReturnType<typeof videoProvider.poll>>; return video.asset ? [video.asset] : []; })();
  const assets: Asset[] = result.status === "succeeded" ? await Promise.all(payloads.map((payload, index) => materializeGeneratedAsset({
    id: deterministicAssetId(job.id, index),
    kind: assetKind,
    title: isImage && assetKind === "avatar" ? `${typeof inputParams.titlePrefix === "string" ? inputParams.titlePrefix : `${typeof inputParams.personaName === "string" ? inputParams.personaName : "Generated"} reference`} ${index + 1}` : isImage ? "" : `${typeof inputParams.personaName === "string" ? inputParams.personaName : "Generated"} video`,
    prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "",
    personaId: job.persona_id ?? undefined,
    referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
    referenceSlot: isImage && isReferenceSlot(inputParams.referenceSlot) ? inputParams.referenceSlot : undefined,
    isDefaultReference: isImage && assetKind === "avatar" && Boolean(inputParams.isDefaultReference) && index === 0,
    generationType: job.generation_type,
    provider: result.provider,
    providerJobId: result.providerJobId,
    model: result.model,
    createdAt: updatedAt,
    ...payload,
  }, job.user_id))) : [];
  const persistedJob: GenerationJob = {
    id: job.id, status: result.status ?? "queued", provider: result.provider, providerJobId: result.providerJobId,
    model: result.model, generationType: job.generation_type, prompt: typeof inputParams.prompt === "string" ? inputParams.prompt : "",
    personaId: job.persona_id ?? undefined, referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
    costEstimateCents: job.cost_estimate_cents, rawProviderResponse: sanitizeProviderPayload(result.raw),
    errorMessage: result.status === "failed" ? providerError(result.raw) : undefined, createdAt: job.created_at, updatedAt,
  };
  await persistGenerationRecords({ userId: job.user_id, job: persistedJob, assets, inputParams });
  return { job: persistedJob, assets };
}

function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function isReferenceSlot(value: unknown): value is Asset["referenceSlot"] { return ["face", "chest-up", "face-grid", "body", "more"].includes(String(value)); }
function providerError(raw: unknown) { return raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).error === "string" ? (raw as Record<string, string>).error.slice(0, 1000) : "WaveSpeed generation failed."; }

// Stable IDs make retries overwrite the same storage object. The database finalizer
// locks the job and inserts these IDs once, so concurrent webhook/poll attempts are safe.
function deterministicAssetId(jobId: string, index: number) {
  if (index === 0) return jobId;
  const hash = createHash("sha256").update(`${jobId}:${index}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
