import { describe, expect, it } from "vitest";
import { buildMediaCardUrl, buildStorageObjectUrl } from "@/lib/media-urls";

describe("media URLs", () => {
  it("adds the fixed card variant to stored media URLs", () => {
    expect(buildMediaCardUrl(buildStorageObjectUrl("generated-images", "user/image.webp")))
      .toBe("/api/media/object?bucket=generated-images&path=user%2Fimage.webp&variant=card");
  });

  it("does not rewrite local or external media", () => {
    expect(buildMediaCardUrl("blob:local-preview")).toBe("blob:local-preview");
    expect(buildMediaCardUrl("data:image/png;base64,AA==")).toBe("data:image/png;base64,AA==");
    expect(buildMediaCardUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
  });
});
