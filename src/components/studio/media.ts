import type { SourceImageInput } from "@/components/studio/types";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  formatBytes,
  isAllowedMimeType,
} from "@/lib/media-limits";
import { buildStorageObjectUrl } from "@/lib/media-urls";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type StorageUploadOptions = {
  enabled?: boolean;
  bucket: string;
  folder?: string;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const storageContext = storageOptions.enabled ? await getStorageContext() : undefined;

  return Promise.all(
    inputFiles.map(async (file) => {
      const mimeType = file.type || fallbackMimeType;
      if (!isAllowedMimeType(mimeType, ALLOWED_MEDIA_MIME_TYPES)) {
        throw new Error("Unsupported media type.");
      }
      if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
        throw new Error(`Media uploads must be ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)} or smaller.`);
      }

      if (storageContext) {
        const storagePath = [
          storageContext.userId,
          storageOptions.folder?.replace(/^\/+|\/+$/g, ""),
          `${crypto.randomUUID()}-${safeFileName(file.name)}`,
        ]
          .filter(Boolean)
          .join("/");
        const { error: uploadError } = await storageContext.client.storage
          .from(storageOptions.bucket)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        return {
          name: file.name,
          mimeType,
          url: buildStorageObjectUrl(storageOptions.bucket, storagePath),
          storageBucket: storageOptions.bucket,
          storagePath,
        };
      }

      return uploadFileToTemp(file, fallbackMimeType);
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

async function getStorageContext() {
  try {
    const client = createBrowserSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return undefined;
    }

    return { client, userId: user.id };
  } catch {
    return undefined;
  }
}

async function uploadFileToTemp(file: File, fallbackMimeType: string): Promise<SourceImageInput> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const fallbackDataUrl = await fileToDataUrl(file);
    return {
      name: file.name,
      mimeType: file.type || fallbackMimeType,
      data: fallbackDataUrl.split(",")[1] ?? "",
    };
  }

  const payload = (await response.json()) as { name: string; mimeType: string; url: string };
  return {
    name: payload.name,
    mimeType: payload.mimeType || file.type || fallbackMimeType,
    url: payload.url,
  };
}

function safeFileName(name: string) {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalizedName || "upload";
}
