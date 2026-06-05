import { NextResponse } from "next/server";
import { imageProvider } from "@/lib/providers";
import { imageUrlToProviderInput } from "@/lib/providers/image-inputs";
import type { ProviderImageInput } from "@/lib/providers/types";
import { imageGenerationSchema } from "@/lib/schemas";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const input = imageGenerationSchema.parse(await request.json());
    const referenceUrls = input.referenceImageUrls.length
      ? input.referenceImageUrls
      : input.referenceImageUrl
        ? [input.referenceImageUrl]
        : [];
    const referenceImages = referenceUrls.length
      ? (
          await Promise.all(
            referenceUrls.map((url, index) =>
              imageUrlToProviderInput(url, `${input.personaName}-reference-${index + 1}`),
            ),
          )
        ).filter((image): image is ProviderImageInput => Boolean(image))
      : [];
    const generationType = referenceUrls.length ? "image_from_reference" : "image_from_prompt";

    const result = await imageProvider.generate({
      prompt: [
        input.prompt,
        referenceUrls.length ? `Keep facial identity consistent with reference persona ${input.personaName}.` : "",
        input.styleNotes ? `Style notes: ${input.styleNotes}.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      model: input.model,
      aspectRatio: input.aspectRatio,
      imageSize: input.imageSize,
      count: input.count,
      referenceImages,
      generationType,
    });

    const createdAt = nowIso();
    const assets = result.assets.map((asset, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "image",
      title: `${input.personaName} image ${index + 1}`,
      prompt: input.prompt,
      personaId: input.personaId,
      generationType,
      provider: result.provider,
      model: result.model,
      createdAt,
      ...asset,
    }));

    return NextResponse.json({
      assets,
      job: {
        id: `job-${crypto.randomUUID()}`,
        status: "succeeded",
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 500 },
    );
  }
}
