"use client";

import { Activity, AudioLines, Clapperboard, Flame, Home, ImageIcon, Mail, Play, Settings, UserRound, Video, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AssetsView, JobsView, SettingsView } from "@/components/studio/assets-jobs-settings";
import { GeneratePersonaView } from "@/components/studio/generate-persona-view";
import { GenerationView } from "@/components/studio/generation-view";
import { PersonasView } from "@/components/studio/personas-view";
import { AvatarView, SpeechView } from "@/components/studio/speech-avatar-view";
import { TrendVideoView } from "@/components/studio/trend-video-view";
import type { ReferenceSlotId, View } from "@/components/studio/types";
import { demoAssets, demoJobs, demoPersonas } from "@/lib/demo-data";
import type { PublicPaddleConfig } from "@/lib/billing";
import type { StudioInitialData } from "@/lib/studio-records";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatTokens } from "@/lib/utils";

type PromptSuggestion = { title: string; prompt: string };

const navItems: Array<{ id: View; label: string; icon: LucideIcon; disabled?: boolean; badge?: string }> = [
  { id: "personas", label: "Personas", icon: UserRound },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Clapperboard },
  { id: "trends", label: "Trend Videos", icon: Flame },
  { id: "motion", label: "Motion Control", icon: Play },
  { id: "speech", label: "Speech", icon: AudioLines },
  { id: "avatar", label: "Avatar", icon: Video },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

export function StudioWorkspace({
  initialData,
  supabaseReady,
  initialUserId,
  initialUserEmail,
  paddleConfig,
  imagePromptSuggestions = [],
  previewMode = false,
}: {
  initialData?: StudioInitialData;
  supabaseReady?: boolean;
  initialUserId?: string;
  initialUserEmail?: string;
  paddleConfig: PublicPaddleConfig;
  imagePromptSuggestions?: PromptSuggestion[];
  previewMode?: boolean;
}) {
  const [view, setView] = useState<View>("personas");
  const [personas, setPersonas] = useState<Persona[]>(initialData?.personas ?? demoPersonas);
  const [assets, setAssets] = useState<Asset[]>(initialData?.assets ?? demoAssets);
  const [jobs, setJobs] = useState<GenerationJob[]>(initialData?.jobs ?? demoJobs);
  const [balanceCents, setBalanceCents] = useState(initialData?.balanceCents ?? (supabaseReady ? 0 : 5000));
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
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
      .is("reference_asset_id", null)
      .then(({ error }) => {
        if (error) setNotice(`Could not save default reference: ${error.message}`);
      });
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
      .eq("id", personaId)
      .then(({ error }) => {
        if (error) setNotice(`Could not save persona changes: ${error.message}`);
      });
  }

  function renameReferenceAsset(assetId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, title: nextTitle } : asset)),
    );
    void supabaseClient()
      ?.from("assets")
      .update({ title: nextTitle })
      .eq("id", assetId)
      .then(({ error }) => {
        if (error) setNotice(`Could not save asset name: ${error.message}`);
      });
  }

  function addPersona(persona: Persona) {
    setPersonas((current) => [persona, ...current]);
    setSelectedPersonaId(persona.id);
    void (async () => {
      const context = await supabaseContext();
      if (!context) return;
      const { error } = await context.client.from("personas").insert({
        id: persona.id,
        user_id: context.userId,
        name: persona.name,
        description: persona.description,
        style_notes: persona.styleNotes,
        status: persona.status,
        reference_asset_id: persona.referenceAssetId ?? null,
        created_at: persona.createdAt,
      });
      if (error) {
        setPersonas((current) => current.filter((item) => item.id !== persona.id));
        setSelectedPersonaId((current) => (current === persona.id ? "" : current));
        setNotice(`Could not save persona: ${error.message}`);
      }
    })();
  }

  function deletePersona(personaId: string) {
    setPersonas((current) => current.filter((persona) => persona.id !== personaId));
    setSelectedPersonaId((currentId) => {
      if (currentId !== personaId) return currentId;
      return personas.find((persona) => persona.id !== personaId)?.id ?? "";
    });
    void supabaseClient()
      ?.from("personas")
      .delete()
      .eq("id", personaId)
      .then(({ error }) => {
        if (error) setNotice(`Could not delete persona: ${error.message}`);
      });
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
        const { error: assetsError } = await context.client
          .from("assets")
          .insert(nextAssets.map((asset) => assetToInsert(asset, context.userId)));
        if (assetsError) {
          setAssets((current) => current.filter((asset) => !nextAssets.some((item) => item.id === asset.id)));
          setNotice(`Could not save reference assets: ${assetsError.message}`);
          return;
        }
        const nextReferenceId =
          nextAssets.find((asset) => asset.isDefaultReference)?.id ?? nextAssets[0]?.id;
        if (nextReferenceId) {
          const { error: personaError } = await context.client
            .from("personas")
            .update({ reference_asset_id: nextReferenceId })
            .eq("id", personaId)
            .is("reference_asset_id", null);
          if (personaError) {
            setNotice(`Could not save default reference: ${personaError.message}`);
          }
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
      .eq("id", assetId)
      .then(({ error }) => {
        if (error) setNotice(`Could not save default reference: ${error.message}`);
      });
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
      void client
        .from("assets")
        .delete()
        .eq("id", assetId)
        .then(({ error }) => {
          if (error) setNotice(`Could not delete asset record: ${error.message}`);
        });
      if (asset.storageBucket && asset.storagePath) {
        void client.storage.from(asset.storageBucket).remove([asset.storagePath]);
      }
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
      <aside className="fixed inset-y-0 left-0 hidden w-68 flex-col border-r border-stone-200 bg-white/82 px-4 py-4 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-10 items-center justify-center rounded-md">
            <Image src="/favicon.svg" alt="" width={40} height={40} className="rounded-md" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-normal">Persona Studio</p>
          </div>
        </div>

        <nav className="mt-6 grid flex-1 content-start gap-1 overflow-y-auto pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                disabled={item.disabled}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-stone-600 transition",
                  item.disabled
                    ? "cursor-not-allowed text-stone-400"
                    : view === item.id
                    ? "tab-selected text-white"
                    : "hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <Icon size={18} />
                <span className="min-w-0 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto shrink-0 rounded-full border border-stone-300 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="grid shrink-0 gap-2 border-t border-stone-200 pt-3">
          <div className="flex h-10 items-center justify-between gap-3 rounded-md bg-stone-50 px-3 text-sm">
            <span className="font-medium text-stone-600">Balance</span>
            <span className="font-semibold text-emerald-900">{formatTokens(displayedBalanceCents)}</span>
          </div>
          <Link
            href="/contact?from=studio"
            className="flex h-10 items-center gap-3 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <Mail size={18} />
            Contact us
          </Link>
          <Link
            href="/"
            className="flex h-10 items-center gap-3 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            <Home size={18} />
            Main page
          </Link>
        </div>
      </aside>

      <main className="lg:pl-68">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/84 backdrop-blur">
          {previewMode ? (
            <div className="border-b border-amber-500/30 bg-amber-950 px-4 py-3 text-amber-50 lg:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Preview mode</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-100">
                    You can explore Studio, but using it is disabled until you subscribe.
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex h-9 items-center rounded-md bg-amber-300 px-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-200"
                >
                  Upgrade to use Studio
                </Link>
              </div>
            </div>
          ) : null}
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
                  disabled={item.disabled}
                  className={cn(
                    "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium",
                    item.disabled
                      ? "cursor-not-allowed bg-stone-100 text-stone-400"
                      : view === item.id ? "bg-emerald-800 text-white" : "bg-white text-stone-700",
                  )}
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-2 rounded-full border border-stone-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
              <Link
                href="/contact?from=studio"
                className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
              >
                <Mail size={16} />
                Contact
              </Link>
              <Link
                href="/"
                className="flex h-10 shrink-0 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-medium text-white"
              >
                <Home size={16} />
                Main
              </Link>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 lg:px-8">
          {view === "personas" && (
            <PersonasView
              personas={personas}
              assets={assets}
              supabaseReady={supabaseReady}
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
              supabaseReady={supabaseReady}
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
              supabaseReady={supabaseReady}
              imagePromptSuggestions={imagePromptSuggestions}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets, job);
                addJob(job);
                setNotice(`${nextAssets.length} asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onDeleteAsset={deleteAsset}
            />
          )}
          {view === "trends" && (
            <TrendVideoView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              supabaseReady={supabaseReady}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets, job);
                addJob(job);
                setNotice(
                  nextAssets.some((asset) => asset.kind === "video")
                    ? "Trend video generated."
                    : `${nextAssets.length} face frame${nextAssets.length === 1 ? "" : "s"} generated.`,
                );
              }}
              onSelectPersona={setSelectedPersonaId}
            />
          )}
          {view === "speech" && (
            <SpeechView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets, job);
                addJob(job);
                setNotice(`${nextAssets.length} audio asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onDeleteAsset={deleteAsset}
            />
          )}
          {view === "avatar" && (
            <AvatarView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets, job);
                addJob(job);
                setNotice(`${nextAssets.length} avatar video${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onDeleteAsset={deleteAsset}
            />
          )}
          {view === "assets" && <AssetsView assets={assets} personas={personas} onDeleteAsset={deleteAsset} />}
          {view === "jobs" && <JobsView jobs={jobs} />}
          {view === "settings" && (
            <SettingsView
              balanceCents={displayedBalanceCents}
              supabaseReady={Boolean(supabaseReady)}
              userId={userId}
              userEmail={initialUserEmail}
              paddleConfig={paddleConfig}
              onBalanceRefresh={(nextBalance) => {
                setBalanceCents(nextBalance);
                setNotice("Your balance was refreshed after checkout.");
              }}
            />
          )}
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
    storage_bucket: asset.storageBucket ?? null,
    storage_path: asset.storagePath ?? null,
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
