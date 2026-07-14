import type { Asset } from "@/lib/types";

export const ASSET_RETENTION_DAYS = 7;
export const ASSET_RETENTION_MS = ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function isPermanentReferenceAsset(asset: Pick<Asset, "referenceSlot" | "isDefaultReference">) {
  return Boolean(asset.referenceSlot || asset.isDefaultReference);
}

export function assetExpirationDate(asset: Pick<Asset, "createdAt" | "expiresAt" | "referenceSlot" | "isDefaultReference">) {
  if (isPermanentReferenceAsset(asset)) return undefined;
  const explicitExpiry = asset.expiresAt ? Date.parse(asset.expiresAt) : NaN;
  const createdAt = Date.parse(asset.createdAt);
  const expiry = Number.isFinite(explicitExpiry)
    ? explicitExpiry
    : Number.isFinite(createdAt)
      ? createdAt + ASSET_RETENTION_MS
      : NaN;
  return Number.isFinite(expiry) ? new Date(expiry) : undefined;
}

export function formatAssetExpiration(asset: Pick<Asset, "createdAt" | "expiresAt" | "referenceSlot" | "isDefaultReference">) {
  if (isPermanentReferenceAsset(asset)) return "Reference - does not expire";
  const expiry = assetExpirationDate(asset);
  if (!expiry) return "Expires within 7 days";
  return `Expires ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: expiry.getUTCFullYear() === new Date().getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  }).format(expiry)}`;
}
