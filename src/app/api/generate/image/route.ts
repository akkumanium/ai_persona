import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { imageProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import type { ImageGenerationRequest, ProviderImageInput } from "@/lib/providers/types";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import { promptForReferenceSlot } from "@/lib/reference-prompts";
import { imageGenerationSchema } from "@/lib/schemas";
import { sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { markPendingGenerationJobFailed, persistPendingGenerationJob, recordProviderAcceptance } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, getTokenBalance, InsufficientTokensError, refundTokens, reserveTokens, shouldRefundUnsubmittedGeneration } from "@/lib/server/token-billing";
import type { GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  let userId: string | undefined;
  let responseBalanceTokens: number | undefined;
  try {
    const rateLimited = await rateLimitRequest(request, { key: "generate-image", limit: 20, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    userId = auth.user?.id;

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
    const baseProviderRequest: ImageGenerationRequest = {
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
    // Nano Banana's multi endpoint supports fewer aspect ratios than its
    // standard endpoint, so Nano candidates use independent standard jobs.
    const supportsNativeMultiOutput = input.model === "seedream-v4.5";
    const providerRequests = supportsNativeMultiOutput || input.count === 1
      ? [baseProviderRequest]
      : Array.from({ length: input.count }, () => ({ ...baseProviderRequest, count: 1 }));
    const jobs: GenerationJob[] = [];

    for (const providerRequest of providerRequests) {
      const estimatedPricing = estimateImageGenerationPricing(providerRequest);
      const jobId = crypto.randomUUID();
      const createdAt = nowIso();
      const inputParams = {
        prompt: visiblePrompt,
        personaName: input.personaName,
        additionalPrompt: input.additionalPrompt.trim(),
        model: input.model,
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        count: providerRequest.count,
        requestedCount: input.count,
        assetKind: input.assetKind,
        referenceSlot: input.referenceSlot,
        referenceAssetIds: input.referenceAssetIds,
        isDefaultReference: input.isDefaultReference,
        titlePrefix: input.titlePrefix,
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
      let tokensReserved = false;
      let providerContactAttempted = false;
      try {
        responseBalanceTokens = await reserveTokens(
          auth.user?.id,
          estimatedPricing.tokens,
          jobId,
          `${generationType.replaceAll("_", " ")} generation`,
        );
        tokensReserved = true;
        const result = await imageProvider.submit({
          ...providerRequest,
          onProviderContact: () => { providerContactAttempted = true; },
        });
        await recordProviderAcceptance({ userId: auth.user?.id, jobId, providerJobId: result.providerJobId, raw: result.raw });
        const updatedAt = nowIso();
        jobs.push({
          id: jobId,
          status: "running",
          provider: result.provider,
          providerJobId: result.providerJobId,
          model: result.model,
          generationType,
          prompt: visiblePrompt,
          personaId: input.personaId,
          referenceAssetIds: input.referenceAssetIds,
          costEstimateCents: estimatedPricing.tokens,
          rawProviderResponse: sanitizeProviderPayload(result.raw),
          createdAt,
          updatedAt,
        });
      } catch (error) {
        await markPendingGenerationJobFailed({ userId: auth.user?.id, jobId, error }).catch(() => undefined);
        if (shouldRefundUnsubmittedGeneration(tokensReserved, providerContactAttempted)) {
          responseBalanceTokens = await refundTokens(
            auth.user?.id,
            estimatedPricing.tokens,
            jobId,
            `${generationType.replaceAll("_", " ")} refund: provider was not contacted`,
          );
        }
        if (!jobs.length) throw error;
        break;
      }
    }

    return NextResponse.json({
      assets: [],
      job: jobs[0],
      jobs,
      providerJobId: jobs[0]?.providerJobId,
      balanceTokens: responseBalanceTokens,
      warning: jobs.length < providerRequests.length
        ? `${jobs.length} of ${providerRequests.length} generation jobs were accepted. Try the remaining candidates again after the active jobs finish.`
        : undefined,
    }, { status: 202 });
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message, balanceTokens: error.balanceTokens }, { status: 402 });
    }

    responseBalanceTokens ??= await getTokenBalance(userId).catch(() => undefined);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed.", balanceTokens: responseBalanceTokens },
      { status: 500 },
    );
  }
}
