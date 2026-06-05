import { env } from "@/lib/env";
import { mockImageGeneration } from "@/lib/providers/mock";
import type { ImageGenerationRequest, ImageGenerationResult, ImageProvider } from "@/lib/providers/types";

export class OpenAIImageProvider implements ImageProvider {
  name = "openai" as const;

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!env.openaiApiKey) {
      return mockImageGeneration(request);
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        size: mapImageSize(request.aspectRatio),
        n: request.count,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "ChatGPT image generation failed.");
    }

    const assets = Array.isArray(json?.data)
      ? json.data
          .map((item: { b64_json?: string; url?: string; mime_type?: string }, index: number) => {
            if (item.b64_json) {
              return {
                url: `data:image/png;base64,${item.b64_json}`,
                mimeType: item.mime_type ?? "image/png",
                providerAssetId: `openai-image-${Date.now()}-${index}`,
              };
            }

            if (item.url) {
              return {
                url: item.url,
                mimeType: item.mime_type ?? "image/png",
                providerAssetId: `openai-image-${Date.now()}-${index}`,
              };
            }

            return null;
          })
          .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
      : [];

    if (!assets.length) {
      throw new Error("ChatGPT returned no image assets.");
    }

    return {
      provider: this.name,
      model: request.model,
      assets: assets.slice(0, request.count),
      costEstimateCents: request.generationType.includes("avatar") ? 14 : 20,
      raw: json,
    };
  }
}

function mapImageSize(aspectRatio: string) {
  switch (aspectRatio) {
    case "16:9":
      return "1536x1024";
    case "9:16":
    case "4:5":
    case "3:4":
      return "1024x1536";
    default:
      return "1024x1024";
  }
}