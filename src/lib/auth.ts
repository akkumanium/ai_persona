import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUserWhenSupabaseIsConfigured() {
  if (!hasSupabaseEnv()) {
    return {
      user: null,
      response: NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 503 }),
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication is required." }, { status: 401 }),
    };
  }

  return { user, response: null };
}
