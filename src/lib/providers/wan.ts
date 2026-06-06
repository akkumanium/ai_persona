import { env } from "@/lib/env";
import { mockVideoGeneration } from "@/lib/providers/mock";
import { normalizeVideoStatus, videoAssetFromUrl } from "@/lib/providers/video-utils";
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
        image_url: request.startFrameImageUrl || request.referenceImageUrl || undefined,
        end_image_url: request.endFrameImageUrl || undefined,
        mode: request.mode,
        duration: request.durationSeconds,
        aspect_ratio: request.aspectRatio,
        negative_prompt: request.negativePrompt || undefined,
        cfg_scale: request.cfgScale,
        quality_mode: request.providerMode,
        generate_audio: request.generateAudio,
        resolution: request.resolution,
        return_last_frame: request.returnLastFrame,
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
      status: normalizeVideoStatus(json.status),
      providerJobId: String(json.id ?? json.job_id ?? json.task_id),
      asset: videoAssetFromUrl(json.video_url ?? json.url, json.asset_id ?? json.id ?? json.job_id),
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
      status: normalizeVideoStatus(json.status),
      providerJobId,
      asset: videoAssetFromUrl(json.video_url ?? json.url, json.asset_id ?? providerJobId),
      costEstimateCents: 0,
      raw: json,
    };
  }
}
