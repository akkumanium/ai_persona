import type { SourceImageInput } from "@/components/studio/types";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function encodeFiles(files: FileList | null, fallbackMimeType: string) {
  const inputFiles = Array.from(files ?? []);
  return Promise.all(
    inputFiles.map(async (file) => {
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
  return `data:${image.mimeType};base64,${image.data}`;
}
