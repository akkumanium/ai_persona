export function buildStorageObjectUrl(bucket: string, storagePath: string) {
  const params = new URLSearchParams({
    bucket,
    path: storagePath,
  });
  return `/api/media/object?${params.toString()}`;
}

export function buildMediaCardUrl(url: string) {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;

  const parsed = new URL(url, "http://idolborn.local");
  if (parsed.pathname !== "/api/media/object") return url;
  parsed.searchParams.set("variant", "card");
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}
