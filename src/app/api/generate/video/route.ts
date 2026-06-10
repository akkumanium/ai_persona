import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { videoProvider } from "@/lib/providers";
import { estimateVideoGenerationPricing } from "@/lib/pricing";
import { videoGenerationSchema } from "@/lib/schemas";
import { persistGenerationRecords } from "@/lib/server/studio-persistence";
import { assertSufficientTokens, InsufficientTokensError } from "@/lib/server/token-billing";
import type { Asset, GenerationJob } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const input = videoGenerationSchema.parse(await request.json());
    const generationType =
      input.mode === "motion"
        ? "video_motion"
        : input.startFrameImageUrl || input.referenceImageUrl
          ? "video_normal"
          : "video_prompt";
    const estimatedPricing = estimateVideoGenerationPricing(input);
    await assertSufficientTokens(auth.user?.id, estimatedPricing.tokens);

    const result = await videoProvider.submit(input);
    const createdAt = nowIso();
    const jobId = crypto.randomUUID();
    const asset: Asset | undefined = result.asset
      ? {
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
        }
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
      rawProviderResponse: result.raw,
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
    if (error instanceof InsufficientTokensError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 500 },
    );
  }
}
