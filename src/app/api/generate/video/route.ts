import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { motionControlsForModel } from "@/lib/model-registry";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import { mediaUrlToProviderInput } from "@/lib/providers/media-inputs";
import { videoProvider } from "@/lib/providers";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import { videoGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { markPendingGenerationJobFailed, persistGenerationRecords, persistPendingGenerationJob, recordProviderAcceptance } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "generate-video", limit: 12, windowMs: 60 * 1000 });
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

    const startFrameImage = input.startFrameImage ?? (input.startFrameImageUrl
      ? await imageUrlToProviderInput(input.startFrameImageUrl, `${input.personaName}-start-frame`, auth.user?.id)
      : input.referenceImageUrl
        ? await imageUrlToProviderInput(input.referenceImageUrl, `${input.personaName}-reference`, auth.user?.id)
        : undefined);
    const endFrameImage = input.endFrameImage ?? (input.endFrameImageUrl
      ? await imageUrlToProviderInput(input.endFrameImageUrl, `${input.personaName}-end-frame`, auth.user?.id)
      : undefined);
    const motionReferenceVideo =
      input.motionReferenceVideo ??
      (input.motionReferenceVideoUrl
        ? await mediaUrlToProviderInput(input.motionReferenceVideoUrl, `${input.personaName}-motion-reference`, auth.user?.id)
        : undefined);
    const referenceVideo = input.referenceVideo ?? (input.referenceVideoUrl
      ? await mediaUrlToProviderInput(input.referenceVideoUrl, `${input.personaName}-reference-video`, auth.user?.id)
      : undefined);
    const referenceAudio = input.referenceAudio ?? (input.referenceAudioUrl
      ? await mediaUrlToProviderInput(input.referenceAudioUrl, `${input.personaName}-reference-audio`, auth.user?.id)
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
    let providerCompleted = false;
    try {
      await reserveTokens(
        auth.user?.id,
        estimatedPricing.tokens,
        jobId,
        `${generationType.replaceAll("_", " ")} generation`,
      );

      const result = await videoProvider.submit({
        ...input,
        referenceImageUrl: undefined,
        startFrameImageUrl: undefined,
        endFrameImageUrl: undefined,
        motionReferenceVideoUrl: undefined,
        referenceVideoUrl: undefined,
        referenceAudioUrl: undefined,
        startFrameImage,
        endFrameImage,
        motionReferenceVideo,
        referenceVideo,
        referenceAudio,
      });
      providerCompleted = true;
      await recordProviderAcceptance({ userId: auth.user?.id, jobId, providerJobId: result.providerJobId, raw: result.raw });
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
      }, { status: result.status === "queued" || result.status === "running" ? 202 : 200 });
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
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 500 },
    );
  }
}
