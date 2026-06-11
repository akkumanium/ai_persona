import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
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

  if (!bucket || !storagePath) {
    return NextResponse.json({ error: "Bucket and path are required." }, { status: 400 });
  }
  if (!storagePath.startsWith(`${auth.user.id}/`)) {
    return NextResponse.json({ error: "Storage path is outside the current user scope." }, { status: 403 });
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: "Storage object not found." }, { status: 404 });
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
