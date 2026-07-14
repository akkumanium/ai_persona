import { parseBuffer } from "music-metadata";
import { ALLOWED_AUDIO_MIME_TYPES, isAllowedMimeType, normalizeMimeType } from "@/lib/media-limits";
import type { ProviderMediaInput } from "@/lib/providers/types";

export async function measureAudioDurationSeconds(audio: ProviderMediaInput) {
  const mimeType = normalizeMimeType(audio.mimeType);
  if (!isAllowedMimeType(mimeType, ALLOWED_AUDIO_MIME_TYPES)) {
    throw new Error("The selected file is not a supported audio type.");
  }

  const bytes = Buffer.from(audio.data, "base64");
  if (!bytes.byteLength) {
    throw new Error("The selected audio file is empty.");
  }

  try {
    const metadata = await parseBuffer(
      bytes,
      { mimeType, size: bytes.byteLength },
      { duration: true, skipCovers: true },
    );
    const durationSeconds = metadata.format.duration;
    if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
      throw new Error("Audio duration is unavailable.");
    }

    return durationSeconds;
  } catch {
    throw new Error("Could not determine the audio duration. Upload a valid MP3, WAV, M4A, OGG, or FLAC file.");
  }
}
