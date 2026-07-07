import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { access, mkdir, readFile, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { assertSafeRemoteMediaUrl } from "@/lib/server/media-storage";
import { saveTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];
const execFileAsync = promisify(execFile);

type DownloadedVideo = {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
};

type ExecFileError = Error & {
  code?: string;
  stderr?: string;
};

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

    const downloaded =
      await downloadDirectVideo(parsed) ??
      await downloadFromPageMetadata(parsed) ??
      await downloadWithYtDlp(parsed);

    const saved = await saveTempMedia({
      bytes: downloaded.bytes,
      mimeType: downloaded.mimeType,
      originalName: downloaded.originalName,
      userId: auth.user?.id,
    });

    return NextResponse.json({
      name: downloaded.originalName,
      mimeType: downloaded.mimeType,
      sizeBytes: downloaded.bytes.byteLength,
      url: saved.url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video import failed." },
      { status: 400 },
    );
  }
}

async function downloadDirectVideo(url: URL, referer?: string): Promise<DownloadedVideo | undefined> {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "video/*,text/html,*/*;q=0.8",
      Referer: referer ?? url.origin,
      "User-Agent": browserUserAgent(),
    },
    redirect: "follow",
  });

  if (!response.ok) return undefined;

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_VIDEO_BYTES) {
    throw new Error("Video links must be under 100 MB.");
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  const hasVideoExtension = VIDEO_EXTENSIONS.some((extension) => url.pathname.toLowerCase().endsWith(extension));
  if (!mimeType.startsWith("video/") && !hasVideoExtension) return undefined;

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("Video links must be under 100 MB.");
  }

  return {
    bytes,
    mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4",
    originalName: decodeURIComponent(url.pathname.split("/").pop() || "trend-video.mp4"),
  };
}

async function downloadFromPageMetadata(pageUrl: URL): Promise<DownloadedVideo | undefined> {
  const response = await fetch(pageUrl.toString(), {
    headers: {
      Accept: "text/html,*/*;q=0.8",
      "User-Agent": browserUserAgent(),
    },
    redirect: "follow",
  });
  if (!response.ok) return undefined;

  const html = await response.text();
  const videoUrl = extractVideoUrlFromHtml(html, pageUrl);
  if (!videoUrl) return undefined;

  await assertSafeRemoteMediaUrl(videoUrl);
  return downloadDirectVideo(videoUrl, pageUrl.toString());
}

async function downloadWithYtDlp(url: URL): Promise<DownloadedVideo> {
  const tempDir = join(tmpdir(), "persona-studio-imports");
  const outputPath = join(tempDir, `${randomUUID()}.mp4`);
  const ytdlpPaths = [
    process.env.YTDLP_PATH,
    join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
    "yt-dlp",
  ].filter((path): path is string => Boolean(path));

  await mkdir(tempDir, { recursive: true });

  try {
    let lastError: unknown;
    for (const ytdlpPath of ytdlpPaths) {
      try {
        if (ytdlpPath !== "yt-dlp") {
          await access(ytdlpPath);
        }
        await execFileAsync(
          ytdlpPath,
          [
            "--no-playlist",
            "--max-filesize",
            `${MAX_VIDEO_BYTES}`,
            "--merge-output-format",
            "mp4",
            "-f",
            "best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/bv*+ba/best",
            "-o",
            outputPath,
            url.toString(),
          ],
          { timeout: 120000, maxBuffer: 1024 * 1024 },
        );
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;

    const fileStat = await stat(outputPath);
    if (fileStat.size > MAX_VIDEO_BYTES) {
      throw new Error("Video links must be under 100 MB.");
    }

    return {
      bytes: new Uint8Array(await readFile(outputPath)),
      mimeType: "video/mp4",
      originalName: `${socialVideoName(url)}.mp4`,
    };
  } catch (error) {
    const execError = error as ExecFileError;
    const message = [execError.message, execError.stderr].filter(Boolean).join("\n");
    if (message.includes("not recognized") || message.includes("ENOENT") || message.includes("spawn") || execError.code === "ENOENT") {
      throw new Error("That link did not resolve to a direct video. Install yt-dlp on the server or upload the clip.");
    }
    if (message.includes("File is larger than max-filesize")) {
      throw new Error("Video links must be under 100 MB.");
    }
    if (message.includes("Requested format is not available") || message.includes("No video formats found")) {
      throw new Error("That link does not expose a downloadable video.");
    }
    throw new Error("Could not download that video link.");
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}

function extractVideoUrlFromHtml(html: string, baseUrl: URL) {
  const candidates = [
    /<meta\s+(?:property|name)=["'](?:og:video|og:video:url|twitter:player:stream)["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:video|og:video:url|twitter:player:stream)["']/i,
    /"video_url"\s*:\s*"([^"]+)"/i,
    /"playable_url"\s*:\s*"([^"]+)"/i,
    /"contentUrl"\s*:\s*"([^"]+\.(?:mp4|webm|mov|m4v)[^"]*)"/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    try {
      return new URL(decodeHtmlValue(raw), baseUrl);
    } catch {
      continue;
    }
  }

  return undefined;
}

function decodeHtmlValue(value: string) {
  return value
    .replaceAll("\\/", "/")
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x2F;", "/");
}

function socialVideoName(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? parts.at(-2) ?? "trend-video";
}

function browserUserAgent() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
}
