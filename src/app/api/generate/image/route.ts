import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { imageProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import type { ImageGenerationRequest, ProviderImageInput } from "@/lib/providers/types";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import { promptForReferenceSlot } from "@/lib/reference-prompts";
import { imageGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { InsufficientTokensError, refundTokens, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = imageGenerationSchema.parse(await request.json());
    const referenceUrls = [
      ...(input.referenceImageUrls.length
        ? input.referenceImageUrls
        : input.referenceImageUrl
          ? [input.referenceImageUrl]
          : []),
      ...input.sourceImageUrls,
    ];
    const urlReferenceImages = referenceUrls.length
      ? (
          await Promise.all(
            referenceUrls.map((url, index) =>
              imageUrlToProviderInput(url, `${input.personaName}-reference-${index + 1}`, auth.user?.id),
            ),
          )
        ).filter((image): image is ProviderImageInput => Boolean(image))
      : [];
    const referenceImages = [...input.sourceImages, ...urlReferenceImages];
    const generationType = referenceImages.length ? "image_from_reference" : "image_from_prompt";
    const isReferenceAvatar = input.assetKind === "avatar" && Boolean(input.referenceSlot);
    const basePrompt = isReferenceAvatar && input.referenceSlot
      ? promptForReferenceSlot(input.referenceSlot)
      : input.prompt.trim();

    if (basePrompt.length < 10) {
      return NextResponse.json({ error: "Prompt must be at least 10 characters." }, { status: 400 });
    }

    const finalPrompt = [basePrompt, input.additionalPrompt.trim()].filter(Boolean).join("\n");

    const providerRequest: ImageGenerationRequest = {
      prompt: [
        finalPrompt,
        referenceImages.length ? `Keep facial identity consistent with reference persona ${input.personaName}.` : "",
        input.styleNotes ? `Style notes: ${input.styleNotes}.` : "",
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
    const jobId = crypto.randomUUID();
    await reserveTokens(
      auth.user?.id,
      estimatedPricing.tokens,
      jobId,
      `${generationType.replaceAll("_", " ")} generation`,
    );

    try {
      const result = await imageProvider.generate(providerRequest);
      const createdAt = nowIso();
      const visiblePrompt = isReferenceAvatar ? input.additionalPrompt.trim() : input.prompt.trim();
      const assets: Asset[] = await Promise.all(result.assets.map(async (asset, index) => materializeGeneratedAsset({
        id: crypto.randomUUID(),
        kind: input.assetKind,
        title:
          input.titlePrefix ??
          (input.assetKind === "avatar"
            ? `${input.personaName} reference ${index + 1}`
            : `${input.personaName} image ${index + 1}`),
        prompt: visiblePrompt,
        personaId: input.personaId,
        referenceAssetIds: input.referenceAssetIds.length ? input.referenceAssetIds : undefined,
        referenceSlot: input.referenceSlot,
        isDefaultReference: input.assetKind === "avatar" ? input.isDefaultReference && index === 0 : false,
        generationType,
        provider: result.provider,
        model: result.model,
        createdAt,
        ...asset,
      }, auth.user?.id)));
      const job: GenerationJob = {
        id: jobId,
        status: "succeeded",
        provider: result.provider,
        model: result.model,
        generationType,
        prompt: visiblePrompt,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        rawProviderResponse: sanitizeProviderPayload(result.raw),
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
          model: input.model,
          aspectRatio: input.aspectRatio,
          imageSize: input.imageSize,
          imageQuality: input.imageQuality,
          count: input.count,
          assetKind: input.assetKind,
          referenceSlot: input.referenceSlot,
          referenceAssetIds: input.referenceAssetIds,
          hiddenPromptUsed: isReferenceAvatar,
        },
      });

      return NextResponse.json({
        assets,
        job,
      });
    } catch (error) {
      await refundTokens(
        auth.user?.id,
        estimatedPricing.tokens,
        jobId,
        `${generationType.replaceAll("_", " ")} refund`,
      );
      throw error;
    }
  } catch (error) {
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 500 },
    );
  }
}
