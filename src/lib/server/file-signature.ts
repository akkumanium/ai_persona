export function assertMediaFileSignature(bytes: Uint8Array, mimeType: string) {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const normalized = mimeType.toLowerCase();
  const valid = normalized.includes("png") ? startsWith(0x89, 0x50, 0x4e, 0x47)
    : normalized.includes("jpeg") || normalized.includes("jpg") ? startsWith(0xff, 0xd8, 0xff)
      : normalized.includes("gif") ? startsWith(0x47, 0x49, 0x46, 0x38)
        : normalized.includes("webp") ? startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          : normalized.includes("mp4") || normalized.includes("m4a") || normalized.includes("quicktime") ? String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
            : normalized.includes("webm") ? startsWith(0x1a, 0x45, 0xdf, 0xa3)
              : normalized.includes("wav") ? startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WAVE"
                : normalized.includes("mpeg") || normalized.includes("mp3") ? startsWith(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
                  : normalized.includes("ogg") || normalized.includes("opus") ? startsWith(0x4f, 0x67, 0x67, 0x53)
                    : normalized.includes("flac") ? startsWith(0x66, 0x4c, 0x61, 0x43)
                      : normalized.includes("aac") ? bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
                        : false;
  if (!valid) throw new Error("File contents do not match the declared media type.");
}
