import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { access, mkdir, readFile, stat, unlink } from "fs/promises";
import { createRequire } from "module";
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
const DEFAULT_YTDLP_IMPERSONATE_TARGET = "chrome";
const DEFAULT_APIFY_INSTAGRAM_ACTOR_ID = "apify~instagram-scraper";
const DEFAULT_APIFY_TIMEOUT_SECONDS = 90;
const execFileAsync = promisify(execFile);
const requireFromRoute = createRequire(import.meta.url);
const loggedYtDlpVersions = new Set<string>();

type DownloadedVideo = {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
};

type ExecFileError = Error & {
  code?: string;
  stderr?: string;
  stdout?: string;
};

type YtDlpConstants = {
  YOUTUBE_DL_PATH?: string;
};

type YtDlpDownloadOptions = {
  useCookies: boolean;
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

    let ytDlpError: Error | undefined;
    let apifyError: Error | undefined;
    let downloaded = await downloadDirectVideo(parsed);

    if (!downloaded) {
      try {
        downloaded = await downloadWithYtDlp(parsed, { useCookies: false });
      } catch (error) {
        ytDlpError = toError(error);
      }
    }

    if (!downloaded) {
      try {
        downloaded = await downloadFromApifyInstagramScraper(parsed);
      } catch (error) {
        apifyError = toError(error);
      }
    }

    downloaded ??= await downloadFromPageMetadata(parsed);

    if (!downloaded && hasYtDlpCookieConfig()) {
      try {
        downloaded = await downloadWithYtDlp(parsed, { useCookies: true });
      } catch (error) {
        ytDlpError ??= toError(error);
      }
    }

    if (!downloaded) {
      throw apifyError ?? ytDlpError ?? new Error("Could not download that video link. If it keeps failing, download it manually and upload the file.");
    }

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
  const candidates = [pageUrl, ...extraPageCandidates(pageUrl)];
  for (const candidate of candidates) {
    let response: Response;
    try {
      response = await fetch(candidate.toString(), {
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": browserUserAgent(),
        },
        redirect: "follow",
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;

    const html = await response.text();
    const videoUrl = extractVideoUrlFromHtml(html, candidate);
    if (!videoUrl) continue;

    await assertSafeRemoteMediaUrl(videoUrl);
    const downloaded = await downloadDirectVideo(videoUrl, candidate.toString());
    if (downloaded) return downloaded;
  }
  return undefined;
}

function extraPageCandidates(url: URL): URL[] {
  if (!/(^|\.)instagram\./i.test(url.hostname)) return [];
  const shortcodeMatch = url.pathname.match(/\/(?:p|reel|reels|tv)\/([^/]+)/i);
  if (!shortcodeMatch) return [];
  const shortcode = shortcodeMatch[1];
  try {
    return [new URL(`https://www.instagram.com/p/${shortcode}/embed/captioned/`)];
  } catch {
    return [];
  }
}

async function downloadFromApifyInstagramScraper(pageUrl: URL): Promise<DownloadedVideo | undefined> {
  const token = apifyToken();
  if (!token || !isInstagramUrl(pageUrl)) return undefined;

  const endpoint = new URL(`https://api.apify.com/v2/actors/${apifyInstagramActorId()}/run-sync-get-dataset-items`);
  endpoint.searchParams.set("timeout", String(apifyTimeoutSeconds()));
  endpoint.searchParams.set("maxItems", "1");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");
  if (process.env.APIFY_MAX_TOTAL_CHARGE_USD?.trim()) {
    endpoint.searchParams.set("maxTotalChargeUsd", process.env.APIFY_MAX_TOTAL_CHARGE_USD.trim());
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(apifyInstagramInput(pageUrl)),
  });

  if (!response.ok) {
    throw new Error(`Apify Instagram scraper failed with HTTP ${response.status}: ${await apifyErrorMessage(response)}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  if (contentType.startsWith("video/")) {
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_VIDEO_BYTES) {
      throw new Error("Video links must be under 100 MB.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      throw new Error("Video links must be under 100 MB.");
    }

    return {
      bytes,
      mimeType: contentType,
      originalName: `${socialVideoName(pageUrl)}.${extensionFromMimeType(contentType)}`,
    };
  }

  const payload = await response.json();
  for (const videoUrl of videoUrlsFromPayload(payload)) {
    await assertSafeRemoteMediaUrl(videoUrl);
    const downloaded = await downloadDirectVideo(videoUrl, pageUrl.toString());
    if (downloaded) return downloaded;
  }

  throw new Error("Apify Instagram scraper did not return a downloadable video URL for that link.");
}

function apifyToken() {
  return process.env.APIFY_TOKEN?.trim() || process.env.APIFY_API_TOKEN?.trim();
}

function apifyInstagramActorId() {
  return encodeURIComponent((process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || DEFAULT_APIFY_INSTAGRAM_ACTOR_ID).replace("/", "~"));
}

function apifyTimeoutSeconds() {
  const configured = Number(process.env.APIFY_TIMEOUT_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_APIFY_TIMEOUT_SECONDS;
  return Math.min(300, Math.max(10, Math.round(configured)));
}

function apifyInstagramInput(pageUrl: URL) {
  return {
    directUrls: [pageUrl.toString()],
    resultsType: isInstagramReelUrl(pageUrl) ? "reels" : "posts",
    resultsLimit: 1,
    searchType: "hashtag",
    searchLimit: 1,
  };
}

async function apifyErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? payload?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function isInstagramReelUrl(url: URL) {
  return /\/reels?\//i.test(url.pathname);
}

function isInstagramUrl(url: URL) {
  return /(^|\.)instagram\./i.test(url.hostname);
}

async function downloadWithYtDlp(url: URL, options: YtDlpDownloadOptions): Promise<DownloadedVideo> {
  const tempDir = join(tmpdir(), "persona-studio-imports");
  const outputPath = join(tempDir, `${randomUUID()}.mp4`);
  const ytdlpArgs = [
    "--no-playlist",
    "--no-check-certificates",
    "--no-cache-dir",
    "--impersonate",
    ytDlpImpersonateTarget(),
    ...ytDlpCookieArgs(options),
    "--max-filesize",
    `${MAX_VIDEO_BYTES}`,
    "--merge-output-format",
    "mp4",
    "-f",
    "best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/bv*+ba/best",
    "-o",
    outputPath,
    url.toString(),
  ];

  await mkdir(tempDir, { recursive: true });

  try {
    await runYtDlp(url, ytdlpArgs);
    return await readYtDlpOutput(outputPath, url);
  } catch (error) {
    const execError = error as ExecFileError;
    const message = [execError.message, execError.stderr].filter(Boolean).join("\n");
    if (isExecutableMissing(error)) {
      throw new Error("That link did not resolve to a direct video. Install yt-dlp on the server or upload the clip.");
    }
    if (message.includes("File is larger than max-filesize")) {
      throw new Error("Video links must be under 100 MB.");
    }
    if (message.includes("Requested format is not available") || message.includes("No video formats found")) {
      throw new Error("That link does not expose a downloadable video. It may require login or be region-restricted. Try uploading the clip directly.");
    }
    if (/login required|log in|cookies|private|unavailable|empty media response/i.test(message)) {
      throw new Error(
        "That video requires a login to access. Configure YTDLP_COOKIES_PATH on the server or upload the clip directly.",
      );
    }
    throw new Error("Could not download that video link. If it keeps failing, download it manually and upload the file.");
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}

function isExecutableMissing(error: unknown) {
  const execError = error as ExecFileError;
  const message = [execError.message, execError.stderr].filter(Boolean).join("\n");
  return (
    message.includes("not recognized") ||
    message.includes("ENOENT") ||
    message.includes("yt-dlp executable was not found") ||
    execError.code === "ENOENT"
  );
}

async function canAccessYtDlpBinary(ytdlpPath: string) {
  if (ytdlpPath === "yt-dlp") return true;

  try {
    await access(ytdlpPath);
    return true;
  } catch {
    return false;
  }
}

async function runYtDlp(url: URL, ytdlpArgs: string[]) {
  let lastMissingError: unknown;

  for (const ytdlpPath of ytDlpBinaryCandidates()) {
    if (!(await canAccessYtDlpBinary(ytdlpPath))) continue;

    try {
      await logYtDlpVersion(ytdlpPath);
      await execFileAsync(ytdlpPath, ytdlpArgs, { timeout: 120000, maxBuffer: 1024 * 1024 });
      return;
    } catch (error) {
      if (isExecutableMissing(error)) {
        lastMissingError = error;
        continue;
      }

      console.warn(`[media-import] yt-dlp could not download ${url.hostname} with ${ytdlpPath}.`, error);
      throw error;
    }
  }

  throw lastMissingError ?? new Error("yt-dlp executable was not found.");
}

async function readYtDlpOutput(outputPath: string, url: URL): Promise<DownloadedVideo> {
  const fileStat = await stat(outputPath);
  if (fileStat.size > MAX_VIDEO_BYTES) {
    throw new Error("Video links must be under 100 MB.");
  }

  return {
    bytes: new Uint8Array(await readFile(outputPath)),
    mimeType: "video/mp4",
    originalName: `${socialVideoName(url)}.mp4`,
  };
}

function ytDlpBinaryCandidates() {
  const bundledBinaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const candidates = [
    process.env.YTDLP_PATH,
    resolveBundledYtDlpPath(),
    join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", bundledBinaryName),
    "yt-dlp",
  ].filter((path): path is string => Boolean(path));

  return [...new Set(candidates)];
}

function resolveBundledYtDlpPath() {
  try {
    const constants = requireFromRoute("youtube-dl-exec/src/constants") as YtDlpConstants;
    if (constants.YOUTUBE_DL_PATH) return constants.YOUTUBE_DL_PATH;
  } catch {
    return undefined;
  }
}

async function logYtDlpVersion(ytdlpPath: string) {
  if (loggedYtDlpVersions.has(ytdlpPath)) return;

  try {
    const { stdout } = await execFileAsync(ytdlpPath, ["--version"], { timeout: 10000, maxBuffer: 64 * 1024 });
    const version = stdout.trim();
    console.info(`[media-import] Using yt-dlp ${version || "unknown"} from ${ytdlpPath} with impersonation target ${ytDlpImpersonateTarget()}.`);
  } catch (error) {
    console.warn(`[media-import] Could not read yt-dlp version from ${ytdlpPath}.`, error);
  } finally {
    loggedYtDlpVersions.add(ytdlpPath);
  }
}

function ytDlpImpersonateTarget() {
  return process.env.YTDLP_IMPERSONATE_TARGET?.trim() || DEFAULT_YTDLP_IMPERSONATE_TARGET;
}

function hasYtDlpCookieConfig() {
  return Boolean(process.env.YTDLP_COOKIES_PATH?.trim() || process.env.YTDLP_COOKIES_FROM_BROWSER?.trim());
}

function ytDlpCookieArgs(options: YtDlpDownloadOptions) {
  if (!options.useCookies) return [];

  const cookiesPath = process.env.YTDLP_COOKIES_PATH?.trim();
  if (cookiesPath) return ["--cookies", cookiesPath];

  const cookiesFromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER?.trim();
  if (cookiesFromBrowser) return ["--cookies-from-browser", cookiesFromBrowser];

  return [];
}

function videoUrlsFromPayload(payload: unknown) {
  const urls: URL[] = [];
  for (const rawUrl of collectUrlCandidates(payload)) {
    try {
      const url = new URL(rawUrl);
      if (["http:", "https:"].includes(url.protocol)) urls.push(url);
    } catch {
      continue;
    }
  }

  return urls;
}

function collectUrlCandidates(value: unknown, keyHint = "", seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) return [];
  if (typeof value === "string") {
    return /(?:video|download|media|url|src)/i.test(keyHint) && /^https?:\/\//i.test(value) ? [value] : [];
  }
  if (typeof value !== "object") return [];

  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUrlCandidates(item, keyHint, seen));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) =>
    collectUrlCandidates(nestedValue, key, seen),
  );
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/x-m4v") return "m4v";
  return "mp4";
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function extractVideoUrlFromHtml(html: string, baseUrl: URL) {
  const candidates = [
    /<meta\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']/i,
    /"playable_url_quality_hd"\s*:\s*"([^"]+)"/i,
    /"playable_url"\s*:\s*"([^"]+)"/i,
    /"video_url"\s*:\s*"([^"]+)"/i,
    /"video_version"\s*:\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/i,
    /"contentUrl"\s*:\s*"([^"]+\.(?:mp4|webm|mov|m4v)[^"]*)"/i,
    /"src"\s*:\s*"(https?:[^"]+\.(?:mp4|webm|mov|m4v)[^"]*)"/i,
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
