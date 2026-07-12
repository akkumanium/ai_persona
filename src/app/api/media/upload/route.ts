import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { ALLOWED_MEDIA_MIME_TYPES, MAX_UPLOAD_BYTES, formatBytes, isAllowedMimeType } from "@/lib/media-limits";
import {
  RequestBodyTooLargeError,
  checkContentLength,
  rateLimitRequest,
  requestBodyErrorResponse,
} from "@/lib/server/request-security";
import { env } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimited = await rateLimitRequest(request, { key: "media-upload", limit: 30, windowMs: 10 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    checkContentLength(request, MAX_UPLOAD_BYTES + 64 * 1024);

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedBucket = String(formData.get("bucket") ?? "uploads");
    const requestedFolder = String(formData.get("folder") ?? "temporary");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new RequestBodyTooLargeError(MAX_UPLOAD_BYTES);
    }
    if (!isAllowedMimeType(file.type || "application/octet-stream", ALLOWED_MEDIA_MIME_TYPES)) {
      return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
    }
    if (requestedBucket !== "uploads") {
      return NextResponse.json({ error: "User uploads are restricted to the uploads bucket." }, { status: 403 });
    }
    if (!auth.user?.id || !env.supabaseServiceRoleKey) {
      return NextResponse.json({ error: "Persistent authenticated storage is not configured." }, { status: 503 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    assertFileSignature(buffer, file.type || "application/octet-stream");
    const service = createServiceSupabaseClient();
    const { data: reserved, error: reserveError } = await service.rpc("reserve_storage_upload", {
      p_user_id: auth.user.id,
      p_size_bytes: file.size,
    });
    if (reserveError || reserved !== true) {
      return NextResponse.json({ error: reserveError?.message ?? "An active subscription and available storage quota are required." }, { status: 403 });
    }
    const safeFolder = requestedFolder.replace(/[^a-zA-Z0-9/_-]+/g, "-").replace(/^\/+|\/+$/g, "") || "temporary";
    const safeName = file.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "upload";
    const storagePath = `${auth.user.id}/${safeFolder}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await service.storage.from(requestedBucket).upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      await service.rpc("release_storage_reservation", { p_user_id: auth.user.id, p_size_bytes: file.size });
      throw uploadError;
    }

    return NextResponse.json({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      url: `/api/media/object?bucket=${encodeURIComponent(requestedBucket)}&path=${encodeURIComponent(storagePath)}`,
      storageBucket: requestedBucket,
      storagePath,
    });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Uploads must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.` },
      { status: 400 },
    );
  }
}

function assertFileSignature(bytes: Uint8Array, mimeType: string) {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const normalized = mimeType.toLowerCase();
  const valid = normalized.includes("png") ? startsWith(0x89, 0x50, 0x4e, 0x47)
    : normalized.includes("jpeg") || normalized.includes("jpg") ? startsWith(0xff, 0xd8, 0xff)
      : normalized.includes("gif") ? startsWith(0x47, 0x49, 0x46, 0x38)
        : normalized.includes("webp") ? startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          : normalized.includes("mp4") || normalized.includes("m4a") || normalized.includes("quicktime") ? String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
            : normalized.includes("webm") ? startsWith(0x1a, 0x45, 0xdf, 0xa3)
              : normalized.includes("wav") ? startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WAVE"
                : normalized.includes("mpeg") || normalized.includes("mp3") ? startsWith(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
                  : normalized.includes("ogg") || normalized.includes("opus") ? startsWith(0x4f, 0x67, 0x67, 0x53)
                    : normalized.includes("flac") ? startsWith(0x66, 0x4c, 0x61, 0x43)
                      : normalized.includes("aac") ? bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
                        : false;
  if (!valid) throw new Error("File contents do not match the declared media type.");
}
