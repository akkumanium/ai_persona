export function buildStorageObjectUrl(bucket: string, storagePath: string) {
  const params = new URLSearchParams({
    bucket,
    path: storagePath,
  });
  return `/api/media/object?${params.toString()}`;
}
