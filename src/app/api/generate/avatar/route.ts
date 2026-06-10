import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { imageProvider } from "@/lib/providers";
import type { ImageGenerationRequest } from "@/lib/providers/types";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import { DEFAULT_PROMPTS, promptForReferenceSlot } from "@/lib/reference-prompts";
import { avatarGenerationSchema } from "@/lib/schemas";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError } from "@/lib/server/token-billing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = avatarGenerationSchema.parse(await request.json());

    if (!input.confirmsRights || !input.confirmsAdultPersona) {
      return NextResponse.json(
        { error: "Rights and adult-persona confirmations are required." },
        { status: 400 },
      );
    }

    if (input.mode === "blend" && input.sourceImages.length < 2) {
      return NextResponse.json(
        { error: "Blend mode requires at least two source images." },
        { status: 400 },
      );
    }

    if (input.mode === "normalization" && input.sourceImages.length < 1) {
      return NextResponse.json(
        { error: "Normalization mode requires at least one reference image." },
        { status: 400 },
      );
    }

    const basePrompt =
      input.mode === "blend"
        ? DEFAULT_PROMPTS.hybrid
        : input.prompt.trim() || promptForReferenceSlot(input.referenceSlot);
    if (input.mode === "prompt" && basePrompt.trim().length < 10) {
      return NextResponse.json({ error: "Prompt must be at least 10 characters." }, { status: 400 });
    }
    const finalPrompt = [basePrompt, input.additionalPrompt.trim()].filter(Boolean).join("\n");

    const generationType =
      input.mode === "blend"
        ? "avatar_image_blend"
        : input.mode === "normalization"
          ? "avatar_normalization"
          : "avatar_prompt";
    const referenceImages = input.mode === "prompt" ? [] : input.sourceImages;
    const referenceImageNames = referenceImages.map((image) => image.name).filter(Boolean).join(", ");

    const providerRequest: ImageGenerationRequest = {
      prompt: [
        finalPrompt,
        `Persona name: ${input.personaName}.`,
        input.description ? `Persona description: ${input.description}.` : "",
        input.styleNotes ? `Style notes: ${input.styleNotes}.` : "",
        input.mode === "blend"
          ? `Blend these uploaded source concepts into one unique face: ${referenceImageNames}.`
          : "",
        input.mode === "normalization"
          ? "Normalize the uploaded reference image into a clean, high-fidelity avatar while preserving identity."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      model: input.model,
      aspectRatio: input.aspectRatio,
      imageSize: input.imageSize,
      imageQuality: input.imageQuality,
      count: input.count,
      referenceImages,
      generationType,
    };
    const estimatedPricing = estimateImageGenerationPricing(providerRequest);
    await assertSufficientTokens(auth.user?.id, estimatedPricing.tokens);

    const result = await imageProvider.generate(providerRequest);

    const createdAt = nowIso();
    const personaId = input.personaId ?? crypto.randomUUID();
    const visiblePrompt = input.mode === "prompt" && input.prompt.trim() ? input.prompt.trim() : input.additionalPrompt.trim();
    const assets: Asset[] = result.assets.map((asset, index) => ({
      id: crypto.randomUUID(),
      kind: "avatar",
      title: input.titlePrefix ?? `${input.personaName} reference ${index + 1}`,
      prompt: visiblePrompt,
      personaId,
      referenceAssetIds: input.referenceAssetIds.length ? input.referenceAssetIds : undefined,
      referenceSlot: input.referenceSlot,
      isDefaultReference: input.isDefaultReference && index === 0,
      generationType,
      provider: result.provider,
      model: result.model,
      createdAt,
      ...asset,
    }));
    const persona: Persona = {
      id: personaId,
      name: input.personaName,
      description: input.description,
      styleNotes: input.styleNotes,
      status: "active",
      referenceAssetId: assets[0]?.id,
      createdAt,
    };
    const job: GenerationJob = {
      id: crypto.randomUUID(),
      status: "succeeded",
      provider: result.provider,
      model: result.model,
      generationType,
      prompt: visiblePrompt,
      personaId,
      costEstimateCents: estimatedPricing.tokens,
      rawProviderResponse: result.raw,
      createdAt,
      updatedAt: createdAt,
    };

    await persistGenerationRecords({
      userId: auth.user?.id,
      assets,
      job,
      inputParams: {
        prompt: visiblePrompt,
        additionalPrompt: input.additionalPrompt.trim(),
        mode: input.mode,
        model: input.model,
        referenceSlot: input.referenceSlot,
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        count: input.count,
        hiddenPromptUsed: !input.prompt.trim() || input.mode !== "prompt",
      },
    });

    return NextResponse.json({
      persona,
      assets,
      job,
    });
  } catch (error) {
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Avatar generation failed." },
      { status: 500 },
    );
  }
}
