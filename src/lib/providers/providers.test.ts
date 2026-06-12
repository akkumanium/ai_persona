import { describe, expect, it } from "vitest";
import { modelsForCapability } from "@/lib/model-registry";
import { estimateImageGenerationPricing, estimateVideoGenerationPricing } from "@/lib/pricing";
import { mockImageGeneration, mockVideoGeneration } from "@/lib/providers/mock";

describe("model registry", () => {
  it("includes ChatGPT for image generation", () => {
    expect(modelsForCapability("image-reference").map((model) => model.id)).toContain("gpt-image-2");
    expect(modelsForCapability("image-reference").map((model) => model.id)).not.toEqual(
      expect.arrayContaining(["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"]),
    );
  });

  it("includes Wan and adapter video models for video generation", () => {
    expect(modelsForCapability("video-normal").map((model) => model.id)).toEqual(
      expect.arrayContaining([
        "wan-2.2",
        "wan-2.7",
        "wan-animate",
        "kling-v2-6",
        "kling-v3-0",
        "dreamina-seedance-2-0-260128",
        "dreamina-seedance-2-0-fast-260128",
      ]),
    );
  });

  it("exposes Wan Animate for motion-control video", () => {
    expect(modelsForCapability("video-motion").map((model) => model.id)).toContain("wan-animate");
  });
});

describe("token pricing", () => {
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
    ).toBe(422);

    expect(
      estimateImageGenerationPricing({
        prompt: "Generate a vertical image.",
        model: "gpt-image-2",
        aspectRatio: "9:16",
        imageSize: "2K",
        imageQuality: "medium",
        count: 1,
        generationType: "image_from_prompt",
      }).tokens,
    ).toBe(41);
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
    ).toBe(750);

    expect(
      estimateVideoGenerationPricing({
        prompt: "Create a premium clip.",
        model: "kling-v3-0",
        mode: "normal",
        durationSeconds: 10,
        aspectRatio: "9:16",
        providerMode: "pro",
        generateAudio: true,
        resolution: "1080p",
      }).tokens,
    ).toBe(1680);
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
