import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "wavespeed";
import { env } from "@/lib/env";
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
    const referenceUrls = await uploadProviderImages(client, request.referenceImages ?? []);
    const model = wavespeedImageModel(request.model, referenceUrls.length > 0);
    const result = await client.run(model, {
      prompt: request.prompt,
      image: referenceUrls[0],
      images: referenceUrls.length ? referenceUrls : undefined,
      image_url: referenceUrls[0],
      image_urls: referenceUrls.length ? referenceUrls : undefined,
      aspect_ratio: request.aspectRatio,
      size: request.imageSize,
      image_size: request.imageSize,
      quality: request.imageQuality,
      num_outputs: request.count,
    }, {
      pollInterval: 2,
      timeout: 36000,
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
    const model = wavespeedVideoModel(request);
    const result = await client.run(model, {
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
    }, {
      pollInterval: 5,
      timeout: 36000,
    }) as WavespeedRunResult;
    const outputUrl = outputsFromResult(result)[0];
    const providerJobId = taskIdFromResult(result);

    return {
      provider: this.name,
      model,
      status: normalizeVideoStatus(statusFromResult(result)),
      providerJobId,
      asset: videoAssetFromUrl(outputUrl, providerJobId),
      costEstimateCents: estimateVideoGenerationPricing(request).tokens,
      raw: result,
    };
  }

  async poll(providerJobId: string): Promise<VideoGenerationResult> {
    return {
      provider: this.name,
      model: "wavespeed",
      status: "succeeded",
      providerJobId,
      costEstimateCents: 0,
      raw: { providerJobId },
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

    const model = request.model ?? "wavespeed-ai/infinitetalk";
    const result = await client.run(model, {
      image,
      audio,
      prompt: request.prompt || undefined,
      resolution: request.resolution,
      seed: request.seed ?? -1,
      mask_image: request.maskImageUrl,
    }, {
      pollInterval: 5,
      timeout: 36000,
    }) as WavespeedRunResult;
    const outputUrl = outputsFromResult(result)[0];
    const providerJobId = taskIdFromResult(result);

    return {
      provider: this.name,
      model,
      status: normalizeVideoStatus(statusFromResult(result)),
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
    maxRetries: 1,
    maxConnectionRetries: 5,
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
    return await client.upload(tempPath, { timeout: 600 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function wavespeedImageModel(model: string, hasReferences: boolean) {
  if (model.includes("/")) return model;
  if (model === "gpt-image-2") return hasReferences ? "openai/gpt-image-2/edit" : "openai/gpt-image-2/text-to-image";
  return hasReferences ? "google/nano-banana-pro/edit" : "google/nano-banana-pro/text-to-image";
}

function wavespeedVideoModel(request: VideoGenerationRequest) {
  if (request.model.includes("/")) return request.model;
  if (request.model === "kling-v3-0-motion-std") return "kwaivgi/kling-v3.0-std/motion-control";
  if (request.model === "kling-v3-0-motion-pro") return "kwaivgi/kling-v3.0-pro/motion-control";
  if (request.model.includes("seedance")) {
    const base = request.model.includes("fast") ? "bytedance/seedance-2.0-fast" : "bytedance/seedance-2.0";
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
  return request.model;
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
