import { redirect } from "next/navigation";
import { getPublicPaddleConfig } from "@/lib/billing";
import { StudioPaywall } from "@/components/studio-paywall";
import { StudioWorkspace } from "@/components/studio-workspace";
import { hasSupabaseEnv } from "@/lib/env";
import { getBillingAccess } from "@/lib/server/billing-access";
import { cleanupStalePendingGenerationJobs } from "@/lib/server/studio-persistence";
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
  title: "Studio | Idolborn",
  description: "Create personas, references, images, and videos in Idolborn.",
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

  // Synchronous provider requests have no provider job id to poll. If the
  // request dies after its local row is created, that row used to remain
  // "queued" forever and looked like a generation the user never started.
  await cleanupStalePendingGenerationJobs(supabase, user.id);

  const [personas, assets, jobs, ledger, imagePromptSuggestions] = await Promise.all([
    supabase.from("personas").select("id, name, description, style_notes, status, reference_asset_id, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("assets").select("id, kind, public_url, storage_bucket, storage_path, title, prompt, persona_id, reference_asset_ids, reference_slot, is_default_reference, generation_type, provider, provider_job_id, provider_asset_id, model, mime_type, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("generation_jobs").select("id, status, provider, provider_job_id, model, generation_type, input_params, persona_id, cost_estimate_cents, error_message, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("credit_ledger").select("id, job_id, amount_cents, description, created_at").order("created_at", { ascending: false }).limit(100),
    loadImagePromptSuggestions(),
  ]);

  for (const result of [personas, assets, jobs, ledger]) {
    if (result.error) {
      throw new Error(`Could not load studio data: ${result.error.message}`);
    }
  }

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
      personaLimit={access.personaLimit}
      imagePromptSuggestions={imagePromptSuggestions}
      previewMode={!access.hasActiveSubscription}
    />
  );
}
