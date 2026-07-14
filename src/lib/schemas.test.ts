import { describe, expect, it } from "vitest";
import { talkingAvatarGenerationSchema, videoGenerationSchema } from "@/lib/schemas";

const requiredVideoInput = {
  personaId: "persona-1",
  personaName: "Test Persona",
  model: "kling-v3-0-motion-std",
  startFrameImageUrl: "/api/media/object?bucket=uploads&path=user/start.png",
};

describe("videoGenerationSchema", () => {
  it("allows motion-control generation without a prompt", () => {
    const result = videoGenerationSchema.safeParse({
      ...requiredVideoInput,
      mode: "motion",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.prompt).toBe("");
  });

  it("allows an explicitly empty motion-control prompt", () => {
    expect(videoGenerationSchema.safeParse({
      ...requiredVideoInput,
      mode: "motion",
      prompt: "",
    }).success).toBe(true);
  });

  it("still requires at least 10 prompt characters for normal generation", () => {
    const result = videoGenerationSchema.safeParse({
      ...requiredVideoInput,
      model: "wan-2.7",
      mode: "normal",
      prompt: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["prompt"]);
  });

  it("rejects arbitrary provider model identifiers", () => {
    expect(videoGenerationSchema.safeParse({
      ...requiredVideoInput,
      model: "attacker/expensive-model",
      mode: "motion",
    }).success).toBe(false);
  });
});

describe("talkingAvatarGenerationSchema", () => {
  it("rejects a non-audio uploaded media type", () => {
    const result = talkingAvatarGenerationSchema.safeParse({
      personaId: "persona-1",
      personaName: "Test Persona",
      imageAssetUrl: "/api/media/object?bucket=uploads&path=user/portrait.png",
      uploadedAudio: {
        name: "clip.mp4",
        mimeType: "video/mp4",
        url: "/api/media/object?bucket=uploads&path=user/clip.mp4",
      },
      model: "wavespeed-ai/longcat-avatar",
      resolution: "480p",
      durationSeconds: 10,
    });

    expect(result.success).toBe(false);
  });
});
