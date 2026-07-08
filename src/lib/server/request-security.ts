import { NextResponse } from "next/server";
import { MAX_JSON_BODY_BYTES, formatBytes } from "@/lib/media-limits";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Request body is too large. Keep it under ${formatBytes(maxBytes)}.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidJsonBodyError extends Error {
  constructor() {
    super("Request body must be valid JSON.");
    this.name = "InvalidJsonBodyError";
  }
}

export function requestBodyErrorResponse(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) {
    return NextResponse.json({ error: error.message }, { status: 413 });
  }
  if (error instanceof InvalidJsonBodyError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return undefined;
}

export function checkContentLength(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;

  const parsed = Number(contentLength);
  if (Number.isFinite(parsed) && parsed > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }
}

export async function readJsonRequest(request: Request, maxBytes = MAX_JSON_BODY_BYTES) {
  checkContentLength(request, maxBytes);

  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) return null;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function rateLimitRequest(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const bucketKey = `${options.key}:${clientIp}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= options.limit) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))),
      },
    },
  );
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}
