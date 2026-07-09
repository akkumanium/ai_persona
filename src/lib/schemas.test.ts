import { describe, expect, it } from "vitest";
import { videoGenerationSchema } from "@/lib/schemas";

const requiredVideoInput = {
  personaId: "persona-1",
  personaName: "Test Persona",
  model: "kling-3.0-motion-control-standard",
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
      mode: "normal",
      prompt: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["prompt"]);
  });
});
