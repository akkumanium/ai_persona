import { NextResponse } from "next/server";
import { imageProvider } from "@/lib/providers";
import { avatarGenerationSchema } from "@/lib/schemas";
import { nowIso } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const input = avatarGenerationSchema.parse(await request.json());

    if (!input.confirmsRights || !input.confirmsAdultPersona) {
      return NextResponse.json(
        { error: "Rights and adult-persona confirmations are required." },
        { status: 400 },
      );
    }

    if (input.mode === "blend" && input.sourceImages.length < 2) {
      return NextResponse.json(
        { error: "Blend mode requires at least two source images." },
        { status: 400 },
      );
    }

    if (input.mode === "normalization" && input.sourceImages.length < 1) {
      return NextResponse.json(
        { error: "Normalization mode requires at least one reference image." },
        { status: 400 },
      );
    }

    const generationType =
      input.mode === "blend"
        ? "avatar_image_blend"
        : input.mode === "normalization"
          ? "avatar_normalization"
          : "avatar_prompt";
    const referenceImages = input.mode === "prompt" ? [] : input.sourceImages;
    const referenceImageNames = referenceImages.map((image) => image.name).filter(Boolean).join(", ");

    const result = await imageProvider.generate({
      prompt: [
        input.prompt,
        `Persona name: ${input.personaName}.`,
        `Persona description: ${input.description}.`,
        input.styleNotes ? `Style notes: ${input.styleNotes}.` : "",
        input.mode === "blend"
          ? `Blend these uploaded source concepts into one unique face: ${referenceImageNames}.`
          : "",
        input.mode === "normalization"
          ? "Normalize the uploaded reference image into a clean, high-fidelity avatar while preserving identity."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      model: "gemini-3-pro-image-preview",
      aspectRatio: input.aspectRatio,
      imageSize: input.imageSize,
      count: input.count,
      referenceImages,
      generationType,
    });

    const createdAt = nowIso();
    const personaId = `persona-${crypto.randomUUID()}`;
    const assets = result.assets.map((asset, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "avatar",
      title: `${input.personaName} reference ${index + 1}`,
      prompt: input.prompt,
      personaId,
      generationType,
      provider: result.provider,
      model: result.model,
      createdAt,
      ...asset,
    }));

    return NextResponse.json({
      persona: {
        id: personaId,
        name: input.personaName,
        description: input.description,
        styleNotes: input.styleNotes,
        status: "active",
        referenceAssetId: assets[0]?.id,
        createdAt,
      },
      assets,
      job: {
        id: `job-${crypto.randomUUID()}`,
        status: "succeeded",
        provider: result.provider,
        model: result.model,
        generationType,
        prompt: input.prompt,
        personaId,
        costEstimateCents: result.costEstimateCents,
        rawProviderResponse: result.raw,
        createdAt,
        updatedAt: createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Avatar generation failed." },
      { status: 500 },
    );
  }
}
