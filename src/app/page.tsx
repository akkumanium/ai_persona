import { HomePage } from "@/components/home-page";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabaseReady = hasSupabaseEnv();
  let initialUserEmail: string | undefined;

  if (supabaseReady) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    initialUserEmail = user?.email;
  }

  return <HomePage initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} />;
}
