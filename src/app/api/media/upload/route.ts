import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { ALLOWED_MEDIA_MIME_TYPES, MAX_UPLOAD_BYTES, formatBytes, isAllowedMimeType } from "@/lib/media-limits";
import {
  RequestBodyTooLargeError,
  checkContentLength,
  rateLimitRequest,
  requestBodyErrorResponse,
} from "@/lib/server/request-security";
import { saveTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimited = rateLimitRequest(request, { key: "media-upload", limit: 30, windowMs: 10 * 60 * 1000 });
    if (rateLimited) return rateLimited;
    checkContentLength(request, MAX_UPLOAD_BYTES + 64 * 1024);

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new RequestBodyTooLargeError(MAX_UPLOAD_BYTES);
    }
    if (!isAllowedMimeType(file.type || "application/octet-stream", ALLOWED_MEDIA_MIME_TYPES)) {
      return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const saved = await saveTempMedia({
      bytes: buffer,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      userId: auth.user?.id,
    });

    return NextResponse.json({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      url: saved.url,
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
