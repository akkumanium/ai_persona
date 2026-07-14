import { deleteTempMedia } from "@/lib/server/temp-media";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ExpiredAssetRow = {
  id: string;
  public_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
};

const TEMP_MEDIA_URL_PATTERN = /^\/api\/media\/temp\/([0-9a-f-]+)(?:\?|$)/i;

export async function cleanupExpiredAssets(limit = 500) {
  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .from("assets")
    .select("id,public_url,storage_bucket,storage_path")
    .lte("expires_at", new Date().toISOString())
    .is("reference_slot", null)
    .eq("is_default_reference", false)
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Could not find expired assets: ${error.message}`);

  const assets = (data ?? []) as ExpiredAssetRow[];
  if (!assets.length) return 0;

  const pathsByBucket = assets.reduce<Record<string, string[]>>((groups, asset) => {
    if (asset.storage_bucket && asset.storage_path) {
      (groups[asset.storage_bucket] ??= []).push(asset.storage_path);
    }
    return groups;
  }, {});

  for (const [bucket, paths] of Object.entries(pathsByBucket)) {
    const { error: removalError } = await service.storage.from(bucket).remove(paths);
    if (removalError) {
      throw new Error(`Could not delete expired files from ${bucket}: ${removalError.message}`);
    }
  }

  await Promise.all(assets.map(async (asset) => {
    const tempKey = asset.public_url?.match(TEMP_MEDIA_URL_PATTERN)?.[1];
    if (tempKey) await deleteTempMedia(tempKey);
  }));

  const { data: deletedCount, error: deleteError } = await service.rpc("delete_expired_assets", {
    p_asset_ids: assets.map((asset) => asset.id),
  });
  if (deleteError) throw new Error(`Could not delete expired asset records: ${deleteError.message}`);
  return typeof deletedCount === "number" ? deletedCount : 0;
}
