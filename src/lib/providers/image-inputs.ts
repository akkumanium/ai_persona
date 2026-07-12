import type { ProviderImageInput } from "@/lib/providers/types";
import { mediaUrlToBase64Input } from "@/lib/server/media-storage";

export function parseDataUrlImage(url: string, name?: string): ProviderImageInput | undefined {
  const match = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return undefined;
  }

  return {
    name,
    mimeType: match[1],
    data: match[2],
  };
}

export async function imageUrlToProviderInput(
  url: string,
  name = "reference-image",
  userId?: string,
): Promise<ProviderImageInput | undefined> {
  const dataUrlImage = parseDataUrlImage(url, name);
  if (dataUrlImage) {
    return dataUrlImage;
  }

  const media = await mediaUrlToBase64Input(url, userId);
  return {
    name,
    mimeType: media.mimeType,
    data: media.data,
  };
}
