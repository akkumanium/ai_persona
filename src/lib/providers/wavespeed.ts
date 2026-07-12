import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "wavespeed";
import { env } from "@/lib/env";
import {
  CHATGPT_IMAGE_MODEL_ID,
  SEEDREAM_4_5_MODEL_ID,
  WAN_2_7_IMAGE_EDIT_MODEL_ID,
  WAN_2_7_IMAGE_MODEL_ID,
} from "@/lib/image-model-options";
import {
  estimateAvatarGenerationPricing,
  estimateImageGenerationPricing,
  estimateVideoGenerationPricing,
} from "@/lib/pricing";
import type {
  AvatarGenerationRequest,
  AvatarGenerationResult,
  GeneratedAssetPayload,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderImageInput,
  ProviderMediaInput,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "@/lib/providers/types";
import { firstString, normalizeVideoStatus, videoAssetFromUrl } from "@/lib/providers/video-utils";

const WAVESPEED_API_BASE_URL = "https://api.wavespeed.ai";
const WAVESPEED_REQUEST_TIMEOUT_MS = 20_000;

type WavespeedRunResult = {
  outputs?: unknown;
  id?: unknown;
  taskId?: unknown;
  requestId?: unknown;
  status?: unknown;
  model?: unknown;
  data?: {
    outputs?: unknown;
    id?: unknown;
    status?: unknown;
    model?: unknown;
  };
};

export class WavespeedMediaProvider implements ImageProvider, VideoProvider {
  name = "wavespeed" as const;

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = wavespeedClient();
    const isChatGptImage = request.model === CHATGPT_IMAGE_MODEL_ID;
    const isSeedream45 = request.model === SEEDREAM_4_5_MODEL_ID;
    const isWan27Image = request.model === WAN_2_7_IMAGE_MODEL_ID || request.model === WAN_2_7_IMAGE_EDIT_MODEL_ID;
    const isWan27ImageEdit = request.model === WAN_2_7_IMAGE_EDIT_MODEL_ID;
    const uploadedReferenceUrls = await uploadProviderImages(client, request.referenceImages ?? []);
    if (isWan27ImageEdit && !uploadedReferenceUrls.length) {
      throw new Error("Wan 2.7 image edit requires at least one reference image.");
    }
    const referenceUrls = isSeedream45 ? uploadedReferenceUrls.slice(0, 10) : uploadedReferenceUrls;
    const model = wavespeedImageModel(request.model, referenceUrls.length > 0);
    const result = await client.run(model, {
      prompt: request.prompt,
      image: isSeedream45 ? undefined : referenceUrls[0],
      images: referenceUrls.length ? referenceUrls : undefined,
      image_url: isSeedream45 ? undefined : referenceUrls[0],
      image_urls: isSeedream45 ? undefined : referenceUrls.length ? referenceUrls : undefined,
      aspect_ratio: isSeedream45 || isWan27Image ? undefined : request.aspectRatio,
      resolution: isChatGptImage ? request.imageSize.toLowerCase() : undefined,
      size: isSeedream45
        ? seedream45Size(request.aspectRatio, request.imageSize)
        : isWan27Image
          ? wan27ImageSize(request.aspectRatio, request.imageSize)
          : isChatGptImage
            ? undefined
            : request.imageSize,
      image_size: isSeedream45 || isWan27Image || isChatGptImage ? undefined : request.imageSize,
      quality: isSeedream45 ? undefined : request.imageQuality,
      output_format: isChatGptImage ? "png" : undefined,
      num_outputs: isSeedream45 || isWan27Image || isChatGptImage ? undefined : request.count,
      seed: isWan27Image ? -1 : undefined,
    }, {
      pollInterval: 2,
      timeout: 90,
    }) as WavespeedRunResult;
    const assets = outputsFromResult(result)
      .map((url, index): GeneratedAssetPayload => ({
        url,
        mimeType: mimeTypeFromUrl(url, "image/png"),
        providerAssetId: `${taskIdFromResult(result)}-${index}`,
      }))
      .slice(0, request.count);

    if (!assets.length) {
      throw new Error("WaveSpeed image generation returned no assets.");
    }

    return {
      provider: this.name,
      model,
      assets,
      costEstimateCents: estimateImageGenerationPricing(request).tokens,
      raw: result,
    };
  }

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const client = wavespeedClient();
    const startFrame = request.startFrameImage
      ? await uploadProviderInput(client, request.startFrameImage, "image")
      : request.startFrameImageUrl || request.referenceImageUrl;
    const endFrame = request.endFrameImage
      ? await uploadProviderInput(client, request.endFrameImage, "image")
      : request.endFrameImageUrl;
    const motionVideo = request.motionReferenceVideo
      ? await uploadProviderInput(client, request.motionReferenceVideo, "video")
      : request.motionReferenceVideoUrl;
    const referenceVideo = request.referenceVideo
      ? await uploadProviderInput(client, request.referenceVideo, "video")
      : request.referenceVideoUrl;
    const referenceAudio = request.referenceAudio
      ? await uploadProviderInput(client, request.referenceAudio, "audio")
      : request.referenceAudioUrl;
    const usesSeedanceMultimodalReferences = isSeedanceModel(request.model) && Boolean(referenceVideo || referenceAudio);
    const model = wavespeedVideoModel(request);
    const input = usesSeedanceMultimodalReferences
      ? {
          prompt: request.prompt,
          reference_images: [startFrame, endFrame].filter((url): url is string => Boolean(url)),
          reference_videos: referenceVideo ? [referenceVideo] : undefined,
          reference_audios: referenceAudio ? [referenceAudio] : undefined,
          duration: request.durationSeconds,
          aspect_ratio: request.aspectRatio === "auto" ? undefined : request.aspectRatio,
          resolution: request.resolution,
          generate_audio: request.generateAudio,
        }
      : {
          prompt: request.prompt,
          image: startFrame,
          image_url: startFrame,
          first_frame_image: startFrame,
          end_image: endFrame,
          end_image_url: endFrame,
          last_frame_image: endFrame,
          video: motionVideo,
          video_url: motionVideo,
          duration: request.durationSeconds,
          aspect_ratio: request.aspectRatio === "auto" ? undefined : request.aspectRatio,
          negative_prompt: request.negativePrompt || undefined,
          cfg_scale: request.cfgScale,
          resolution: request.resolution,
          generate_audio: request.generateAudio,
          sound: request.generateAudio,
          return_last_frame: request.returnLastFrame,
          mode: request.mode === "motion" ? request.motionMode ?? "animate" : undefined,
          character_orientation: request.mode === "motion" ? request.characterOrientation ?? "video" : undefined,
          keep_original_sound: request.mode === "motion" ? request.keepOriginalSound ?? true : undefined,
          shot_type: request.model.startsWith("kling-v3-0") ? "customize" : undefined,
          seed: -1,
        };
    const result = await submitWavespeedPrediction(model, input);
    const outputUrl = outputsFromResult(result)[0];
    const providerJobId = taskIdFromResult(result);

    return {
      provider: this.name,
      model,
      status: outputUrl ? "succeeded" : "queued",
      providerJobId,
      asset: videoAssetFromUrl(outputUrl, providerJobId),
      costEstimateCents: estimateVideoGenerationPricing(request).tokens,
      raw: result,
    };
  }

  async poll(providerJobId: string): Promise<VideoGenerationResult> {
    const result = await getWavespeedPrediction(providerJobId);
    const outputUrl = outputsFromResult(result)[0];
    return {
      provider: this.name,
      model: firstString(result.data?.model, result.model) ?? "wavespeed",
      status: normalizeVideoStatus(statusFromResult(result)),
      providerJobId,
      asset: videoAssetFromUrl(outputUrl, providerJobId),
      costEstimateCents: 0,
      raw: result,
    };
  }
}

export class WavespeedAvatarProvider {
  name = "wavespeed" as const;

  async submit(request: AvatarGenerationRequest): Promise<AvatarGenerationResult> {
    const client = wavespeedClient();
    const image = request.image
      ? await uploadProviderInput(client, request.image, "image")
      : request.imageUrl;
    const audio = request.audio
      ? await uploadProviderInput(client, request.audio, "audio")
      : request.audioUrl;

    if (!image || !audio) {
      throw new Error("InfiniteTalk requires both an image and audio input.");
    }

    const model = request.model ?? "wavespeed-ai/longcat-avatar";
    const result = await submitWavespeedPrediction(model, {
      image,
      audio,
      prompt: request.prompt || undefined,
      resolution: request.resolution,
      seed: request.seed ?? -1,
      mask_image: request.maskImageUrl,
    });
    const outputUrl = outputsFromResult(result)[0];
    const providerJobId = taskIdFromResult(result);

    return {
      provider: this.name,
      model,
      status: outputUrl ? "succeeded" : "queued",
      providerJobId,
      asset: videoAssetFromUrl(outputUrl, providerJobId),
      costEstimateCents: estimateAvatarGenerationPricing(request).tokens,
      raw: result,
    };
  }
}

function wavespeedClient() {
  if (!env.wavespeedApiKey) {
    throw new Error("WAVESPEED_API_KEY is not configured. WaveSpeed API generation is not connected.");
  }

  return new Client(env.wavespeedApiKey, {
    connectionTimeout: 20,
    timeout: 90,
    maxRetries: 1,
    maxConnectionRetries: 1,
    retryInterval: 1,
  });
}

async function uploadProviderImages(client: Client, images: ProviderImageInput[]) {
  const urls: string[] = [];
  for (const image of images) {
    urls.push(await uploadProviderInput(client, image, "image"));
  }
  return urls;
}

async function uploadProviderInput(client: Client, input: ProviderImageInput | ProviderMediaInput, fallbackKind: "image" | "audio" | "video") {
  const bytes = Buffer.from(input.data, "base64");
  const extension = extensionFromMimeType(input.mimeType, fallbackKind);
  const tempDir = join(tmpdir(), "persona-studio-wavespeed");
  const tempPath = join(tempDir, `${randomUUID()}.${extension}`);

  await mkdir(tempDir, { recursive: true });
  await writeFile(tempPath, bytes);
  try {
    return await client.upload(tempPath, { timeout: 30 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function wavespeedImageModel(model: string, hasReferences: boolean) {
  if (model === WAN_2_7_IMAGE_MODEL_ID || model === WAN_2_7_IMAGE_EDIT_MODEL_ID) {
    return hasReferences ? "alibaba/wan-2.7/image-edit" : "alibaba/wan-2.7/text-to-image";
  }
  if (model === "gpt-image-2") return hasReferences ? "openai/gpt-image-2/edit" : "openai/gpt-image-2/text-to-image";
  if (model === SEEDREAM_4_5_MODEL_ID) return hasReferences ? "bytedance/seedream-v4.5/edit" : "bytedance/seedream-v4.5";
  if (model === "gemini-3-pro-image") {
    return hasReferences ? "google/nano-banana-pro/edit" : "google/nano-banana-pro/text-to-image";
  }
  throw new Error(`WaveSpeed image model is not allowlisted: ${model}`);
}

function wan27ImageSize(aspectRatio: string, imageSize: string) {
  const dimensions: Record<string, Record<string, string>> = {
    "1:1": { "1K": "1024*1024", "2K": "2048*2048" },
    "16:9": { "1K": "1344*768", "2K": "2048*1152" },
    "9:16": { "1K": "768*1344", "2K": "1152*2048" },
    "4:3": { "1K": "1152*864", "2K": "2048*1536" },
    "3:4": { "1K": "864*1152", "2K": "1536*2048" },
    "3:2": { "1K": "1248*832", "2K": "2016*1344" },
    "2:3": { "1K": "832*1248", "2K": "1344*2016" },
  };
  return dimensions[aspectRatio]?.[imageSize] ?? dimensions["1:1"]["1K"];
}

function wavespeedVideoModel(request: VideoGenerationRequest) {
  if (request.model === "kling-v3-0-motion-std") return "kwaivgi/kling-v3.0-std/motion-control";
  if (request.model === "kling-v3-0-motion-pro") return "kwaivgi/kling-v3.0-pro/motion-control";
  if (isSeedanceModel(request.model)) {
    const base = request.model.includes("fast") ? "bytedance/seedance-2.0-fast" : "bytedance/seedance-2.0";
    if (request.referenceVideoUrl || request.referenceVideo || request.referenceAudioUrl || request.referenceAudio) {
      return `${base}/text-to-video`;
    }
    if (request.endFrameImageUrl || request.endFrameImage) return `${base}/image-to-video`;
    return request.startFrameImageUrl || request.startFrameImage || request.referenceImageUrl ? `${base}/image-to-video` : `${base}/text-to-video`;
  }
  if (request.model === "wan-2.7") {
    return request.startFrameImageUrl || request.startFrameImage || request.referenceImageUrl
      ? "alibaba/wan-2.7/image-to-video"
      : "alibaba/wan-2.7/text-to-video";
  }
  if (request.model === "wan-animate") {
    return "wavespeed-ai/wan-2.2/animate";
  }
  if (request.model.startsWith("kling")) {
    const mode = request.startFrameImageUrl || request.startFrameImage || request.referenceImageUrl ? "image-to-video" : "text-to-video";
    if (request.model === "kling-v3" || request.model === "kling-v3-0" || request.model.startsWith("kling-v3-0")) {
      if (request.resolution === "4K" || request.model === "kling-v3-0-4k") return `kwaivgi/kling-v3.0-4k/${mode}`;
      return `kwaivgi/kling-v3.0-${request.model === "kling-v3-0-pro" || request.providerMode === "pro" ? "pro" : "std"}/${mode}`;
    }
    return `kwaivgi/kling-v2.6-${request.model === "kling-v2-6-pro" || request.providerMode === "pro" || request.endFrameImageUrl || request.endFrameImage ? "pro" : "std"}/${mode}`;
  }
  throw new Error(`WaveSpeed video model is not allowlisted: ${request.model}`);
}

async function submitWavespeedPrediction(model: string, input: Record<string, unknown>) {
  return wavespeedApiRequest(`${WAVESPEED_API_BASE_URL}/api/v3/${model}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function getWavespeedPrediction(providerJobId: string) {
  if (!/^[A-Za-z0-9_-]{6,200}$/.test(providerJobId)) {
    throw new Error("Invalid WaveSpeed job ID.");
  }
  return wavespeedApiRequest(
    `${WAVESPEED_API_BASE_URL}/api/v3/predictions/${encodeURIComponent(providerJobId)}/result`,
    { method: "GET" },
  );
}

async function wavespeedApiRequest(url: string, init: RequestInit): Promise<WavespeedRunResult> {
  if (!env.wavespeedApiKey) throw new Error("WAVESPEED_API_KEY is not configured.");
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.wavespeedApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(WAVESPEED_REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({})) as WavespeedRunResult & { message?: string };
  if (!response.ok) {
    throw new Error(`WaveSpeed request failed (${response.status}): ${payload.message ?? "provider error"}`);
  }
  return payload;
}

function isSeedanceModel(model: string) {
  return model.includes("seedance");
}

function seedream45Size(aspectRatio: string, imageSize: string) {
  const recommendedDimensions: Record<string, [number, number]> = {
    "1:1": [2048, 2048],
    "16:9": [2560, 1440],
    "9:16": [1440, 2560],
    "4:3": [2688, 2016],
    "3:4": [2016, 2688],
    "3:2": [2688, 1792],
    "2:3": [1792, 2688],
  };
  const [recommendedWidth, recommendedHeight] = recommendedDimensions[aspectRatio] ?? recommendedDimensions["1:1"];
  if (imageSize !== "4K") return `${recommendedWidth}*${recommendedHeight}`;

  const scale = 4096 / Math.max(recommendedWidth, recommendedHeight);
  const width = Math.round(recommendedWidth * scale / 16) * 16;
  const height = Math.round(recommendedHeight * scale / 16) * 16;
  return `${width}*${height}`;
}

function outputsFromResult(result: WavespeedRunResult) {
  const rawOutputs = result.outputs ?? result.data?.outputs;
  if (Array.isArray(rawOutputs)) {
    return rawOutputs
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return firstString(record.url, record.video_url, record.image_url, record.audio_url);
        }
        return undefined;
      })
      .filter((url): url is string => Boolean(url));
  }
  if (typeof rawOutputs === "string") return [rawOutputs];
  return [];
}

function taskIdFromResult(result: WavespeedRunResult) {
  return firstString(result.id, result.taskId, result.requestId, result.data?.id) ?? `wavespeed-${Date.now()}`;
}

function statusFromResult(result: WavespeedRunResult) {
  return firstString(result.status, result.data?.status) ?? "completed";
}

function mimeTypeFromUrl(url: string, fallback: string) {
  const normalized = url.split("?")[0].toLowerCase();
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  return fallback;
}

function extensionFromMimeType(mimeType: string, fallbackKind: "image" | "audio" | "video") {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime") || mimeType.includes("mov")) return "mov";
  if (fallbackKind === "video") return "mp4";
  return fallbackKind === "audio" ? "mp3" : "png";
}
