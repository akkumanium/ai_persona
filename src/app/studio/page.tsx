import { redirect } from "next/navigation";
import { StudioWorkspace } from "@/components/studio-workspace";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Studio | Persona Studio",
  description: "Create personas, references, images, and videos in Persona Studio.",
};

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/");
    }
  }

  return <StudioWorkspace />;
}
