import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { avatarProvider, imageProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import { mediaUrlToProviderInput } from "@/lib/providers/media-inputs";
import type { AvatarGenerationRequest, ImageGenerationRequest, ProviderImageInput } from "@/lib/providers/types";
import { estimateAvatarGenerationPricing, estimateImageGenerationPricing } from "@/lib/pricing";
import { DEFAULT_PROMPTS, promptForReferenceSlot } from "@/lib/reference-prompts";
import { avatarGenerationSchema, talkingAvatarGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { markPendingGenerationJobFailed, persistGenerationRecords, persistPendingGenerationJob, recordProviderAcceptance } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, getTokenBalance, InsufficientTokensError, refundTokens, reserveTokens, shouldRefundUnsubmittedGeneration } from "@/lib/server/token-billing";
import type { Asset, GenerationJob, GenerationType } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const rateLimited = await rateLimitRequest(request, { key: "generate-avatar", limit: 20, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    userId = auth.user?.id;

    const body = await readJsonRequest(request);
    if (body && typeof body === "object" && "mode" in body) {
      return await generateAvatarReference(body, auth.user?.id);
    }

    return await generateTalkingAvatar(body, auth.user?.id);
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message, balanceTokens: error.balanceTokens }, { status: 402 });
    }

    const balanceTokens = await getTokenBalance(userId).catch(() => undefined);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Avatar generation failed.", balanceTokens },
      { status: 500 },
    );
  }
}

async function generateAvatarReference(body: unknown, userId?: string) {
  const input = avatarGenerationSchema.parse(body);
  if (!input.confirmsRights || !input.confirmsAdultPersona) {
    return NextResponse.json({ error: "Identity rights and adult-persona confirmations are required." }, { status: 400 });
  }

  const sourceCount = input.sourceImages.length + input.sourceImageUrls.length;

  if (input.mode === "blend" && sourceCount < 2) {
    return NextResponse.json({ error: "Blend mode requires two source face images." }, { status: 400 });
  }
  if (input.mode === "normalization" && sourceCount < 1) {
    return NextResponse.json({ error: "Normalization requires a source image." }, { status: 400 });
  }

  const generationType: GenerationType =
    input.mode === "blend"
      ? "avatar_image_blend"
      : input.mode === "normalization"
        ? "avatar_normalization"
        : "avatar_prompt";
  const basePrompt =
    input.mode === "blend"
      ? input.prompt.trim() || DEFAULT_PROMPTS.hybrid
      : input.prompt.trim() || promptForReferenceSlot(input.referenceSlot);
  const finalPrompt = [
    basePrompt,
    input.additionalPrompt.trim(),
    input.description ? `Persona description: ${input.description}.` : "",
    input.styleNotes ? `Style notes: ${input.styleNotes}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (finalPrompt.trim().length < 10) {
    return NextResponse.json({ error: "Prompt must be at least 10 characters." }, { status: 400 });
  }

  // Fail fast on insufficient balance BEFORE resolving/downloading any source media,
  // so an underfunded account returns 402 instantly instead of after long network work.
  await assertSufficientTokens(
    userId,
    Math.max(
      1,
      estimateImageGenerationPricing({
        prompt: finalPrompt,
        model: input.model,
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        count: input.count,
        referenceImages: Array.from({ length: sourceCount }, (_, index) => ({
          name: `reference-${index + 1}`,
          mimeType: "image/png",
          data: "x",
        })),
        generationType,
      }).tokens,
    ),
  );

  const urlReferences = await Promise.all(
    input.sourceImageUrls.map((url, index) =>
      imageUrlToProviderInput(url, `${input.personaName}-source-${index + 1}`, userId),
    ),
  );
  const referenceImages: ProviderImageInput[] = [
    ...input.sourceImages,
    ...urlReferences.filter((image): image is ProviderImageInput => Boolean(image)),
  ];

  const providerRequest: ImageGenerationRequest = {
    prompt: finalPrompt,
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
  const visiblePrompt = basePrompt;
  const inputParams = {
    mode: input.mode,
    personaId: input.personaId,
    personaName: input.personaName,
    prompt: visiblePrompt,
    additionalPrompt: input.additionalPrompt.trim(),
    model: input.model,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    imageQuality: input.imageQuality,
    count: input.count,
    referenceSlot: input.referenceSlot,
    referenceAssetIds: input.referenceAssetIds,
    isDefaultReference: input.isDefaultReference,
    titlePrefix: input.titlePrefix,
    sourceImageCount: referenceImages.length,
  };
  await persistPendingGenerationJob({
    userId,
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
  let balanceTokens: number | undefined;
  try {
    balanceTokens = await reserveTokens(userId, estimatedPricing.tokens, jobId, `${generationType.replaceAll("_", " ")} generation`);
    tokensReserved = true;
    const result = await imageProvider.submit({
      ...providerRequest,
      onProviderContact: () => { providerContactAttempted = true; },
    });
    await recordProviderAcceptance({ userId, jobId, providerJobId: result.providerJobId, raw: result.raw });
    const updatedAt = nowIso();
    const job: GenerationJob = {
      id: jobId,
      status: "running",
      provider: result.provider,
      providerJobId: result.providerJobId,
      model: result.model,
      generationType,
      prompt: visiblePrompt,
      personaId: input.personaId,
      costEstimateCents: estimatedPricing.tokens,
      rawProviderResponse: sanitizeProviderPayload(result.raw),
      createdAt,
      updatedAt,
    };

    return NextResponse.json({ assets: [], job, providerJobId: result.providerJobId, balanceTokens }, { status: 202 });
  } catch (error) {
    await markPendingGenerationJobFailed({ userId, jobId, error }).catch(() => undefined);
    if (shouldRefundUnsubmittedGeneration(tokensReserved, providerContactAttempted)) {
      await refundTokens(userId, estimatedPricing.tokens, jobId, `${generationType.replaceAll("_", " ")} refund: provider was not contacted`);
    }
    throw error;
  }
}

async function generateTalkingAvatar(body: unknown, userId?: string) {
  const input = talkingAvatarGenerationSchema.parse(body);
  if (!input.imageAssetUrl) {
    return NextResponse.json({ error: "Choose an image asset for the avatar." }, { status: 400 });
  }
  if (!input.audioAssetUrl && !input.uploadedAudio?.data && !input.uploadedAudio?.url) {
    return NextResponse.json({ error: "Choose or upload audio for the avatar." }, { status: 400 });
  }

  const estimatedPricing = estimateAvatarGenerationPricing({
    model: input.model,
    resolution: input.resolution,
    durationSeconds: input.durationSeconds,
  });
  await assertSufficientTokens(userId, Math.max(1, estimatedPricing.tokens));

  const [image, audio] = await Promise.all([
    imageUrlToProviderInput(input.imageAssetUrl, `${input.personaName}-avatar-image`, userId),
      input.uploadedAudio
        ? input.uploadedAudio.data
          ? Promise.resolve({
              name: input.uploadedAudio.name,
              mimeType: input.uploadedAudio.mimeType,
              data: input.uploadedAudio.data,
            })
          : input.uploadedAudio.url
            ? mediaUrlToProviderInput(input.uploadedAudio.url, input.uploadedAudio.name ?? `${input.personaName}-uploaded-audio`, userId)
            : Promise.resolve(undefined)
        : input.audioAssetUrl
          ? mediaUrlToProviderInput(input.audioAssetUrl, `${input.personaName}-avatar-audio`, userId)
          : Promise.resolve(undefined),
  ]);
  const providerRequest: AvatarGenerationRequest = {
    image,
    audio,
    model: input.model,
    prompt: input.prompt,
    resolution: input.resolution,
    durationSeconds: input.durationSeconds,
    seed: input.seed,
  };
  const jobId = crypto.randomUUID();
  const createdAt = nowIso();
  const inputParams = {
    ...input,
    uploadedAudio: input.uploadedAudio
      ? { name: input.uploadedAudio.name, mimeType: input.uploadedAudio.mimeType }
      : undefined,
  };
  await persistPendingGenerationJob({
    userId,
    job: {
      id: jobId,
      status: "queued",
      provider: avatarProvider.name,
      model: input.model,
      generationType: "avatar_talking",
      prompt: input.prompt,
      personaId: input.personaId,
      costEstimateCents: estimatedPricing.tokens,
      createdAt,
      updatedAt: createdAt,
    },
    inputParams,
  });
  let tokensReserved = false;
  let providerContactAttempted = false;
  let balanceTokens: number | undefined;
  try {
    balanceTokens = await reserveTokens(userId, estimatedPricing.tokens, jobId, "avatar talking generation");
    tokensReserved = true;
    const result = await avatarProvider.submit({
      ...providerRequest,
      onProviderContact: () => { providerContactAttempted = true; },
    });
    await recordProviderAcceptance({ userId, jobId, providerJobId: result.providerJobId, raw: result.raw });
    const updatedAt = nowIso();
    const asset: Asset | undefined = result.asset
      ? await materializeGeneratedAsset(
          {
            id: crypto.randomUUID(),
            kind: "video",
            title: `${input.personaName} talking avatar`,
            prompt: input.prompt,
            personaId: input.personaId,
            referenceAssetIds: [input.imageAssetId, input.audioAssetId].filter((id): id is string => Boolean(id)),
            generationType: "avatar_talking",
            provider: result.provider,
            providerJobId: result.providerJobId,
            model: result.model,
            createdAt: updatedAt,
            ...result.asset,
          },
          userId,
        )
      : undefined;
    const job: GenerationJob = {
      id: jobId,
      status: result.status,
      provider: result.provider,
      providerJobId: result.providerJobId,
      model: result.model,
      generationType: "avatar_talking",
      prompt: input.prompt,
      personaId: input.personaId,
      costEstimateCents: estimatedPricing.tokens,
      rawProviderResponse: sanitizeProviderPayload(result.raw),
      createdAt,
      updatedAt,
    };

    await persistGenerationRecords({
      userId,
      assets: asset ? [asset] : [],
      job,
      inputParams,
    });

    return NextResponse.json({ asset, job, providerJobId: result.providerJobId, balanceTokens }, { status: result.status === "queued" || result.status === "running" ? 202 : 200 });
  } catch (error) {
    await markPendingGenerationJobFailed({ userId, jobId, error }).catch(() => undefined);
    if (shouldRefundUnsubmittedGeneration(tokensReserved, providerContactAttempted)) {
      await refundTokens(userId, estimatedPricing.tokens, jobId, "avatar talking refund: provider was not contacted");
    }
    throw error;
  }
}
