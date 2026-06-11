import type { ProviderMediaInput } from "@/lib/providers/types";
import { mediaUrlToBase64Input } from "@/lib/server/media-storage";

export async function mediaUrlToProviderInput(
  url: string,
  name = "reference-media",
  userId?: string,
): Promise<ProviderMediaInput | undefined> {
  try {
    const media = await mediaUrlToBase64Input(url, userId);
    return {
      name,
      mimeType: media.mimeType,
      data: media.data,
    };
  } catch {
    return undefined;
  }
}
