import { describe, expect, it } from "vitest";
import { assetExpirationDate, formatAssetExpiration, isPermanentReferenceAsset } from "@/lib/asset-expiration";

describe("asset expiration", () => {
  it("expires an ordinary asset seven days after creation when the database value is absent", () => {
    const expiry = assetExpirationDate({
      createdAt: "2026-07-14T12:00:00.000Z",
    });
    expect(expiry?.toISOString()).toBe("2026-07-21T12:00:00.000Z");
  });

  it("uses the database expiry when present", () => {
    const expiry = assetExpirationDate({
      createdAt: "2026-07-14T12:00:00.000Z",
      expiresAt: "2026-07-20T09:30:00.000Z",
    });
    expect(expiry?.toISOString()).toBe("2026-07-20T09:30:00.000Z");
  });

  it("keeps reference-slot and legacy default-reference assets", () => {
    expect(isPermanentReferenceAsset({ referenceSlot: "face" })).toBe(true);
    expect(isPermanentReferenceAsset({ isDefaultReference: true })).toBe(true);
    expect(formatAssetExpiration({
      createdAt: "2026-07-14T12:00:00.000Z",
      referenceSlot: "body",
    })).toBe("Reference - does not expire");
  });
});
