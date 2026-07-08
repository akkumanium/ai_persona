import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { motionControlsForModel } from "@/lib/model-registry";
import { mediaUrlToProviderInput } from "@/lib/providers/media-inputs";
import { videoProvider } from "@/lib/providers";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import { videoGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { persistGenerationRecords, persistPendingGenerationJob } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError, refundTokens, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const rateLimited = rateLimitRequest(request, { key: "generate-video", limit: 12, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const parsedInput = videoGenerationSchema.parse(await readJsonRequest(request));
    const motionControls = motionControlsForModel(parsedInput.model);
    const input = parsedInput.mode === "motion"
      ? {
          ...parsedInput,
          negativePrompt: motionControls.supportsNegativePrompt ? parsedInput.negativePrompt : "",
          motionReference: motionControls.supportsMotionReference ? parsedInput.motionReference : "",
          motionMode: motionControls.supportsMotionMode ? parsedInput.motionMode : "animate",
          characterOrientation: motionControls.supportsCharacterOrientation ? parsedInput.characterOrientation : "video",
          keepOriginalSound: motionControls.supportsKeepOriginalSound ? parsedInput.keepOriginalSound : false,
        }
      : parsedInput;
    const generationType =
      input.mode === "motion"
        ? "video_motion"
        : input.startFrameImageUrl || input.startFrameImage || input.referenceImageUrl
          ? "video_normal"
          : "video_prompt";
    // Fail fast on insufficient balance BEFORE resolving any reference video media,
    // so an underfunded account returns 402 instantly instead of after long downloads.
    await assertSufficientTokens(auth.user?.id, Math.max(1, estimateVideoGenerationPricing(input).tokens));

    const motionReferenceVideo =
      input.motionReferenceVideo ??
      (input.motionReferenceVideoUrl
        ? await mediaUrlToProviderInput(input.motionReferenceVideoUrl, `${input.personaName}-motion-reference`, auth.user?.id)
        : undefined);
    const estimatedPricing = estimateVideoGenerationPricing(input);
    const jobId = crypto.randomUUID();
    const createdAt = nowIso();
    await persistPendingGenerationJob({
      userId: auth.user?.id,
      job: {
        id: jobId,
        status: "queued",
        provider: videoProvider.name,
        model: input.model,
        generationType,
        prompt: input.prompt,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        createdAt,
        updatedAt: createdAt,
      },
      inputParams: input,
    });
    await reserveTokens(
      auth.user?.id,
      estimatedPricing.tokens,
      jobId,
      `${generationType.replaceAll("_", " ")} generation`,
    );

    try {
      const result = await videoProvider.submit({
        ...input,
        motionReferenceVideo,
      });
      const updatedAt = nowIso();
      const asset: Asset | undefined = result.asset
        ? await materializeGeneratedAsset({
            id: crypto.randomUUID(),
            kind: "video",
            title: `${input.personaName} ${input.mode} video`,
            prompt: input.prompt,
            personaId: input.personaId,
            referenceAssetIds: input.referenceAssetIds.length ? input.referenceAssetIds : undefined,
            generationType,
            provider: result.provider,
            providerJobId: result.providerJobId,
            model: result.model,
            createdAt: updatedAt,
            ...result.asset,
          }, auth.user?.id)
        : undefined;
      const job: GenerationJob = {
        id: jobId,
        status: result.status,
        provider: result.provider,
        providerJobId: result.providerJobId,
        model: result.model,
        generationType,
        prompt: input.prompt,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        rawProviderResponse: sanitizeProviderPayload(result.raw),
        createdAt,
        updatedAt,
      };

      await persistGenerationRecords({
        userId: auth.user?.id,
        assets: asset ? [asset] : [],
        job,
        inputParams: input,
      });

      return NextResponse.json({
        asset,
        job,
        providerJobId: result.providerJobId,
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
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 500 },
    );
  }
}
