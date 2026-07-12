import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { imageProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import type { ImageGenerationRequest, ProviderImageInput } from "@/lib/providers/types";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import { promptForReferenceSlot } from "@/lib/reference-prompts";
import { imageGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { markPendingGenerationJobFailed, persistGenerationRecords, persistPendingGenerationJob, recordProviderAcceptance } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "generate-image", limit: 20, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = imageGenerationSchema.parse(await readJsonRequest(request));

    const referenceUrlCount =
      input.referenceImageUrls.length ||
      (input.referenceImageUrl ? 1 : 0);
    const totalReferenceCount =
      input.sourceImages.length +
      input.sourceImageUrls.length +
      referenceUrlCount;

    // Fail fast on insufficient balance BEFORE resolving/downloading any reference media,
    // so an underfunded account returns 402 instantly instead of after long network work.
    await assertSufficientTokens(
      auth.user?.id,
      Math.max(
        1,
        estimateImageGenerationPricing({
          prompt: input.prompt,
          model: input.model,
          aspectRatio: input.aspectRatio,
          imageSize: input.imageSize,
          imageQuality: input.imageQuality,
          count: input.count,
          referenceImages: Array.from({ length: totalReferenceCount }, (_, index) => ({
            name: `reference-${index + 1}`,
            mimeType: "image/png",
            data: "x",
          })),
          generationType: totalReferenceCount > 0 ? "image_from_reference" : "image_from_prompt",
        }).tokens,
      ),
    );

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
      ? input.prompt.trim() || promptForReferenceSlot(input.referenceSlot)
      : input.prompt.trim();

    if (basePrompt.length < 10) {
      return NextResponse.json({ error: "Prompt must be at least 10 characters." }, { status: 400 });
    }

    const finalPrompt = [basePrompt, input.additionalPrompt.trim()].filter(Boolean).join("\n");
    const visiblePrompt = basePrompt;

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
    const createdAt = nowIso();
    const inputParams = {
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
      hiddenPromptUsed: false,
    };
    await persistPendingGenerationJob({
      userId: auth.user?.id,
      job: {
        id: jobId,
        status: "queued",
        provider: imageProvider.name,
        model: input.model,
        generationType,
        prompt: visiblePrompt,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        createdAt,
        updatedAt: createdAt,
      },
      inputParams,
    });
    let providerCompleted = false;
    try {
      await reserveTokens(
        auth.user?.id,
        estimatedPricing.tokens,
        jobId,
        `${generationType.replaceAll("_", " ")} generation`,
      );

      // Once the provider accepts the generation attempt, provider-side failures
      // (including safety filters) remain billable. Only failures in our processing
      // after a successful provider response are refunded.
      const result = await imageProvider.generate(providerRequest);
      providerCompleted = true;
      await recordProviderAcceptance({ userId: auth.user?.id, jobId, raw: result.raw });
      const updatedAt = nowIso();
      const assets: Asset[] = await Promise.all(result.assets.map(async (asset, index) => materializeGeneratedAsset({
        id: crypto.randomUUID(),
        kind: input.assetKind,
        title: "",
        prompt: visiblePrompt,
        personaId: input.personaId,
        referenceAssetIds: input.referenceAssetIds.length ? input.referenceAssetIds : undefined,
        referenceSlot: input.referenceSlot,
        isDefaultReference: input.assetKind === "avatar" ? input.isDefaultReference && index === 0 : false,
        generationType,
        provider: result.provider,
        model: result.model,
        createdAt: updatedAt,
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
        updatedAt,
      };

      await persistGenerationRecords({
        userId: auth.user?.id,
        assets,
        job,
        inputParams,
      });

      return NextResponse.json({
        assets,
        job,
      });
    } catch (error) {
      if (!providerCompleted) await markPendingGenerationJobFailed({ userId: auth.user?.id, jobId, error }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 500 },
    );
  }
}
