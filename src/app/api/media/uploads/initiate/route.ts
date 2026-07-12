import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { ALLOWED_MEDIA_MIME_TYPES, MAX_DIRECT_UPLOAD_BYTES, isAllowedMimeType, normalizeMimeType } from "@/lib/media-limits";
import { cleanupExpiredUploadIntents } from "@/lib/server/direct-media-upload";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "media-upload-initiate", limit: 30, windowMs: 10 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    if (!auth.user || !env.supabaseServiceRoleKey) return NextResponse.json({ error: "Persistent storage is not configured." }, { status: 503 });

    const body = await readJsonRequest(request) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const mimeType = normalizeMimeType(typeof body?.mimeType === "string" ? body.mimeType : "");
    const sizeBytes = Number(body?.sizeBytes);
    const bucket = body?.bucket === undefined ? "uploads" : String(body.bucket);
    const folder = typeof body?.folder === "string" ? body.folder : "temporary";
    if (!name || name.length > 255 || folder.length > 100 || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DIRECT_UPLOAD_BYTES) {
      return NextResponse.json({ error: "A valid file name and size are required." }, { status: 400 });
    }
    if (bucket !== "uploads") return NextResponse.json({ error: "User uploads are restricted to the uploads bucket." }, { status: 403 });
    if (!isAllowedMimeType(mimeType, ALLOWED_MEDIA_MIME_TYPES)) return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });

    const service = createServiceSupabaseClient();
    await cleanupExpiredUploadIntents(auth.user.id);
    const { data: reserved, error: reserveError } = await service.rpc("reserve_storage_upload", {
      p_user_id: auth.user.id,
      p_size_bytes: sizeBytes,
    });
    if (reserveError || reserved !== true) {
      return NextResponse.json({ error: reserveError?.message ?? "An active subscription and available storage quota are required." }, { status: 403 });
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]+/g, "-").replace(/^\/+|\/+$/g, "") || "temporary";
    const safeName = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "upload";
    const storagePath = `${auth.user.id}/${safeFolder}/${crypto.randomUUID()}-${safeName}`;
    const intentId = crypto.randomUUID();
    const { error: intentError } = await service.from("media_upload_intents").insert({
      id: intentId,
      user_id: auth.user.id,
      storage_bucket: bucket,
      storage_path: storagePath,
      original_name: name,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    });
    if (intentError) {
      await service.rpc("release_storage_reservation", { p_user_id: auth.user.id, p_size_bytes: sizeBytes });
      throw new Error(`Could not reserve upload: ${intentError.message}`);
    }

    const { data: signed, error: signedError } = await service.storage.from(bucket).createSignedUploadUrl(storagePath, { upsert: false });
    if (signedError || !signed?.token) {
      await service.from("media_upload_intents").delete().eq("id", intentId);
      await service.rpc("release_storage_reservation", { p_user_id: auth.user.id, p_size_bytes: sizeBytes });
      throw signedError ?? new Error("Could not create signed upload URL.");
    }

    return NextResponse.json({ intentId, bucket, storagePath, token: signed.token });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload could not be initiated." }, { status: 400 });
  }
}
