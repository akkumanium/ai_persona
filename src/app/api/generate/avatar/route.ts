import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { avatarProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import { mediaUrlToProviderInput } from "@/lib/providers/media-inputs";
import type { AvatarGenerationRequest } from "@/lib/providers/types";
import { estimateAvatarGenerationPricing } from "@/lib/pricing";
import { talkingAvatarGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { InsufficientTokensError, refundTokens, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = talkingAvatarGenerationSchema.parse(await request.json());
    if (!input.imageAssetUrl) {
      return NextResponse.json({ error: "Choose an image asset for the avatar." }, { status: 400 });
    }
    if (!input.audioAssetUrl && !input.uploadedAudio?.data && !input.uploadedAudio?.url) {
      return NextResponse.json({ error: "Choose or upload audio for the avatar." }, { status: 400 });
    }

    const [image, audio] = await Promise.all([
      imageUrlToProviderInput(input.imageAssetUrl, `${input.personaName}-avatar-image`, auth.user?.id),
      input.uploadedAudio
        ? input.uploadedAudio.data
          ? Promise.resolve({
              name: input.uploadedAudio.name,
              mimeType: input.uploadedAudio.mimeType,
              data: input.uploadedAudio.data,
            })
          : input.uploadedAudio.url
            ? mediaUrlToProviderInput(input.uploadedAudio.url, input.uploadedAudio.name ?? `${input.personaName}-uploaded-audio`, auth.user?.id)
            : Promise.resolve(undefined)
        : input.audioAssetUrl
          ? mediaUrlToProviderInput(input.audioAssetUrl, `${input.personaName}-avatar-audio`, auth.user?.id)
          : Promise.resolve(undefined),
    ]);
    const providerRequest: AvatarGenerationRequest = {
      image,
      audio,
      prompt: input.prompt,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      seed: input.seed,
    };
    const estimatedPricing = estimateAvatarGenerationPricing(providerRequest);
    const jobId = crypto.randomUUID();
    await reserveTokens(auth.user?.id, estimatedPricing.tokens, jobId, "avatar talking generation");

    try {
      const result = await avatarProvider.submit(providerRequest);
      const createdAt = nowIso();
      const asset: Asset | undefined = result.asset
        ? await materializeGeneratedAsset({
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
            createdAt,
            ...result.asset,
          }, auth.user?.id)
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
        updatedAt: createdAt,
      };

      await persistGenerationRecords({
        userId: auth.user?.id,
        assets: asset ? [asset] : [],
        job,
        inputParams: {
          ...input,
          uploadedAudio: input.uploadedAudio
            ? { name: input.uploadedAudio.name, mimeType: input.uploadedAudio.mimeType }
            : undefined,
        },
      });

      return NextResponse.json({ asset, job, providerJobId: result.providerJobId });
    } catch (error) {
      await refundTokens(auth.user?.id, estimatedPricing.tokens, jobId, "avatar talking refund");
      throw error;
    }
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
