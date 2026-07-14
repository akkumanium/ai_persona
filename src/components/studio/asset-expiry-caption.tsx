import { Clock3 } from "lucide-react";
import { assetExpirationDate, formatAssetExpiration } from "@/lib/asset-expiration";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssetExpiryCaption({
  asset,
  className,
}: {
  asset: Pick<Asset, "createdAt" | "expiresAt" | "referenceSlot" | "isDefaultReference">;
  className?: string;
}) {
  const expiry = assetExpirationDate(asset);
  return (
    <p
      className={cn("flex items-center gap-1 text-[10px] leading-4 text-stone-400", className)}
      title={expiry ? `This file will be automatically deleted after ${expiry.toISOString()}.` : "Reference files are kept until you delete them."}
    >
      <Clock3 size={10} aria-hidden="true" />
      <span>{formatAssetExpiration(asset)}</span>
    </p>
  );
}
