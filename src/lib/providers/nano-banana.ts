import { env } from "@/lib/env";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/providers/types";

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
};

type NormalizedInlineData = {
  mimeType?: string;
  data?: string;
};

export class NanoBananaProvider implements ImageProvider {
  name = "nano-banana-pro" as const;

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Nano Banana Pro API generation is not connected.");
    }

    const model = request.model || env.nanoBananaModel;
    const parts = [
      { text: request.prompt },
      ...(request.referenceImages ?? []).map((image) => ({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data,
        },
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            responseFormat: {
              image: {
                aspectRatio: request.aspectRatio,
                imageSize: request.imageSize,
              },
            },
          },
        }),
      },
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json?.error?.message ?? "Nano Banana Pro generation failed.");
    }

    const responseParts: GeminiPart[] =
      json?.candidates?.flatMap((candidate: { content?: { parts?: GeminiPart[] } }) =>
        candidate.content?.parts ?? [],
      ) ?? [];

    const assets = responseParts
      .map((part, index) => {
        const inline = normalizeInlineData(part);
        const mimeType = inline?.mimeType;
        if (!inline?.data || !mimeType) {
          return null;
        }

        return {
          url: `data:${mimeType};base64,${inline.data}`,
          mimeType,
          providerAssetId: `gemini-inline-${Date.now()}-${index}`,
        };
      })
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    if (assets.length === 0) {
      throw new Error("Nano Banana Pro returned no image assets.");
    }

    return {
      provider: this.name,
      model,
      assets: assets.slice(0, request.count),
      costEstimateCents: estimateImageGenerationPricing({ ...request, model }).tokens,
      raw: json,
    };
  }
}

function normalizeInlineData(part: GeminiPart): NormalizedInlineData | undefined {
  if (part.inlineData) {
    return part.inlineData;
  }

  if (part.inline_data) {
    return {
      mimeType: part.inline_data.mime_type,
      data: part.inline_data.data,
    };
  }

  return undefined;
}
