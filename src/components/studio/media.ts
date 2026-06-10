import type { SourceImageInput } from "@/components/studio/types";
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

        const { data: signed, error: signedError } = await storageContext.client.storage
          .from(storage.bucket)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

        if (signedError || !signed?.signedUrl) {
          throw signedError ?? new Error("Could not create a signed URL for the uploaded image.");
        }

        return {
          name: file.name,
          mimeType,
          url: signed.signedUrl,
          storageBucket: storage.bucket,
          storagePath,
        };
      }

      const dataUrl = await fileToDataUrl(file);
      return {
        name: file.name,
        mimeType: file.type || fallbackMimeType,
        data: dataUrl.split(",")[1] ?? "",
      };
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

function safeFileName(name: string) {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalizedName || "upload";
}
