import { HomePage } from "@/components/home-page";
import { hasSupabaseEnv } from "@/lib/env";

export default function Home() {
  const supabaseReady = hasSupabaseEnv();
  return <HomePage supabaseReady={supabaseReady} />;
}
