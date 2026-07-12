import { describe, expect, it } from "vitest";
import { assertMediaFileSignature } from "@/lib/server/file-signature";

describe("assertMediaFileSignature", () => {
  it("accepts matching image and video signatures", () => {
    expect(() => assertMediaFileSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg")).not.toThrow();
    expect(() => assertMediaFileSignature(Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]), "video/mp4")).not.toThrow();
  });

  it("rejects a file whose contents do not match its MIME type", () => {
    expect(() => assertMediaFileSignature(Uint8Array.from([0x4d, 0x5a, 0x90]), "image/png"))
      .toThrow("File contents do not match");
  });
});
