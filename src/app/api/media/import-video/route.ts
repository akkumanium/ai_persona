import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { assertSafeRemoteMediaUrl } from "@/lib/server/media-storage";
import { saveTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "Paste a video URL first." }, { status: 400 });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http and https video links are supported." }, { status: 400 });
    }

    await assertSafeRemoteMediaUrl(parsed);

    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: "video/*,*/*;q=0.8",
        "User-Agent": "PersonaStudio/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Could not download that video link." }, { status: 400 });
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video links must be under 100 MB." }, { status: 413 });
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const hasVideoExtension = VIDEO_EXTENSIONS.some((extension) => parsed.pathname.toLowerCase().endsWith(extension));
    if (!mimeType.startsWith("video/") && !hasVideoExtension) {
      return NextResponse.json(
        { error: "That link did not resolve to a downloadable video file. Use a direct MP4/WebM link or upload the clip." },
        { status: 415 },
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video links must be under 100 MB." }, { status: 413 });
    }

    const originalName = decodeURIComponent(parsed.pathname.split("/").pop() || "trend-video.mp4");
    const saved = await saveTempMedia({
      bytes,
      mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4",
      originalName,
      userId: auth.user?.id,
    });

    return NextResponse.json({
      name: originalName,
      mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4",
      sizeBytes: bytes.byteLength,
      url: saved.url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video import failed." },
      { status: 400 },
    );
  }
}
