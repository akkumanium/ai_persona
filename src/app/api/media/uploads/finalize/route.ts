import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { buildStorageObjectUrl } from "@/lib/media-urls";
import { finalizeDirectUpload } from "@/lib/server/direct-media-upload";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "media-upload-finalize", limit: 60, windowMs: 10 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;
    if (!auth.user || !env.supabaseServiceRoleKey) return NextResponse.json({ error: "Persistent storage is not configured." }, { status: 503 });
    const body = await readJsonRequest(request) as Record<string, unknown> | null;
    const intentId = typeof body?.intentId === "string" ? body.intentId : "";
    if (!intentId) return NextResponse.json({ error: "Upload intent is required." }, { status: 400 });

    const service = createServiceSupabaseClient();
    const { data: intent, error } = await service.from("media_upload_intents")
      .select("id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,status,expires_at")
      .eq("id", intentId).eq("user_id", auth.user.id).maybeSingle();
    if (error || !intent) return NextResponse.json({ error: "Upload intent was not found." }, { status: 404 });
    if (intent.status !== "pending" || Date.parse(intent.expires_at) <= Date.now()) {
      return NextResponse.json({ error: "Upload intent has expired or was already used." }, { status: 409 });
    }

    await finalizeDirectUpload(intent);
    return NextResponse.json({
      name: intent.original_name,
      mimeType: intent.mime_type,
      url: buildStorageObjectUrl(intent.storage_bucket, intent.storage_path),
      storageBucket: intent.storage_bucket,
      storagePath: intent.storage_path,
    });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload could not be finalized." }, { status: 400 });
  }
}
