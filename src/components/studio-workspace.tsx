"use client";

import { Activity, Clapperboard, ImageIcon, Play, Settings, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { AssetsView, JobsView, SettingsView } from "@/components/studio/assets-jobs-settings";
import { GeneratePersonaView } from "@/components/studio/generate-persona-view";
import { GenerationView } from "@/components/studio/generation-view";
import { PersonasView } from "@/components/studio/personas-view";
import type { ReferenceSlotId, View } from "@/components/studio/types";
import { demoAssets, demoJobs, demoPersonas } from "@/lib/demo-data";
import type { StudioInitialData } from "@/lib/studio-records";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatCredits } from "@/lib/utils";

const navItems = [
  { id: "personas", label: "Personas", icon: UserRound },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Clapperboard },
  { id: "motion", label: "Motion Control", icon: Play },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function StudioWorkspace({
  initialData,
  supabaseReady,
}: {
  initialData?: StudioInitialData;
  supabaseReady?: boolean;
}) {
  const [view, setView] = useState<View>("personas");
  const [personas, setPersonas] = useState<Persona[]>(initialData?.personas ?? demoPersonas);
  const [assets, setAssets] = useState<Asset[]>(initialData?.assets ?? demoAssets);
  const [jobs, setJobs] = useState<GenerationJob[]>(initialData?.jobs ?? demoJobs);
  const [balanceCents, setBalanceCents] = useState(initialData?.balanceCents ?? (supabaseReady ? 0 : 5000));
  const [userId, setUserId] = useState<string | undefined>();
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    initialData?.personas[0]?.id ?? demoPersonas[0]?.id ?? "",
  );
  const [generateInitialSlotId, setGenerateInitialSlotId] = useState<ReferenceSlotId | undefined>();
  const [notice, setNotice] = useState(
    supabaseReady ? "Your workspace is saved." : "Demo workspace is active until Supabase is set.",
  );

  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const personaReferenceAssets = assets.filter(
    (asset) =>
      asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
  );
  const selectedReference =
    personaReferenceAssets.find((asset) => asset.isDefaultReference) ??
    assets.find((asset) => asset.id === selectedPersona?.referenceAssetId) ??
    personaReferenceAssets[0];
  const displayedBalanceCents = Math.max(0, balanceCents);

  function supabaseClient() {
    return supabaseReady ? createBrowserSupabaseClient() : undefined;
  }

  async function supabaseContext() {
    const client = supabaseClient();
    if (!client) return undefined;
    if (userId) return { client, userId };
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return undefined;
    setUserId(user.id);
    return { client, userId: user.id };
  }

  function addJob(job: GenerationJob) {
    setJobs((current) => [job, ...current]);
  }

  function addAssets(nextAssets: Asset[], job?: GenerationJob) {
    setAssets((current) => [...nextAssets, ...current]);
    if (job?.costEstimateCents) {
      setBalanceCents((current) => Math.max(0, current - job.costEstimateCents));
    }
  }

  function addGeneratedReferenceAssets(nextAssets: Asset[], job: GenerationJob) {
    addAssets(nextAssets, job);
    const personaId = nextAssets[0]?.personaId;
    const nextReferenceId =
      nextAssets.find((asset) => asset.isDefaultReference)?.id ?? nextAssets[0]?.id;
    if (!personaId || !nextReferenceId) return;

    setPersonas((current) =>
      current.map((persona) =>
        persona.id === personaId && !persona.referenceAssetId
          ? { ...persona, referenceAssetId: nextReferenceId }
          : persona,
      ),
    );
    void supabaseClient()
      ?.from("personas")
      .update({ reference_asset_id: nextReferenceId })
      .eq("id", personaId)
      .is("reference_asset_id", null);
  }

  function updatePersona(personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) {
    setPersonas((current) =>
      current.map((persona) => (persona.id === personaId ? { ...persona, ...updates } : persona)),
    );
    void supabaseClient()
      ?.from("personas")
      .update({
        name: updates.name,
        description: updates.description,
        style_notes: updates.styleNotes,
      })
      .eq("id", personaId);
  }

  function renameReferenceAsset(assetId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, title: nextTitle } : asset)),
    );
    void supabaseClient()?.from("assets").update({ title: nextTitle }).eq("id", assetId);
  }

  function addPersona(persona: Persona) {
    setPersonas((current) => [persona, ...current]);
    setSelectedPersonaId(persona.id);
    void (async () => {
      const context = await supabaseContext();
      if (!context) return;
      await context.client.from("personas").insert({
        id: persona.id,
        user_id: context.userId,
        name: persona.name,
        description: persona.description,
        style_notes: persona.styleNotes,
        status: persona.status,
        reference_asset_id: persona.referenceAssetId ?? null,
        created_at: persona.createdAt,
      });
    })();
  }

  function deletePersona(personaId: string) {
    setPersonas((current) => current.filter((persona) => persona.id !== personaId));
    setSelectedPersonaId((currentId) => {
      if (currentId !== personaId) return currentId;
      return personas.find((persona) => persona.id !== personaId)?.id ?? "";
    });
    void supabaseClient()?.from("personas").delete().eq("id", personaId);
  }

  function addReferenceAssets(personaId: string, nextAssets: Asset[]) {
    setAssets((current) => [...nextAssets, ...current]);
    setPersonas((current) =>
      current.map((persona) => {
        if (persona.id !== personaId) return persona;
        if (persona.referenceAssetId) return persona;
        const nextReferenceId =
          nextAssets.find((asset) => asset.isDefaultReference)?.id ?? nextAssets[0]?.id;
        return nextReferenceId ? { ...persona, referenceAssetId: nextReferenceId } : persona;
      }),
    );
    const client = supabaseClient();
    if (client) {
      void (async () => {
        const context = await supabaseContext();
        if (!context) return;
        await context.client.from("assets").insert(nextAssets.map((asset) => assetToInsert(asset, context.userId)));
        const nextReferenceId =
          nextAssets.find((asset) => asset.isDefaultReference)?.id ?? nextAssets[0]?.id;
        if (nextReferenceId) {
          await context.client
            .from("personas")
            .update({ reference_asset_id: nextReferenceId })
            .eq("id", personaId)
            .is("reference_asset_id", null);
        }
      })();
    }
  }

  function toggleReferenceDefault(assetId: string) {
    const target = assets.find((asset) => asset.id === assetId);
    const nextValue = !target?.isDefaultReference;
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? { ...asset, isDefaultReference: nextValue }
          : asset,
      ),
    );
    void supabaseClient()
      ?.from("assets")
      .update({ is_default_reference: nextValue })
      .eq("id", assetId);
  }

  function deleteAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;

    setAssets((currentAssets) => {
      const nextAssets = currentAssets.filter((asset) => asset.id !== assetId);
      if (!asset.personaId || (asset.kind !== "avatar" && asset.kind !== "upload")) {
        return nextAssets;
      }
      const remainingReferences = nextAssets.filter(
        (item) =>
          item.personaId === asset.personaId && (item.kind === "avatar" || item.kind === "upload"),
      );
      const nextReferenceId =
        remainingReferences.find((asset) => asset.isDefaultReference)?.id ?? remainingReferences[0]?.id;
      setPersonas((currentPersonas) =>
        currentPersonas.map((persona) =>
          persona.id === asset.personaId ? { ...persona, referenceAssetId: nextReferenceId } : persona,
        ),
      );
      return nextAssets;
    });
    const client = supabaseClient();
    if (client) {
      void client.from("assets").delete().eq("id", assetId);
      if (asset.personaId && (asset.kind === "avatar" || asset.kind === "upload")) {
        const remainingReferences = assets.filter(
          (item) =>
            item.id !== assetId &&
            item.personaId === asset.personaId &&
            (item.kind === "avatar" || item.kind === "upload"),
        );
        const nextReferenceId =
          remainingReferences.find((item) => item.isDefaultReference)?.id ?? remainingReferences[0]?.id;
        void client
          .from("personas")
          .update({ reference_asset_id: nextReferenceId ?? null })
          .eq("id", asset.personaId);
      }
    }
  }

  function deleteReferenceAsset(_personaId: string, assetId: string) {
    deleteAsset(assetId);
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-68 border-r border-stone-200 bg-white/82 px-4 py-5 backdrop-blur lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-800 text-white">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-normal">Persona Studio</p>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
              Creator SaaS
            </p>
          </div>
        </div>

        <nav className="mt-8 grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-stone-600 transition",
                  view === item.id
                    ? "tab-selected text-white"
                    : "hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Balance</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{formatCredits(displayedBalanceCents)}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Available credit for new generations.</p>
        </div>
      </aside>

      <main className="lg:pl-68">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/84 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div>
              <h1 className="text-xl font-semibold text-stone-950">{navItems.find((item) => item.id === view)?.label}</h1>
              <p className="text-sm text-stone-500">{notice}</p>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium",
                    view === item.id ? "bg-emerald-800 text-white" : "bg-white text-stone-700",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="px-4 py-6 lg:px-8">
          {view === "personas" && (
            <PersonasView
              personas={personas}
              assets={assets}
              selectedPersonaId={selectedPersona?.id}
              onSelect={setSelectedPersonaId}
              onUpdatePersona={updatePersona}
              onCreatePersona={(persona) => {
                addPersona(persona);
                setNotice(`${persona.name} is ready for references.`);
              }}
              onDeletePersona={(personaId) => {
                const personaName = personas.find((persona) => persona.id === personaId)?.name ?? "Persona";
                deletePersona(personaId);
                setNotice(`${personaName} was removed. Existing assets were left untouched.`);
              }}
              onAddReferences={(personaId, nextAssets) => {
                addReferenceAssets(personaId, nextAssets);
                setNotice(`${nextAssets.length} reference asset${nextAssets.length === 1 ? "" : "s"} added.`);
              }}
              onToggleReferenceDefault={toggleReferenceDefault}
              onDeleteReference={deleteReferenceAsset}
              onRenameReference={renameReferenceAsset}
              onNavigateToGenerate={(slotId, personaId) => {
                if (personaId) setSelectedPersonaId(personaId);
                setGenerateInitialSlotId(slotId);
                setView("generate");
              }}
            />
          )}
          {view === "generate" && (
            <GeneratePersonaView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              initialSlotId={generateInitialSlotId}
              onAssetsCreated={(nextAssets, job) => {
                addGeneratedReferenceAssets(nextAssets, job);
                addJob(job);
                setNotice(`${nextAssets.length} reference asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onBack={() => {
                setGenerateInitialSlotId(undefined);
                setView("personas");
              }}
            />
          )}
          {(view === "images" || view === "videos" || view === "motion") && (
            <GenerationView
              mode={view}
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              selectedReference={selectedReference}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets, job);
                addJob(job);
                setNotice(`${nextAssets.length} asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onDeleteAsset={deleteAsset}
            />
          )}
          {view === "assets" && <AssetsView assets={assets} personas={personas} onDeleteAsset={deleteAsset} />}
          {view === "jobs" && <JobsView jobs={jobs} />}
          {view === "settings" && <SettingsView balanceCents={displayedBalanceCents} />}
        </div>
      </main>
    </div>
  );
}

function assetToInsert(asset: Asset, userId: string) {
  return {
    id: asset.id,
    user_id: userId,
    persona_id: asset.personaId ?? null,
    kind: asset.kind,
    public_url: asset.url,
    title: asset.title,
    prompt: asset.prompt,
    reference_asset_ids: asset.referenceAssetIds ?? [],
    reference_slot: asset.referenceSlot ?? null,
    is_default_reference: Boolean(asset.isDefaultReference),
    generation_type: asset.generationType,
    provider: asset.provider,
    provider_job_id: asset.providerJobId ?? null,
    model: asset.model,
    mime_type: asset.mimeType,
    provider_asset_id: asset.providerAssetId ?? null,
    created_at: asset.createdAt,
  };
}
