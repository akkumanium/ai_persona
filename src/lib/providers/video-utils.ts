import type { GeneratedAssetPayload } from "@/lib/providers/types";

export function providerUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (cleanBase.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${cleanBase}${path.slice(3)}`;
  }

  if (cleanBase.endsWith("/api/v3") && path.startsWith("/api/v3/")) {
    return `${cleanBase}${path.slice(7)}`;
  }

  return `${cleanBase}${path}`;
}

export function normalizeVideoStatus(status: unknown) {
  const value = String(status ?? "queued").toLowerCase();
  if (["success", "succeed", "succeeded", "completed", "complete"].includes(value)) {
    return "succeeded" as const;
  }
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(value)) {
    return "failed" as const;
  }
  if (["running", "processing", "in_progress", "submitted"].includes(value)) {
    return "running" as const;
  }
  return "queued" as const;
}

export function videoAssetFromUrl(
  url: unknown,
  providerAssetId?: unknown,
): GeneratedAssetPayload | undefined {
  if (!url || typeof url !== "string") {
    return undefined;
  }

  return {
    url,
    mimeType: "video/mp4",
    providerAssetId: providerAssetId ? String(providerAssetId) : undefined,
  };
}

export function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}
