import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { isAllowedStorageBucket } from "@/lib/media-limits";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUserWhenSupabaseIsConfigured();
  if (auth.response) return auth.response;
  if (!auth.user || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Storage access is not available." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  const storagePath = searchParams.get("path");
  const variant = searchParams.get("variant");

  if (!bucket || !storagePath) {
    return NextResponse.json({ error: "Bucket and path are required." }, { status: 400 });
  }
  if (!isAllowedStorageBucket(bucket)) {
    return NextResponse.json({ error: "Storage bucket is not allowed." }, { status: 403 });
  }
  if (!storagePath.startsWith(`${auth.user.id}/`)) {
    return NextResponse.json({ error: "Storage path is outside the current user scope." }, { status: 403 });
  }

  const supabase = createServiceSupabaseClient();
  if (variant && variant !== "card") {
    return NextResponse.json({ error: "Media variant is not supported." }, { status: 400 });
  }

  const isCardImage = variant === "card" && bucket !== "generated-videos" && bucket !== "generated-audio";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(
    storagePath,
    60 * 60,
    isCardImage
      ? { transform: { width: 640, height: 640, resize: "contain", quality: 70 } }
      : undefined,
  );

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Storage object not found." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
