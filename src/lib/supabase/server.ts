import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createServiceSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase service environment variables are not configured.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
