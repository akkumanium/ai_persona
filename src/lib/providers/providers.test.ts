import { describe, expect, it } from "vitest";
import { MODEL_REGISTRY, modelsForCapability } from "@/lib/model-registry";
import { mockImageGeneration, mockVideoGeneration } from "@/lib/providers/mock";

describe("model registry", () => {
  it("keeps Kling out of the active provider registry", () => {
    expect(MODEL_REGISTRY.every((model) => model.provider !== "kling")).toBe(true);
  });

  it("exposes Wan Animate for motion-control video", () => {
    expect(modelsForCapability("video-motion").map((model) => model.id)).toContain("wan-animate");
  });
});

describe("provider fallbacks", () => {
  it("returns generated image assets in demo mode", async () => {
    const result = await mockImageGeneration({
      prompt: "Create a reference avatar.",
      model: "gemini-3-pro-image-preview",
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
