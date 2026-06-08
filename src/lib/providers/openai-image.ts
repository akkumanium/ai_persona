import { env } from "@/lib/env";
import { mockImageGeneration } from "@/lib/providers/mock";
import type {
  GeneratedAssetPayload,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/providers/types";

export class OpenAIImageProvider implements ImageProvider {
  name = "openai" as const;

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!env.openaiApiKey) {
      return mockImageGeneration(request);
    }

    if (request.referenceImages?.length) {
      return this.generateEdit(request);
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
        quality: request.imageQuality ?? "auto",
        n: request.count,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "ChatGPT image generation failed.");
    }

    const responseData = Array.isArray(json?.data)
      ? (json.data as { b64_json?: string; url?: string; mime_type?: string }[])
      : [];
    const assets = responseData
          .map((item, index): GeneratedAssetPayload | null => {
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
          .filter((asset): asset is GeneratedAssetPayload => Boolean(asset));

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

  private async generateEdit(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const form = new FormData();
    form.set("model", request.model);
    form.set("prompt", request.prompt);
    form.set("size", mapImageSize(request.aspectRatio));
    form.set("quality", request.imageQuality ?? "auto");
    form.set("n", String(request.count));

    for (const [index, image] of (request.referenceImages ?? []).slice(0, 16).entries()) {
      form.append(
        "image[]",
        providerImageToBlob(image),
        image.name ?? `reference-${index + 1}.${extensionFromMimeType(image.mimeType)}`,
      );
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: form,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "ChatGPT image edit failed.");
    }

    const assets = parseOpenAIAssets(json, request.count);
    if (!assets.length) {
      throw new Error("ChatGPT returned no image assets.");
    }

    return {
      provider: this.name,
      model: request.model,
      assets,
      costEstimateCents: request.generationType.includes("avatar") ? 14 : 20,
      raw: json,
    };
  }
}

function parseOpenAIAssets(json: unknown, count: number): GeneratedAssetPayload[] {
  const responseData = Array.isArray((json as { data?: unknown }).data)
    ? ((json as { data: { b64_json?: string; url?: string; mime_type?: string }[] }).data)
    : [];
  return responseData
    .map((item, index): GeneratedAssetPayload | null => {
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
    .filter((asset): asset is GeneratedAssetPayload => Boolean(asset))
    .slice(0, count);
}

function providerImageToBlob(image: { data: string; mimeType: string }) {
  const bytes = Uint8Array.from(Buffer.from(image.data, "base64"));
  return new Blob([bytes], { type: image.mimeType });
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "png";
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
