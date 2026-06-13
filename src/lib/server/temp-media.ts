import { promises as fs } from "fs";
import os from "os";
import path from "path";

const TEMP_MEDIA_DIR = path.join(os.tmpdir(), "persona-studio-media");

type TempMediaMetadata = {
  mimeType: string;
  originalName?: string;
  userId?: string;
};

export async function saveTempMedia(params: {
  bytes: Uint8Array;
  mimeType: string;
  originalName?: string;
  userId?: string;
}) {
  const tempKey = crypto.randomUUID();
  const filePath = path.join(TEMP_MEDIA_DIR, `${tempKey}.bin`);
  const metaPath = path.join(TEMP_MEDIA_DIR, `${tempKey}.json`);

  await fs.mkdir(TEMP_MEDIA_DIR, { recursive: true });
  await fs.writeFile(filePath, params.bytes);
  await fs.writeFile(
    metaPath,
    JSON.stringify({
      mimeType: params.mimeType,
      originalName: params.originalName,
      userId: params.userId,
    } satisfies TempMediaMetadata),
    "utf8",
  );

  return {
    tempKey,
    url: `/api/media/temp/${tempKey}`,
  };
}

export async function readTempMedia(tempKey: string, userId?: string) {
  const filePath = path.join(TEMP_MEDIA_DIR, `${tempKey}.bin`);
  const metaPath = path.join(TEMP_MEDIA_DIR, `${tempKey}.json`);
  const [bytes, metadataRaw] = await Promise.all([
    fs.readFile(filePath),
    fs.readFile(metaPath, "utf8"),
  ]);

  const metadata = JSON.parse(metadataRaw) as TempMediaMetadata;
  if (metadata.userId && metadata.userId !== userId) {
    throw new Error("Temp media is outside the current user scope.");
  }

  return {
    bytes: new Uint8Array(bytes),
    mimeType: metadata.mimeType,
    originalName: metadata.originalName,
  };
}
