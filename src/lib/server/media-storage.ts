import { lookup } from "dns/promises";
import { isIP } from "net";
import { env, hasSupabaseEnv } from "@/lib/env";
import { buildStorageObjectUrl } from "@/lib/media-urls";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { readTempMedia, saveTempMedia } from "@/lib/server/temp-media";
import type { Asset } from "@/lib/types";

const APP_ORIGIN = "http://persona-studio.local";

export async function materializeGeneratedAsset(
  asset: Asset,
  userId?: string,
) {
  const content = await resolveAssetContent(asset.url, userId);
  const extension = extensionFromMimeType(content.mimeType);

  if (hasSupabaseEnv() && userId && env.supabaseServiceRoleKey) {
    const supabase = createServiceSupabaseClient();
    const bucket = asset.kind === "video" ? "generated-videos" : asset.kind === "audio" ? "generated-audio" : "generated-images";
    const folder = asset.kind === "video" ? "videos" : asset.kind === "audio" ? "audio" : "images";
    const storagePath = `${userId}/${folder}/${asset.id}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(storagePath, content.bytes, {
      contentType: content.mimeType,
      upsert: true,
    });

    if (!error) {
      return {
        ...asset,
        url: buildStorageObjectUrl(bucket, storagePath),
        storageBucket: bucket,
        storagePath,
        mimeType: content.mimeType,
      };
    }
  }

  const tempMedia = await saveTempMedia({
    bytes: content.bytes,
    mimeType: content.mimeType,
    originalName: asset.title,
    userId,
  });

  return {
    ...asset,
    url: tempMedia.url,
    storageBucket: undefined,
    storagePath: undefined,
    mimeType: content.mimeType,
  };
}

export async function mediaUrlToBase64Input(url: string, userId?: string) {
  const content = await resolveAssetContent(url, userId);
  return {
    mimeType: content.mimeType,
    data: Buffer.from(content.bytes).toString("base64"),
  };
}

export function sanitizeProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item));
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      if (value.startsWith("data:") && value.length > 128) return "[omitted data URL]";
      if (looksLikeBase64(value)) return "[omitted base64 payload]";
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => {
      if (typeof entry === "string") {
        if (entry.startsWith("data:") && entry.length > 128) return [key, "[omitted data URL]"];
        if (looksLikeBase64(entry) && /(^|_)(data|b64|base64|inline)(_|$)/i.test(key)) {
          return [key, "[omitted base64 payload]"];
        }
      }

      return [key, sanitizeProviderPayload(entry)];
    }),
  );
}

export async function resolveAssetContent(url: string, userId?: string) {
  const dataUrlMatch = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      bytes: Uint8Array.from(Buffer.from(dataUrlMatch[2], "base64")),
    };
  }

  const parsed = new URL(url, APP_ORIGIN);

  if (parsed.pathname === "/api/media/object") {
    const bucket = parsed.searchParams.get("bucket");
    const storagePath = parsed.searchParams.get("path");
    if (!bucket || !storagePath) {
      throw new Error("Media URL is missing storage details.");
    }
    if (userId && !storagePath.startsWith(`${userId}/`)) {
      throw new Error("Media URL is outside the current user scope.");
    }
    if (!env.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for proxied storage media.");
    }

    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) {
      throw error ?? new Error("Could not download storage media.");
    }

    return {
      mimeType: data.type || "application/octet-stream",
      bytes: new Uint8Array(await data.arrayBuffer()),
    };
  }

  if (parsed.pathname.startsWith("/api/media/temp/")) {
    const tempKey = parsed.pathname.split("/").pop();
    if (!tempKey) {
      throw new Error("Media URL is missing the temp media key.");
    }
    return readTempMedia(tempKey, userId);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Unsupported media URL.");
  }
  await assertSafeRemoteMediaUrl(parsed);

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    throw new Error("Could not download remote media.");
  }

  return {
    mimeType: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream",
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

export async function assertSafeRemoteMediaUrl(url: URL) {
  if (url.username || url.password) {
    throw new Error("Remote media URL credentials are not supported.");
  }

  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Remote media URL ports are restricted.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local media URLs are not supported.");
  }

  const directIpVersion = isIP(hostname);
  if (directIpVersion) {
    if (!isPublicIpAddress(hostname, directIpVersion)) {
      throw new Error("Private network media URLs are not supported.");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length) {
    throw new Error("Remote media host could not be resolved.");
  }

  if (addresses.some((address) => !isPublicIpAddress(address.address, address.family))) {
    throw new Error("Private network media URLs are not supported.");
  }
}

function isPublicIpAddress(address: string, family: number) {
  if (family === 4) {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a >= 224)
    );
  }

  const normalized = address.toLowerCase();
  return !(
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("opus")) return "opus";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("m4a")) return "m4a";
  return "png";
}

function looksLikeBase64(value: string) {
  return value.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}
