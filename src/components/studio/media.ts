import type { SourceImageInput } from "@/components/studio/types";
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
  const storageContext = storage?.enabled ? await getStorageContext() : undefined;

  return Promise.all(
    inputFiles.map(async (file) => {
      if (storageContext && storage) {
        const mimeType = file.type || fallbackMimeType;
        const storagePath = [
          storageContext.userId,
          storage.folder?.replace(/^\/+|\/+$/g, ""),
          `${crypto.randomUUID()}-${safeFileName(file.name)}`,
        ]
          .filter(Boolean)
          .join("/");
        const { error: uploadError } = await storageContext.client.storage
          .from(storage.bucket)
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
          url: buildStorageObjectUrl(storage.bucket, storagePath),
          storageBucket: storage.bucket,
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

async function getStorageContext() {
  const client = createBrowserSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return undefined;
  }

  return { client, userId: user.id };
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
