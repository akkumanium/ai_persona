import { NextResponse } from "next/server";
import { saveTempMedia } from "@/lib/server/temp-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const saved = await saveTempMedia({
    bytes: buffer,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
  });

  return NextResponse.json({
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    url: saved.url,
  });
}
