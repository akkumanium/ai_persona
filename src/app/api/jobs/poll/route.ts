import { NextResponse } from "next/server";
import { videoProvider } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const { providerJobId } = await request.json();
    if (!providerJobId) {
      return NextResponse.json({ error: "providerJobId is required." }, { status: 400 });
    }

    const result = await videoProvider.poll(String(providerJobId));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Polling failed." },
      { status: 500 },
    );
  }
}
