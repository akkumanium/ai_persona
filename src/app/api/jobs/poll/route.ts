import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { videoProvider } from "@/lib/providers";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const rateLimited = rateLimitRequest(request, { key: "jobs-poll", limit: 60, windowMs: 60 * 1000 });
    if (rateLimited) return rateLimited;

    const auth = await requireUserWhenSupabaseIsConfigured();
    if (auth.response) return auth.response;

    const { provider, providerJobId } = (await readJsonRequest(request, 8 * 1024) ?? {}) as {
      provider?: unknown;
      providerJobId?: unknown;
    };
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

    const result = await videoProvider.poll(provider ? `${String(provider)}:${providerJobId}` : String(providerJobId));
    return NextResponse.json(result);
  } catch (error) {
    const requestErrorResponse = requestBodyErrorResponse(error);
    if (requestErrorResponse) return requestErrorResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Polling failed." },
      { status: 500 },
    );
  }
}
