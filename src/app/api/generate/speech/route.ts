import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { speechProvider } from "@/lib/providers";
import type { SpeechGenerationRequest } from "@/lib/providers/types";
import { estimateSpeechGenerationPricing } from "@/lib/pricing";
import { speechGenerationSchema } from "@/lib/schemas";
import { materializeGeneratedAsset, sanitizeProviderPayload } from "@/lib/server/media-storage";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { markPendingGenerationJobFailed, persistGenerationRecords, persistPendingGenerationJob } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError, refundTokens, reserveTokens } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const rateLimited = rateLimitRequest(request, { key: "generate-speech", limit: 20, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = speechGenerationSchema.parse(await readJsonRequest(request));
    const providerRequest: SpeechGenerationRequest = {
      text: input.text,
      voiceId: input.voiceId,
      model: input.model,
      outputFormat: input.outputFormat,
      stability: input.stability,
      similarityBoost: input.similarityBoost,
      style: input.style,
      speed: input.speed,
      useSpeakerBoost: input.useSpeakerBoost,
      seed: input.seed,
      languageCode: input.languageCode,
    };
    const estimatedPricing = estimateSpeechGenerationPricing(providerRequest);
    await assertSufficientTokens(auth.user?.id, Math.max(1, estimatedPricing.tokens));

    const jobId = crypto.randomUUID();
    const createdAt = nowIso();
    const inputParams = {
      ...input,
      textLength: input.text.length,
      text: input.text,
    };
    await persistPendingGenerationJob({
      userId: auth.user?.id,
      job: {
        id: jobId,
        status: "queued",
        provider: speechProvider.name,
        model: input.model,
        generationType: "speech_text",
        prompt: input.text,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        createdAt,
        updatedAt: createdAt,
      },
      inputParams,
    });
    let providerCompleted = false;
    try {
      await reserveTokens(auth.user?.id, estimatedPricing.tokens, jobId, "speech text generation");
      const result = await speechProvider.generate(providerRequest);
      providerCompleted = true;
      const updatedAt = nowIso();
      const asset: Asset = await materializeGeneratedAsset({
        id: crypto.randomUUID(),
        kind: "audio",
        title: `${input.personaName} speech`,
        prompt: input.text,
        personaId: input.personaId,
        generationType: "speech_text",
        provider: result.provider,
        model: result.model,
        createdAt: updatedAt,
        ...result.asset,
      }, auth.user?.id);
      const job: GenerationJob = {
        id: jobId,
        status: "succeeded",
        provider: result.provider,
        model: result.model,
        generationType: "speech_text",
        prompt: input.text,
        personaId: input.personaId,
        costEstimateCents: estimatedPricing.tokens,
        rawProviderResponse: sanitizeProviderPayload(result.raw),
        createdAt,
        updatedAt,
      };

      await persistGenerationRecords({
        userId: auth.user?.id,
        assets: [asset],
        job,
        inputParams,
      });

      return NextResponse.json({ asset, job });
    } catch (error) {
      if (providerCompleted) {
        await refundTokens(auth.user?.id, estimatedPricing.tokens, jobId, "speech text refund");
      }
      await markPendingGenerationJobFailed({ userId: auth.user?.id, jobId, error }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech generation failed." },
      { status: 500 },
    );
  }
}
