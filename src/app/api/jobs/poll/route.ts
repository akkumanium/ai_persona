import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { videoProvider } from "@/lib/providers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const { provider, providerJobId } = await request.json();
    if (!providerJobId) {
      return NextResponse.json({ error: "providerJobId is required." }, { status: 400 });
    }

    if (hasSupabaseEnv() && auth.user) {
      const supabase = await createServerSupabaseClient();
      const { data: job, error } = await supabase
        .from("generation_jobs")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("provider_job_id", String(providerJobId))
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!job) {
        return NextResponse.json({ error: "Generation job was not found for this account." }, { status: 404 });
      }
    }

    const result = await videoProvider.poll(provider ? `${provider}:${providerJobId}` : String(providerJobId));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Polling failed." },
      { status: 500 },
    );
  }
}
