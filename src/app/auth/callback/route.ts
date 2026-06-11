import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = normalizeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const signInUrl = new URL("/auth/signin", requestUrl.origin);
      signInUrl.searchParams.set("next", next);
      signInUrl.searchParams.set("error", "callback");
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/studio";
  return value;
}
