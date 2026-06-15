import type {
  AvatarGenerationRequest,
  ImageGenerationRequest,
  SpeechGenerationRequest,
  VideoGenerationRequest,
} from "@/lib/providers/types";

export const TOKENS_PER_USD = 1000;

export type PricingBreakdown = {
  rawUsd: number;
  tokens: number;
  notes?: string;
};

export function usdToTokens(rawUsd: number) {
  return Math.max(1, Math.ceil(rawUsd * TOKENS_PER_USD - 1e-9));
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
      notes: "Wan 2.2 Animate is billed with a 5 second minimum and 120 second cap.",
    };
  }

  if (model === "wan-2.2") {
    const perSecondUsd = request.resolution === "480p" ? 0.03 : 0.06;
    return {
      rawUsd: perSecondUsd * duration,
      tokens: usdToTokens(perSecondUsd * duration),
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

export function estimateSpeechGenerationPricing(request: Pick<SpeechGenerationRequest, "text">): PricingBreakdown {
  const rawUsd = Math.max(1, request.text.length) * 0.1 / 1000;
  return {
    rawUsd,
    tokens: usdToTokens(rawUsd),
  };
}

export function estimateAvatarGenerationPricing(
  request: Pick<AvatarGenerationRequest, "durationSeconds" | "resolution">,
): PricingBreakdown {
  const billedSeconds = Math.min(600, Math.max(5, Math.ceil(request.durationSeconds)));
  const perSecondUsd = request.resolution === "720p" ? 0.06 : 0.03;
  const rawUsd = perSecondUsd * billedSeconds;
  return {
    rawUsd,
    tokens: usdToTokens(rawUsd),
    notes: "InfiniteTalk is billed with a 5 second minimum and 10 minute cap.",
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
