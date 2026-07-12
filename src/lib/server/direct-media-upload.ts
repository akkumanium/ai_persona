import { assertMediaFileSignature } from "@/lib/server/file-signature";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type UploadIntent = {
  id: string;
  user_id: string;
  storage_bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: "pending" | "cleaning";
  expires_at: string;
};

export async function cleanupExpiredUploadIntents(userId?: string, limit = 25) {
  const service = createServiceSupabaseClient();
  let query = service.from("media_upload_intents")
    .select("id,user_id,storage_bucket,storage_path,size_bytes")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);
  const { data: intents, error } = await query;
  if (error) throw new Error(`Could not inspect expired uploads: ${error.message}`);

  let cleaned = 0;
  for (const intent of intents ?? []) {
    const { data: claimed, error: claimError } = await service.from("media_upload_intents")
      .update({ status: "cleaning" }).eq("id", intent.id).eq("status", "pending").select("id").maybeSingle();
    if (claimError || !claimed) continue;
    const { error: removeError } = await service.storage.from(intent.storage_bucket).remove([intent.storage_path]);
    if (removeError) {
      await service.from("media_upload_intents").update({ status: "pending" }).eq("id", intent.id).eq("status", "cleaning");
      continue;
    }
    const { error: deleteError } = await service.from("media_upload_intents").delete().eq("id", intent.id).eq("status", "cleaning");
    if (deleteError) continue;
    await service.rpc("release_storage_reservation", { p_user_id: intent.user_id, p_size_bytes: intent.size_bytes });
    cleaned += 1;
  }
  return cleaned;
}

export async function finalizeDirectUpload(intent: UploadIntent) {
  const service = createServiceSupabaseClient();
  const bucket = service.storage.from(intent.storage_bucket);
  const { data: info, error: infoError } = await bucket.info(intent.storage_path);
  if (infoError || !info) throw new Error("The uploaded object is not available yet.");

  const actualSize = Number(info.size ?? info.metadata?.size ?? 0);
  const actualMime = String(info.contentType ?? info.metadata?.mimetype ?? "").toLowerCase();
  if (actualSize !== intent.size_bytes || actualMime !== intent.mime_type) {
    await rejectDirectUpload(intent);
    throw new Error("The uploaded file does not match its reserved size or media type.");
  }

  const { data: signed, error: signedError } = await bucket.createSignedUrl(intent.storage_path, 60);
  if (signedError || !signed?.signedUrl) throw new Error("The uploaded file could not be verified.");
  const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  if (response.status !== 206) {
    await response.body?.cancel();
    throw new Error("Storage did not honor the media verification range request.");
  }
  const signature = new Uint8Array(await response.arrayBuffer());
  try {
    assertMediaFileSignature(signature, intent.mime_type);
  } catch (error) {
    await rejectDirectUpload(intent);
    throw error;
  }

  const { error: deleteError } = await service.from("media_upload_intents").delete().eq("id", intent.id).eq("status", "pending");
  if (deleteError) throw new Error(`Could not finalize upload: ${deleteError.message}`);
}

async function rejectDirectUpload(intent: Pick<UploadIntent, "id" | "user_id" | "storage_bucket" | "storage_path" | "size_bytes">) {
  const service = createServiceSupabaseClient();
  await service.storage.from(intent.storage_bucket).remove([intent.storage_path]);
  await service.from("media_upload_intents").delete().eq("id", intent.id).eq("status", "pending");
  await service.rpc("release_storage_reservation", { p_user_id: intent.user_id, p_size_bytes: intent.size_bytes });
}
