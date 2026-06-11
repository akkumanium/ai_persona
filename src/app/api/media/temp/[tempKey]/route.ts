import { NextResponse } from "next/server";
import { readTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tempKey: string }> },
) {
  try {
    const { tempKey } = await context.params;
    const media = await readTempMedia(tempKey);
    return new NextResponse(media.bytes, {
      headers: {
        "Content-Type": media.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
}
