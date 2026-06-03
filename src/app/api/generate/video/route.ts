import { NextResponse } from "next/server";
import { videoProvider } from "@/lib/providers";
import { videoGenerationSchema } from "@/lib/schemas";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const input = videoGenerationSchema.parse(await request.json());
    const generationType =
      input.mode === "motion"
        ? "video_motion"
        : input.referenceImageUrl
          ? "video_normal"
          : "video_prompt";
    const result = await videoProvider.submit(input);
    const createdAt = nowIso();
    const jobId = `job-${crypto.randomUUID()}`;

    return NextResponse.json({
      asset: result.asset
        ? {
            id: `asset-${crypto.randomUUID()}`,
            kind: "video",
            title: `${input.personaName} ${input.mode} video`,
            prompt: input.prompt,
            personaId: input.personaId,
            generationType,
            provider: result.provider,
            model: result.model,
            createdAt,
            ...result.asset,
          }
        : undefined,
      job: {
        id: jobId,
        status: result.status,
        provider: result.provider,
        model: result.model,
        generationType,
        prompt: input.prompt,
        personaId: input.personaId,
        costEstimateCents: result.costEstimateCents,
        rawProviderResponse: result.raw,
        createdAt,
        updatedAt: createdAt,
      },
      providerJobId: result.providerJobId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 500 },
    );
  }
}
