import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { readTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ tempKey: string }> },
) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const { tempKey } = await context.params;
    const media = await readTempMedia(tempKey, auth.user?.id);
    const range = request.headers.get("range");
    const total = media.bytes.byteLength;
    const parsedRange = range ? parseByteRange(range, total) : undefined;
    const bytes = parsedRange ? media.bytes.slice(parsedRange.start, parsedRange.end + 1) : media.bytes;

    return new NextResponse(bytes, {
      status: parsedRange ? 206 : 200,
      headers: {
        "Content-Type": media.mimeType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(bytes.byteLength),
        ...(parsedRange ? { "Content-Range": `bytes ${parsedRange.start}-${parsedRange.end}/${total}` } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
}

function parseByteRange(header: string, total: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || total < 1) return undefined;
  const requestedStart = match[1] ? Number(match[1]) : 0;
  const requestedEnd = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isSafeInteger(requestedStart) || !Number.isSafeInteger(requestedEnd) || requestedStart > requestedEnd || requestedStart >= total) {
    return undefined;
  }
  return { start: requestedStart, end: Math.min(requestedEnd, total - 1) };
}
