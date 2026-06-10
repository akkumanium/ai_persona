import type { ImageGenerationRequest, VideoGenerationRequest } from "@/lib/providers/types";

export const TOKENS_PER_USD = 1000;

export type PricingBreakdown = {
  rawUsd: number;
  tokens: number;
  notes?: string;
};

export function usdToTokens(rawUsd: number) {
  return Math.max(1, Math.ceil(rawUsd * TOKENS_PER_USD - Number.EPSILON));
}

export function estimateImageGenerationPricing(request: ImageGenerationRequest): PricingBreakdown {
  const referenceCount = request.referenceImages?.length ?? 0;
  const count = Math.max(1, request.count);

  if (request.model === "gpt-image-2") {
    const outputUsd = gptImage2OutputUsd(request.imageQuality, request.aspectRatio);
    return {
      rawUsd: outputUsd * count,
      tokens: usdToTokens(outputUsd * count),
      notes: request.imageQuality === "auto" ? "Auto quality is billed as medium for pre-generation estimates." : undefined,
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

  if (model === "kling-v3" || model === "kling-v3-0" || model === "kling-v3-0-4k") {
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
    const perSecondUsd = request.resolution === "1080p" ? 0.09 : 0.06;
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
    };
  }

  if (model === "wan-2.2" || model === "wan-animate") {
    const rawUsd = request.resolution === "480p" ? 0.03 : 0.06;
    return {
      rawUsd,
      tokens: usdToTokens(rawUsd),
      notes: "Wan 2.2 pricing uses the PoYo Fast generation price. Fal pricing is intentionally ignored.",
    };
  }

  if (model === "seedance" || model.includes("seedance")) {
    const perSecondUsd = seedancePerSecondUsd(request);
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
    };
  }

  return {
    rawUsd: 0.06 * duration,
    tokens: usdToTokens(0.06 * duration),
  };
}

function nanoBananaOutputUsd(imageSize: string) {
  if (imageSize === "4K") return 0.24;
  return 0.134;
}

function gptImage2OutputUsd(quality: ImageGenerationRequest["imageQuality"], aspectRatio: string) {
  const effectiveQuality = quality === "auto" || !quality ? "medium" : quality;
  const isSquare = aspectRatio === "1:1";

  if (effectiveQuality === "low") return isSquare ? 0.006 : 0.005;
  if (effectiveQuality === "high") return isSquare ? 0.211 : 0.165;
  return isSquare ? 0.053 : 0.041;
}

function kling26GenerationUsd(request: VideoGenerationRequest) {
  const durationMultiplier = request.durationSeconds >= 10 ? 2 : 1;
  if (request.generateAudio) return 0.6 * durationMultiplier;
  return 0.325 * durationMultiplier;
}

function kling30PerSecondUsd(request: VideoGenerationRequest) {
  if (request.resolution === "4K" || request.model === "kling-v3-0-4k") return 0.25;
  if (request.providerMode === "pro" || request.resolution === "1080p" || request.endFrameImageUrl) {
    return request.generateAudio ? 0.245 : 0.195;
  }

  return request.generateAudio ? 0.195 : 0.135;
}

function seedancePerSecondUsd(request: VideoGenerationRequest) {
  const isFast = request.model.includes("fast");
  if (isFast) return request.resolution === "480p" ? 0.07 : 0.14;

  if (request.resolution === "1080p") return 0.45;
  if (request.resolution === "480p") return 0.1;
  return 0.2;
}
