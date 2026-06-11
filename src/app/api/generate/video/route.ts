import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { mediaUrlToProviderInput } from "@/lib/providers/media-inputs";
import { videoProvider } from "@/lib/providers";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import { videoGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { InsufficientTokensError, refundTokens, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = videoGenerationSchema.parse(await request.json());
    const motionReferenceVideo =
      input.motionReferenceVideo ??
      (input.motionReferenceVideoUrl
        ? await mediaUrlToProviderInput(input.motionReferenceVideoUrl, `${input.personaName}-motion-reference`, auth.user?.id)
        : undefined);
    const generationType =
      input.mode === "motion"
        ? "video_motion"
        : input.startFrameImageUrl || input.referenceImageUrl
          ? "video_normal"
          : "video_prompt";
    const estimatedPricing = estimateVideoGenerationPricing(input);
    const jobId = crypto.randomUUID();
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
      const createdAt = nowIso();
      const asset: Asset | undefined = result.asset
        ? await materializeGeneratedAsset({
            id: crypto.randomUUID(),
            kind: "video",
            title: `${input.personaName} ${input.mode} video`,
            prompt: input.prompt,
            personaId: input.personaId,
            generationType,
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
        generationType,
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
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 500 },
    );
  }
}
