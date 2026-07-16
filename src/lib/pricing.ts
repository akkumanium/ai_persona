import type {
  AvatarGenerationRequest,
  ImageGenerationRequest,
  SpeechGenerationRequest,
  VideoGenerationRequest,
} from "@/lib/providers/types";
import { WAN_2_7_IMAGE_EDIT_MODEL_ID, WAN_2_7_IMAGE_MODEL_ID } from "@/lib/image-model-options";

export const TOKENS_PER_USD = 100;
const USD_CENTS_PER_DOLLAR = 100;
const FLOATING_POINT_EPSILON = 1e-9;

export type PricingBreakdown = {
  rawUsd: number;
  tokens: number;
  notes?: string;
};

export const LONGCAT_AVATAR_MAX_DURATION_SECONDS = 120;
export const INFINITETALK_MAX_DURATION_SECONDS = 600;

export function usdToTokens(rawUsd: number) {
  const chargeCents = Math.ceil(Math.max(0, rawUsd) * USD_CENTS_PER_DOLLAR - FLOATING_POINT_EPSILON);
  return Math.max(1, Math.ceil((chargeCents * TOKENS_PER_USD) / USD_CENTS_PER_DOLLAR - FLOATING_POINT_EPSILON));
}

export function estimateImageGenerationPricing(request: ImageGenerationRequest): PricingBreakdown {
  const referenceCount = request.referenceImages?.length ?? 0;
  const count = Math.max(1, request.count);

  if (request.model === "gpt-image-2") {
    const outputUsd = gptImage2OutputUsd(request.imageQuality, request.imageSize, referenceCount);
    return {
      rawUsd: outputUsd * count,
      tokens: usdToTokens(outputUsd * count),
      notes: request.imageQuality === "auto" ? "Auto quality is billed as medium for pre-generation estimates." : undefined,
    };
  }

  if (request.model === "seedream-v4.5") {
    const rawUsd = 0.04 * count;
    return {
      rawUsd,
      tokens: usdToTokens(rawUsd),
    };
  }

  if (request.model === WAN_2_7_IMAGE_MODEL_ID || request.model === WAN_2_7_IMAGE_EDIT_MODEL_ID) {
    const rawUsd = 0.03 * count;
    return {
      rawUsd,
      tokens: usdToTokens(rawUsd),
    };
  }

  if (request.model !== "gemini-3-pro-image") {
    throw new Error(`No authorized price is configured for image model ${request.model}.`);
  }
  if (referenceCount > 0 && count > 1) {
    const rawUsd = 0.07 * count;
    return {
      rawUsd,
      tokens: usdToTokens(rawUsd),
      notes: "Nano Banana Pro multi-output edit pricing.",
    };
  }
  const outputUsd = nanoBananaOutputUsd(request.imageSize);
  const inputUsd = referenceCount * 0.0011;
  const rawUsd = outputUsd * count + inputUsd;
  return {
    rawUsd,
    tokens: usdToTokens(rawUsd),
  };
}

export function estimateVideoGenerationPricing(request: VideoGenerationRequest): PricingBreakdown {
  const model = request.model;
  const duration = Math.max(1, Math.round(request.durationSeconds));

  if (model === "kling-v3" || model === "kling-v3-0" || model.startsWith("kling-v3-0-")) {
    if (model.startsWith("kling-v3-0-motion")) {
      const billedSeconds = Math.min(30, Math.max(3, duration));
      const perSecondUsd = model.endsWith("pro") ? 0.168 : 0.126;
      return {
        rawUsd: perSecondUsd * billedSeconds,
        tokens: usdToTokens(perSecondUsd * billedSeconds),
      };
    }
    const perSecondUsd = kling30PerSecondUsd(request);
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
    };
  }

  if (model === "kling" || model.startsWith("kling-")) {
    const rawUsd = kling26GenerationUsd(request);
    return {
      rawUsd,
      tokens: usdToTokens(rawUsd),
    };
  }

  if (model === "wan-2.7") {
    const perSecondUsd = request.resolution === "1080p" ? 0.15 : 0.1;
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
    };
  }

  if (model === "wan-animate") {
    const billedSeconds = Math.min(120, Math.max(5, Math.ceil(duration)));
    const perSecondUsd = request.resolution === "480p" ? 0.04 : 0.08;
    return {
      rawUsd: perSecondUsd * billedSeconds,
      tokens: usdToTokens(perSecondUsd * billedSeconds),
      notes: "Wan Animate is billed with a 5 second minimum and 120 second cap.",
    };
  }

  if (model === "seedance" || model.includes("seedance")) {
    const perSecondUsd = seedancePerSecondUsd(request);
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
    };
  }

  throw new Error(`No authorized price is configured for video model ${model}.`);
}

export function estimateSpeechGenerationPricing(request: Pick<SpeechGenerationRequest, "text">): PricingBreakdown {
  const rawUsd = Math.max(1, request.text.length) * 0.1 / 1000;
  return {
    rawUsd,
    tokens: usdToTokens(rawUsd),
  };
}

export function estimateAvatarGenerationPricing(
  request: Pick<AvatarGenerationRequest, "durationSeconds" | "resolution" | "model">,
): PricingBreakdown {
  if (!["wavespeed-ai/longcat-avatar", "wavespeed-ai/infinitetalk"].includes(request.model ?? "")) {
    throw new Error(`No authorized price is configured for avatar model ${request.model}.`);
  }
  const maximumDurationSeconds = avatarMaximumDurationSeconds(request.model);
  const billedSeconds = Math.min(maximumDurationSeconds, Math.max(5, Math.ceil(request.durationSeconds)));
  const isLongcat = request.model === "wavespeed-ai/longcat-avatar";
  const perSecondUsd = request.resolution === "720p"
    ? isLongcat ? 0.08 : 0.06
    : isLongcat ? 0.04 : 0.03;
  const rawUsd = perSecondUsd * billedSeconds;
  return {
    rawUsd,
    tokens: usdToTokens(rawUsd),
    notes: `${isLongcat ? "Longcat Avatar" : "InfiniteTalk"} is billed with a 5 second minimum and ${isLongcat ? "2 minute" : "10 minute"} cap.`,
  };
}

export function avatarMaximumDurationSeconds(model: AvatarGenerationRequest["model"]) {
  if (model === "wavespeed-ai/longcat-avatar") return LONGCAT_AVATAR_MAX_DURATION_SECONDS;
  if (model === "wavespeed-ai/infinitetalk") return INFINITETALK_MAX_DURATION_SECONDS;
  throw new Error(`No authorized duration limit is configured for avatar model ${model}.`);
}

function nanoBananaOutputUsd(imageSize: string) {
  if (imageSize === "4K") return 0.24;
  return 0.134;
}

function gptImage2OutputUsd(
  quality: ImageGenerationRequest["imageQuality"],
  imageSize: string,
  referenceCount: number,
) {
  const effectiveQuality = quality === "auto" || !quality ? "medium" : quality;
  const effectiveSize = imageSize === "4K" ? "4K" : imageSize === "1K" ? "1K" : "2K";
  const textToImagePrices: Record<string, Record<string, number>> = {
    low: { "1K": 0.01, "2K": 0.02, "4K": 0.03 },
    medium: { "1K": 0.06, "2K": 0.07, "4K": 0.11 },
    high: { "1K": 0.22, "2K": 0.23, "4K": 0.41 },
  };
  const editPrices: Record<string, Record<string, number>> = {
    low: { "1K": 0.02, "2K": 0.03, "4K": 0.04 },
    medium: { "1K": 0.07, "2K": 0.08, "4K": 0.12 },
    high: { "1K": 0.22, "2K": 0.24, "4K": 0.42 },
  };

  if (referenceCount > 0) {
    return editPrices[effectiveQuality][effectiveSize] + Math.max(0, referenceCount - 1) * 0.012;
  }

  return textToImagePrices[effectiveQuality][effectiveSize];
}

function kling26GenerationUsd(request: VideoGenerationRequest) {
  const durationMultiplier = request.durationSeconds >= 10 ? 2 : 1;
  const isPro =
    request.model === "kling-v2-6-pro" ||
    request.providerMode === "pro" ||
    Boolean(request.endFrameImageUrl || request.endFrameImage);
  const baseUsd = isPro ? 0.35 : 0.21;
  const soundMultiplier = isPro && request.generateAudio ? 2 : 1;
  return baseUsd * durationMultiplier * soundMultiplier;
}

function kling30PerSecondUsd(request: VideoGenerationRequest) {
  if (request.resolution === "4K" || request.model === "kling-v3-0-4k") return 0.42;
  if (request.providerMode === "pro" || request.model === "kling-v3-0-pro") {
    return request.generateAudio ? 0.168 : 0.112;
  }

  return request.generateAudio ? 0.126 : 0.084;
}

function seedancePerSecondUsd(request: VideoGenerationRequest) {
  const isFast = request.model.includes("fast");
  if (isFast) {
    if (request.resolution === "1080p") return 0.5;
    if (request.resolution === "480p") return 0.1;
    return 0.2;
  }

  if (request.resolution === "1080p") return 0.6;
  if (request.resolution === "480p") return 0.12;
  return 0.24;
}
