import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  TEMP_MEDIA_TTL_MS,
  formatBytes,
  isAllowedMimeType,
} from "@/lib/media-limits";

const TEMP_MEDIA_DIR = path.join(os.tmpdir(), "persona-studio-media");
const TEMP_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TempMediaMetadata = {
  mimeType: string;
  originalName?: string;
  userId?: string;
  sizeBytes?: number;
  createdAt?: string;
};

export async function saveTempMedia(params: {
  bytes: Uint8Array;
  mimeType: string;
  originalName?: string;
  userId?: string;
}) {
  if (params.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Media uploads must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`);
  }
  if (!isAllowedMimeType(params.mimeType, ALLOWED_MEDIA_MIME_TYPES)) {
    throw new Error("Unsupported media type.");
  }

  const tempKey = crypto.randomUUID();
  const filePath = path.join(TEMP_MEDIA_DIR, `${tempKey}.bin`);
  const metaPath = path.join(TEMP_MEDIA_DIR, `${tempKey}.json`);

  await fs.mkdir(TEMP_MEDIA_DIR, { recursive: true });
  await cleanupExpiredTempMedia().catch(() => undefined);
  await fs.writeFile(filePath, params.bytes);
  await fs.writeFile(
    metaPath,
    JSON.stringify({
      mimeType: params.mimeType,
      originalName: params.originalName,
      userId: params.userId,
      sizeBytes: params.bytes.byteLength,
      createdAt: new Date().toISOString(),
    } satisfies TempMediaMetadata),
    "utf8",
  );

  return {
    tempKey,
    url: `/api/media/temp/${tempKey}`,
  };
}

export async function readTempMedia(tempKey: string, userId?: string) {
  if (!TEMP_KEY_PATTERN.test(tempKey)) {
    throw new Error("Invalid temp media key.");
  }

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
  if (!isAllowedMimeType(metadata.mimeType, ALLOWED_MEDIA_MIME_TYPES)) {
    throw new Error("Unsupported media type.");
  }
  if (metadata.createdAt && Date.now() - Date.parse(metadata.createdAt) > TEMP_MEDIA_TTL_MS) {
    await Promise.allSettled([fs.unlink(filePath), fs.unlink(metaPath)]);
    throw new Error("Temp media has expired.");
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Media uploads must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`);
  }

  return {
    bytes: new Uint8Array(bytes),
    mimeType: metadata.mimeType,
    originalName: metadata.originalName,
  };
}

export async function deleteTempMedia(tempKey: string) {
  if (!TEMP_KEY_PATTERN.test(tempKey)) return false;
  const results = await Promise.allSettled([
    fs.unlink(path.join(TEMP_MEDIA_DIR, `${tempKey}.bin`)),
    fs.unlink(path.join(TEMP_MEDIA_DIR, `${tempKey}.json`)),
  ]);
  return results.some((result) => result.status === "fulfilled");
}

async function cleanupExpiredTempMedia() {
  const entries = await fs.readdir(TEMP_MEDIA_DIR, { withFileTypes: true }).catch(() => []);
  const now = Date.now();

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const metaPath = path.join(TEMP_MEDIA_DIR, entry.name);
        const tempKey = entry.name.slice(0, -".json".length);
        const filePath = path.join(TEMP_MEDIA_DIR, `${tempKey}.bin`);
        const [metadataRaw, stats] = await Promise.all([
          fs.readFile(metaPath, "utf8").catch(() => undefined),
          fs.stat(metaPath).catch(() => undefined),
        ]);
        const metadata = parseTempMetadata(metadataRaw);
        const createdAt = metadata ? Date.parse(metadata.createdAt ?? "") : NaN;
        const ageMs = now - (Number.isFinite(createdAt) ? createdAt : stats?.mtimeMs ?? now);
        if (ageMs > TEMP_MEDIA_TTL_MS) {
          await Promise.allSettled([fs.unlink(filePath), fs.unlink(metaPath)]);
        }
      }),
  );
}

function parseTempMetadata(raw?: string) {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as TempMediaMetadata;
  } catch {
    return undefined;
  }
}
