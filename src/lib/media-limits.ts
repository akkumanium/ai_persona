export const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_DIRECT_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_REMOTE_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_INLINE_IMAGE_BYTES = 2_500_000;
export const MAX_INLINE_MEDIA_BYTES = 3_250_000;
export const TEMP_MEDIA_TTL_MS = 6 * 60 * 60 * 1000;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
] as const;

export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_AUDIO_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const;

export const ALLOWED_STORAGE_BUCKETS = [
  "uploads",
  "generated-images",
  "generated-videos",
  "generated-audio",
  "provider-temp",
] as const;

export function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedMimeType(mimeType: string, allowedTypes: readonly string[]) {
  return allowedTypes.includes(normalizeMimeType(mimeType));
}

export function isAllowedStorageBucket(bucket: string) {
  return (ALLOWED_STORAGE_BUCKETS as readonly string[]).includes(bucket);
}

export function estimateBase64DecodedBytes(data: string) {
  const normalized = data.replace(/\s/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}
