import { env } from "@/lib/env";
import { mockVideoGeneration } from "@/lib/providers/mock";
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "@/lib/providers/types";

export class WanVideoProvider implements VideoProvider {
  name = "wan" as const;

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!env.wanApiBaseUrl || !env.wanApiKey) {
      return mockVideoGeneration(request);
    }

    const response = await fetch(`${env.wanApiBaseUrl.replace(/\/$/, "")}/v1/video/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.wanApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        image_url: request.referenceImageUrl || undefined,
        mode: request.mode,
        duration: request.durationSeconds,
        aspect_ratio: request.aspectRatio,
        motion_reference: request.motionReference || undefined,
        motion_reference_video: request.motionReferenceVideo
          ? {
              name: request.motionReferenceVideo.name,
              mime_type: request.motionReferenceVideo.mimeType,
              data: request.motionReferenceVideo.data,
            }
          : undefined,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "Wan video generation failed.");
    }

    return {
      provider: this.name,
      model: request.model,
      status: normalizeStatus(json.status),
      providerJobId: String(json.id ?? json.job_id ?? json.task_id),
      asset: json.video_url
        ? {
            url: json.video_url,
            mimeType: "video/mp4",
            providerAssetId: String(json.asset_id ?? json.id ?? json.job_id),
          }
        : undefined,
      costEstimateCents: request.mode === "motion" ? 95 : 70,
      raw: json,
    };
  }

  async poll(providerJobId: string): Promise<VideoGenerationResult> {
    if (!env.wanApiBaseUrl || !env.wanApiKey) {
      return mockVideoGeneration({
        prompt: "Demo poll result",
        model: "wan-animate",
        mode: "motion",
        referenceImageUrl: "",
        durationSeconds: 5,
        aspectRatio: "9:16",
      });
    }

    const response = await fetch(
      `${env.wanApiBaseUrl.replace(/\/$/, "")}/v1/video/generations/${providerJobId}`,
      {
        headers: {
          Authorization: `Bearer ${env.wanApiKey}`,
        },
      },
    );

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "Wan video poll failed.");
    }

    return {
      provider: this.name,
      model: String(json.model ?? "wan-animate"),
      status: normalizeStatus(json.status),
      providerJobId,
      asset: json.video_url
        ? {
            url: json.video_url,
            mimeType: "video/mp4",
            providerAssetId: String(json.asset_id ?? providerJobId),
          }
        : undefined,
      costEstimateCents: 0,
      raw: json,
    };
  }
}

function normalizeStatus(status: unknown) {
  const value = String(status ?? "queued").toLowerCase();
  if (["success", "succeeded", "completed", "complete"].includes(value)) {
    return "succeeded" as const;
  }
  if (["failed", "error", "cancelled", "canceled"].includes(value)) {
    return "failed" as const;
  }
  if (["running", "processing", "in_progress"].includes(value)) {
    return "running" as const;
  }
  return "queued" as const;
}
