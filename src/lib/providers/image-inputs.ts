import type { ProviderImageInput } from "@/lib/providers/types";

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
): Promise<ProviderImageInput | undefined> {
  const dataUrlImage = parseDataUrlImage(url, name);
  if (dataUrlImage) {
    return dataUrlImage;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return undefined;
  }

  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const arrayBuffer = await response.arrayBuffer();

  return {
    name,
    mimeType,
    data: Buffer.from(arrayBuffer).toString("base64"),
  };
}
