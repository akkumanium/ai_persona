import { describe, expect, it } from "vitest";
import { modelsForCapability } from "@/lib/model-registry";
import { avatarMaximumDurationSeconds, estimateAvatarGenerationPricing, estimateImageGenerationPricing, estimateVideoGenerationPricing, usdToTokens } from "@/lib/pricing";
import { mockImageGeneration, mockVideoGeneration } from "@/lib/providers/mock";
import { wavespeedImageInput } from "@/lib/providers/wavespeed";

describe("model registry", () => {
  it("includes ChatGPT for image generation", () => {
    expect(modelsForCapability("image-prompt").map((model) => model.id)).toEqual(
      expect.arrayContaining(["gpt-image-2", "seedream-v4.5", "wan-2.7-image"]),
    );
    expect(modelsForCapability("image-reference").map((model) => model.id)).toEqual(
      expect.arrayContaining(["gpt-image-2", "seedream-v4.5", "wan-2.7-image"]),
    );
    expect(modelsForCapability("image-reference").map((model) => model.id)).not.toEqual(
      expect.arrayContaining(["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "wan-2.7-image-edit"]),
    );
  });

  it("includes Wan and adapter video models for video generation", () => {
    expect(modelsForCapability("video-normal").map((model) => model.id)).toEqual(
      expect.arrayContaining([
        "wan-2.7",
        "kling-v2-6-std",
        "kling-v2-6-pro",
        "kling-v3-0-std",
        "kling-v3-0-pro",
        "kling-v3-0-4k",
        "dreamina-seedance-2-0-260128",
        "dreamina-seedance-2-0-fast-260128",
      ]),
    );
    expect(modelsForCapability("video-normal").map((model) => model.id)).not.toContain("wan-animate");
  });

  it("exposes WaveSpeed motion-control video models", () => {
    expect(modelsForCapability("video-motion").map((model) => model.id)).toEqual(
      expect.arrayContaining(["wan-animate", "kling-v3-0-motion-std", "kling-v3-0-motion-pro"]),
    );
  });
});

describe("token pricing", () => {
  it("rounds USD charges up to cents before converting to tokens", () => {
    expect(usdToTokens(0.001)).toBe(1);
    expect(usdToTokens(0.231)).toBe(24);
  });

  it("prices GPT Image 2 by quality, size, and count", () => {
    expect(
      estimateImageGenerationPricing({
        prompt: "Generate an editorial image.",
        model: "gpt-image-2",
        aspectRatio: "1:1",
        imageSize: "2K",
        imageQuality: "high",
        count: 2,
        generationType: "image_from_prompt",
      }).tokens,
    ).toBe(46);

    expect(
      estimateImageGenerationPricing({
        prompt: "Generate a vertical image.",
        model: "gpt-image-2",
        aspectRatio: "9:16",
        imageSize: "4K",
        imageQuality: "medium",
        count: 1,
        generationType: "image_from_prompt",
      }).tokens,
    ).toBe(11);

    expect(
      estimateImageGenerationPricing({
        prompt: "Edit a vertical image.",
        model: "gpt-image-2",
        aspectRatio: "9:16",
        imageSize: "2K",
        imageQuality: "medium",
        count: 1,
        referenceImages: [
          { name: "source", mimeType: "image/png", data: "x" },
          { name: "style", mimeType: "image/png", data: "x" },
        ],
        generationType: "image_from_reference",
      }).tokens,
    ).toBe(10);
  });

  it("prices Seedream 4.5 per generated image", () => {
    expect(
      estimateImageGenerationPricing({
        prompt: "Generate a typography-led campaign image.",
        model: "seedream-v4.5",
        aspectRatio: "16:9",
        imageSize: "2K",
        count: 1,
        generationType: "image_from_prompt",
      }).tokens,
    ).toBe(4);
  });

  it("prices Wan 2.7 image generation per output", () => {
    expect(
      estimateImageGenerationPricing({
        prompt: "Generate a clean creator portrait.",
        model: "wan-2.7-image",
        aspectRatio: "9:16",
        imageSize: "1K",
        count: 2,
        generationType: "image_from_prompt",
      }).tokens,
    ).toBe(6);

    expect(
      estimateImageGenerationPricing({
        prompt: "Edit a clean creator portrait.",
        model: "wan-2.7-image-edit",
        aspectRatio: "9:16",
        imageSize: "1K",
        count: 1,
        referenceImages: [{ name: "source", mimeType: "image/png", data: "x" }],
        generationType: "image_from_reference",
      }).tokens,
    ).toBe(3);
  });

  it("prices Wan 2.7 and Kling 3.0 per second without Fal pricing", () => {
    expect(
      estimateVideoGenerationPricing({
        prompt: "Create a short clip.",
        model: "wan-2.7",
        mode: "normal",
        durationSeconds: 5,
        aspectRatio: "9:16",
        resolution: "1080p",
      }).tokens,
    ).toBe(75);

    expect(
      estimateVideoGenerationPricing({
        prompt: "Create a premium clip.",
        model: "kling-v3-0-pro",
        mode: "normal",
        durationSeconds: 10,
        aspectRatio: "9:16",
        generateAudio: true,
        resolution: "1080p",
      }).tokens,
    ).toBe(168);
  });

  it("uses separate Longcat and InfiniteTalk duration caps", () => {
    expect(avatarMaximumDurationSeconds("wavespeed-ai/longcat-avatar")).toBe(120);
    expect(avatarMaximumDurationSeconds("wavespeed-ai/infinitetalk")).toBe(600);

    expect(estimateAvatarGenerationPricing({
      model: "wavespeed-ai/longcat-avatar",
      resolution: "480p",
      durationSeconds: 600,
    })).toMatchObject({ rawUsd: 4.8, tokens: 480 });

    expect(estimateAvatarGenerationPricing({
      model: "wavespeed-ai/infinitetalk",
      resolution: "480p",
      durationSeconds: 600,
    })).toMatchObject({ rawUsd: 18, tokens: 1800 });
  });

  it("keeps the five-second avatar billing minimum", () => {
    expect(estimateAvatarGenerationPricing({
      model: "wavespeed-ai/longcat-avatar",
      resolution: "720p",
      durationSeconds: 1,
    })).toMatchObject({ rawUsd: 0.4, tokens: 40 });
  });
});

describe("provider fallbacks", () => {
  it("returns generated image assets in demo mode", async () => {
    const result = await mockImageGeneration({
      prompt: "Create a reference avatar.",
      model: "gemini-3-pro-image",
      aspectRatio: "4:5",
      imageSize: "2K",
      count: 2,
      generationType: "avatar_prompt",
    });

    expect(result.provider).toBe("demo");
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0].url).toContain("data:image/svg+xml");
  });

  it("returns a completed Wan-compatible video job in demo mode", async () => {
    const result = await mockVideoGeneration({
      prompt: "Make a short creator clip.",
      model: "wan-animate",
      mode: "motion",
      referenceImageUrl: "https://example.com/reference.png",
      durationSeconds: 5,
      aspectRatio: "9:16",
      motionReference: "slow camera turn",
    });

    expect(result.status).toBe("succeeded");
    expect(result.model).toBe("wan-animate");
    expect(result.asset?.mimeType).toBe("video/mp4");
  });
});

describe("WaveSpeed image inputs", () => {
  it("uses the Wan 2.7 edit schema without unsupported image aliases", () => {
    expect(wavespeedImageInput({
      prompt: "Change the shirt to red.",
      referenceUrls: ["https://provider.example/source.png"],
      aspectRatio: "9:16",
      imageSize: "1K",
      count: 1,
      isChatGptImage: false,
      isSeedream45: false,
      isWan27Image: true,
    })).toEqual({
      prompt: "Change the shirt to red.",
      images: ["https://provider.example/source.png"],
      size: "768*1344",
      seed: -1,
    });
  });
});
