import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createBrowserSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase browser environment variables are not configured.");
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}
