import { redirect } from "next/navigation";
import { getPublicPaddleConfig } from "@/lib/billing";
import { StudioPaywall } from "@/components/studio-paywall";
import { StudioWorkspace } from "@/components/studio-workspace";
import { hasSupabaseEnv } from "@/lib/env";
import { getBillingAccess } from "@/lib/server/billing-access";
import { loadImagePromptSuggestions } from "@/lib/server/prompt-library";
import {
  emptyStudioData,
  mapAsset,
  mapJob,
  mapLedger,
  mapPersona,
  type StudioInitialData,
} from "@/lib/studio-records";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Studio | Persona Studio",
  description: "Create personas, references, images, and videos in Persona Studio.",
};

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  let initialData: StudioInitialData = emptyStudioData;
  const supabaseReady = hasSupabaseEnv();
  const paddleConfig = getPublicPaddleConfig();

  if (!supabaseReady) {
    return <StudioPaywall supabaseReady={false} paddleConfig={paddleConfig} />;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?next=/studio");
  }

  const access = await getBillingAccess(supabase, user.id);

  if (!access.hasStudioAccess) {
    redirect("/pricing");
  }

  const [personas, assets, jobs, ledger, imagePromptSuggestions] = await Promise.all([
    supabase.from("personas").select("*").order("created_at", { ascending: false }),
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
    supabase.from("generation_jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("credit_ledger").select("*").order("created_at", { ascending: false }),
    loadImagePromptSuggestions(),
  ]);

  initialData = {
    personas: (personas.data ?? []).map(mapPersona),
    assets: (assets.data ?? []).map(mapAsset),
    jobs: (jobs.data ?? []).map(mapJob),
    ledger: (ledger.data ?? []).map(mapLedger),
    balanceCents: access.balanceCents,
  };

  return (
    <StudioWorkspace
      initialData={initialData}
      supabaseReady={supabaseReady}
      initialUserId={user.id}
      initialUserEmail={user.email}
      paddleConfig={paddleConfig}
      imagePromptSuggestions={imagePromptSuggestions}
    />
  );
}
