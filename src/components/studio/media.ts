import type { SourceImageInput } from "@/components/studio/types";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  formatBytes,
  isAllowedMimeType,
} from "@/lib/media-limits";

type StorageUploadOptions = {
  enabled?: boolean;
  bucket: string;
  folder?: string;
};

export async function encodeFiles(
  files: FileList | null,
  fallbackMimeType: string,
  storage?: StorageUploadOptions,
) {
  const inputFiles = Array.from(files ?? []);
  const storageOptions: StorageUploadOptions = storage ?? {
    enabled: true,
    bucket: "uploads",
    folder: "temporary",
  };

  return Promise.all(
    inputFiles.map(async (file) => {
      const mimeType = file.type || fallbackMimeType;
      if (!isAllowedMimeType(mimeType, ALLOWED_MEDIA_MIME_TYPES)) {
        throw new Error("Unsupported media type.");
      }
      if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
        throw new Error(`Media uploads must be ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)} or smaller.`);
      }

      return uploadFileToStorage(file, fallbackMimeType, storageOptions);
    }),
  );
}

export function sourceImageToDataUrl(image: SourceImageInput) {
  if (image.url) return image.url;
  return `data:${image.mimeType};base64,${image.data}`;
}

export async function uploadSourceImage(
  image: SourceImageInput,
  storage?: StorageUploadOptions,
): Promise<SourceImageInput> {
  if (image.url) return image;
  if (!image.data) throw new Error("The captured image has no uploadable data.");

  const response = await fetch(sourceImageToDataUrl(image));
  const file = new File([await response.blob()], image.name, { type: image.mimeType });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const [uploaded] = await encodeFiles(transfer.files, image.mimeType, storage);
  if (!uploaded) throw new Error("The captured image could not be uploaded.");
  return uploaded;
}

async function uploadFileToStorage(file: File, fallbackMimeType: string, storage: StorageUploadOptions): Promise<SourceImageInput> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("bucket", storage.bucket);
  formData.set("folder", storage.folder ?? "temporary");

  const response = await fetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? "Upload failed.");
  }

  const payload = (await response.json()) as { name: string; mimeType: string; url: string; storageBucket?: string; storagePath?: string };
  return {
    name: payload.name,
    mimeType: payload.mimeType || file.type || fallbackMimeType,
    url: payload.url,
    storageBucket: payload.storageBucket,
    storagePath: payload.storagePath,
  };
}
