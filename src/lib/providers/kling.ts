import { env } from "@/lib/env";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "@/lib/providers/types";
import { firstString, normalizeVideoStatus, providerUrl, videoAssetFromUrl } from "@/lib/providers/video-utils";

type KlingTaskVideo = {
  id?: string;
  url?: string;
};

export class KlingVideoProvider implements VideoProvider {
  name = "kling" as const;

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!env.klingApiKey) {
      throw new Error("KLING_API_KEY is not configured. Kling API generation is not connected.");
    }

    const startFrame = request.startFrameImageUrl || request.referenceImageUrl;
    if (!startFrame) {
      throw new Error("Kling image-to-video requires a start frame image.");
    }

    const duration = normalizeKlingDuration(request.model, request.durationSeconds);
    const mode = request.endFrameImageUrl ? "pro" : (request.providerMode ?? "std");

    const response = await fetch(providerUrl(env.klingApiBaseUrl, "/v1/videos/image2video"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.klingApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: normalizeKlingModel(request.model),
        image: startFrame,
        image_tail: request.endFrameImageUrl || undefined,
        prompt: request.prompt,
        negative_prompt: request.negativePrompt || undefined,
        mode,
        duration,
        aspect_ratio: normalizeKlingAspectRatio(request.aspectRatio),
        resolution: request.resolution,
        cfg_scale: request.cfgScale ?? 0.5,
        sound: request.generateAudio ? "on" : "off",
      }),
    });

    const json = await response.json();
    if (!response.ok || isKlingError(json)) {
      throw new Error(klingErrorMessage(json) ?? "Kling video generation failed.");
    }

    return this.toResult(request, json);
  }

  async poll(providerJobId: string): Promise<VideoGenerationResult> {
    if (!env.klingApiKey) {
      throw new Error("KLING_API_KEY is not configured. Kling API polling is not connected.");
    }

    const response = await fetch(providerUrl(env.klingApiBaseUrl, `/v1/videos/image2video/${providerJobId}`), {
      headers: {
        Authorization: `Bearer ${env.klingApiKey}`,
      },
    });

    const json = await response.json();
    if (!response.ok || isKlingError(json)) {
      throw new Error(klingErrorMessage(json) ?? "Kling video poll failed.");
    }

    return this.toResult(
      {
        prompt: "Kling poll result",
        model: firstString(json?.data?.model_name, json?.model_name, json?.model) ?? env.klingModel,
        mode: "normal",
        durationSeconds: Number(json?.data?.duration ?? json?.duration ?? 5),
        aspectRatio: firstString(json?.data?.aspect_ratio, json?.aspect_ratio) ?? "9:16",
      },
      json,
      providerJobId,
    );
  }

  private toResult(
    request: VideoGenerationRequest,
    json: Record<string, unknown>,
    fallbackJobId?: string,
  ): VideoGenerationResult {
    const data = asRecord(json.data);
    const taskResult = asRecord(data?.task_result ?? json.task_result);
    const videos = Array.isArray(taskResult?.videos)
      ? (taskResult.videos as KlingTaskVideo[])
      : Array.isArray(data?.videos)
        ? (data.videos as KlingTaskVideo[])
        : undefined;
    const firstVideo = videos?.[0];
    const videoUrl = firstString(
      firstVideo?.url,
      taskResult?.video_url,
      taskResult?.url,
      data?.video_url,
      data?.url,
      json.video_url,
      json.url,
    );
    const providerJobId =
      firstString(data?.task_id, data?.id, json.task_id, json.id, fallbackJobId) ?? `kling-${Date.now()}`;
    const status = normalizeVideoStatus(data?.task_status ?? data?.status ?? json.task_status ?? json.status);

    return {
      provider: this.name,
      model: normalizeKlingModel(request.model),
      status,
      providerJobId,
      asset: videoAssetFromUrl(videoUrl, firstVideo?.id ?? providerJobId),
      costEstimateCents: estimateVideoGenerationPricing(request).tokens,
      raw: json,
    };
  }
}

function normalizeKlingModel(model: string) {
  return model === "kling" ? env.klingModel : model;
}

function normalizeKlingDuration(model: string, durationSeconds: number) {
  if (model === "kling-v3-0" || model === "kling-v3-0-4k" || model === "kling-v3") {
    return String(Math.max(1, Math.min(15, Math.round(durationSeconds))));
  }

  return durationSeconds >= 10 ? "10" : "5";
}

function normalizeKlingAspectRatio(aspectRatio: string) {
  return ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "9:16";
}

function isKlingError(json: Record<string, unknown>) {
  const code = json.code ?? asRecord(json.data)?.code;
  return code !== undefined && ![0, "0"].includes(code as 0 | "0");
}

function klingErrorMessage(json: Record<string, unknown>) {
  const data = asRecord(json.data);
  const error = asRecord(json.error ?? data?.error);
  return firstString(error?.message, json.message, data?.message, data?.task_status_msg);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}
