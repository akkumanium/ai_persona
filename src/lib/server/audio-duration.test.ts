import { describe, expect, it } from "vitest";
import { measureAudioDurationSeconds } from "@/lib/server/audio-duration";

describe("server-side audio duration", () => {
  it("uses the audio bytes instead of a caller-reported duration", async () => {
    const callerReportedDurationSeconds = 1;
    const measuredDurationSeconds = await measureAudioDurationSeconds({
      name: "twelve-seconds.wav",
      mimeType: "audio/wav",
      data: wavFile(12).toString("base64"),
    });

    expect(callerReportedDurationSeconds).toBe(1);
    expect(measuredDurationSeconds).toBeCloseTo(12, 3);
  });

  it("rejects malformed audio", async () => {
    await expect(measureAudioDurationSeconds({
      name: "broken.mp3",
      mimeType: "audio/mpeg",
      data: Buffer.from("not an audio file").toString("base64"),
    })).rejects.toThrow("Could not determine the audio duration");
  });

  it("rejects non-audio media types", async () => {
    await expect(measureAudioDurationSeconds({
      name: "clip.mp4",
      mimeType: "video/mp4",
      data: Buffer.from("not audio").toString("base64"),
    })).rejects.toThrow("not a supported audio type");
  });
});

function wavFile(durationSeconds: number) {
  const sampleRate = 8_000;
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = Math.round(durationSeconds * sampleRate * channelCount * bytesPerSample);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}
