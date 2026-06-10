import { env } from "@/lib/env";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "@/lib/providers/types";
import { firstString, normalizeVideoStatus, providerUrl, videoAssetFromUrl } from "@/lib/providers/video-utils";

export class SeedanceVideoProvider implements VideoProvider {
  name = "seedance" as const;

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!env.seedanceApiKey) {
      throw new Error("SEEDANCE_API_KEY is not configured. Seedance API generation is not connected.");
    }

    const startFrame = request.startFrameImageUrl || request.referenceImageUrl;
    const content: Record<string, unknown>[] = [
      {
        type: "text",
        text: request.prompt,
      },
    ];

    if (startFrame) {
      content.push({
        type: "image_url",
        image_url: { url: startFrame },
        role: "first_frame",
      });
    }

    if (request.endFrameImageUrl) {
      content.push({
        type: "image_url",
        image_url: { url: request.endFrameImageUrl },
        role: "last_frame",
      });
    }

    const response = await fetch(providerUrl(env.seedanceApiBaseUrl, "/api/v3/contents/generations/tasks"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.seedanceApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: normalizeSeedanceModel(request.model),
        content,
        duration: normalizeSeedanceDuration(request.durationSeconds),
        ratio: normalizeSeedanceRatio(request.aspectRatio),
        resolution: request.resolution ?? "720p",
        generate_audio: request.generateAudio ?? false,
        return_last_frame: request.returnLastFrame ?? Boolean(request.endFrameImageUrl),
        watermark: false,
      }),
    });

    const json = await response.json();
    if (!response.ok || json?.error) {
      throw new Error(firstString(json?.error?.message, json?.message) ?? "Seedance video generation failed.");
    }

    return this.toResult(request, json);
  }

  async poll(providerJobId: string): Promise<VideoGenerationResult> {
    if (!env.seedanceApiKey) {
      throw new Error("SEEDANCE_API_KEY is not configured. Seedance API polling is not connected.");
    }

    const response = await fetch(
      providerUrl(env.seedanceApiBaseUrl, `/api/v3/contents/generations/tasks/${providerJobId}`),
      {
        headers: {
          Authorization: `Bearer ${env.seedanceApiKey}`,
        },
      },
    );

    const json = await response.json();
    if (!response.ok || json?.error) {
      throw new Error(firstString(json?.error?.message, json?.message) ?? "Seedance video poll failed.");
    }

    return this.toResult(
      {
        prompt: "Seedance poll result",
        model: firstString(json?.model) ?? env.seedanceModel,
        mode: "normal",
        durationSeconds: Number(json?.duration ?? 5),
        aspectRatio: firstString(json?.ratio) ?? "9:16",
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
    const content = asRecord(json.content);
    const providerJobId = firstString(json.id, json.task_id, fallbackJobId) ?? `seedance-${Date.now()}`;
    const status = normalizeVideoStatus(json.status);

    return {
      provider: this.name,
      model: normalizeSeedanceModel(request.model),
      status,
      providerJobId,
      asset: videoAssetFromUrl(content?.video_url ?? json.video_url, providerJobId),
      costEstimateCents: estimateVideoGenerationPricing(request).tokens,
      raw: json,
    };
  }
}

function normalizeSeedanceModel(model: string) {
  return model === "seedance" ? env.seedanceModel : model;
}

function normalizeSeedanceDuration(durationSeconds: number) {
  return Math.max(4, Math.min(15, Math.round(durationSeconds)));
}

function normalizeSeedanceRatio(aspectRatio: string) {
  if (aspectRatio === "auto") return "adaptive";
  return ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"].includes(aspectRatio) ? aspectRatio : "9:16";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}
