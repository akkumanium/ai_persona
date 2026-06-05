"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Activity,
  ArrowLeft,
  Clapperboard,
  Coins,
  ImageIcon,
  Loader2,
  Play,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { demoAssets, demoJobs, demoLedger, demoPersonas } from "@/lib/demo-data";
import { MODEL_REGISTRY, modelsForCapability } from "@/lib/model-registry";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatCredits, initials } from "@/lib/utils";

type SourceImageInput = {
  name: string;
  mimeType: string;
  data: string;
};

type SourceVideoInput = {
  name: string;
  mimeType: string;
  data: string;
};

type View = "personas" | "generate" | "images" | "videos" | "motion" | "assets" | "jobs" | "settings";
type GenerationMode = "images" | "videos" | "motion";
type AssetFilter = "all" | "avatar" | "upload" | "image" | "video";
type ReferenceSlotId = "face" | "face-grid" | "body" | "more";
type FaceGenerationMode = "scratch" | "hybrid";

const DEFAULT_PROMPTS = {
  face:
    "Create a hyperrealistic close-up face reference for this persona, clean studio lighting, neutral expression, consistent facial identity, high-resolution, 4K.",
  faceGrid:
    "A 3x3 grid face sheet of the same woman, consistent facial identity, showing multiple different expressions (smiling, neutral, surprised, angry, sad) and looking into different directions (left, right, bottom, up) . Character model sheet, extremely photorealistic, identical facial features, studio lighting, clean background, no text.",
  hybrid:
    "Make a hybrid of these two faces, merge them into a single, cohesive identity with balanced proportions. Soft, even passport-photo lighting, a plain light gray or off-white background, and true-to-life color. Natural, detailed skin with subtle pores and realistic texture. Realistic, clean, high-resolution, 4K.",
  body:
    "Create a hyperrealistic knee-up portrait of the same woman from the reference photo, using the uploaded face as the sole identity reference. Preserve her facial structure, skin tone, and neutral closed-mouth expression. She is fit and curvy with an athletic, proportional hourglass figure, a narrow waist, rounded hips and thighs, and long legs with a short torso. She is standing front-facing and centered, wearing a fitted black tank top and tight athletic shorts. Use soft, even studio lighting, a clean solid white background, and neutral shadows. Sharp focus, eye-level shot, 35mm lens look, realistic skin texture, natural pores, and lifelike hair strands.",
  more:
    "Create a clean, photorealistic reference image for this persona that expands the visual identity while preserving facial consistency, studio lighting, clean background, high-resolution, 4K.",
} as const;

const referenceSlots: { id: ReferenceSlotId; label: string; prompt: string; aspectRatio: "1:1" | "4:5" }[] = [
  { id: "face", label: "Face", prompt: DEFAULT_PROMPTS.face, aspectRatio: "4:5" },
  { id: "face-grid", label: "Face Grid", prompt: DEFAULT_PROMPTS.faceGrid, aspectRatio: "1:1" },
  { id: "body", label: "Body", prompt: DEFAULT_PROMPTS.body, aspectRatio: "4:5" },
  { id: "more", label: "more", prompt: DEFAULT_PROMPTS.more, aspectRatio: "4:5" },
];

const navItems = [
  { id: "personas", label: "Personas", icon: UserRound },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Clapperboard },
  { id: "motion", label: "Motion Control", icon: Play },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function StudioWorkspace() {
  const [view, setView] = useState<View>("personas");
  const [personas, setPersonas] = useState<Persona[]>(demoPersonas);
  const [assets, setAssets] = useState<Asset[]>(demoAssets);
  const [jobs, setJobs] = useState<GenerationJob[]>(demoJobs);
  const [selectedPersonaId, setSelectedPersonaId] = useState(demoPersonas[0]?.id ?? "");
  const [notice, setNotice] = useState("Demo workspace is active until Supabase and provider keys are set.");

  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const personaReferenceAssets = assets.filter(
    (asset) =>
      asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
  );
  const selectedReference =
    personaReferenceAssets.find((asset) => asset.isDefaultReference) ??
    assets.find((asset) => asset.id === selectedPersona?.referenceAssetId) ??
    personaReferenceAssets[0];
  const spentCents = [...demoLedger, ...jobs.map((job) => ({
    amountCents: job.costEstimateCents,
  }))].reduce((sum, entry) => sum + entry.amountCents, 0);

  function addJob(job: GenerationJob) {
    setJobs((current) => [job, ...current]);
  }

  function addAssets(nextAssets: Asset[]) {
    setAssets((current) => [...nextAssets, ...current]);
  }

  function updatePersona(personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) {
    setPersonas((current) =>
      current.map((persona) => (persona.id === personaId ? { ...persona, ...updates } : persona)),
    );
  }

  function renameReferenceAsset(assetId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, title: nextTitle } : asset)),
    );
  }

  function addPersona(persona: Persona) {
    setPersonas((current) => [persona, ...current]);
    setSelectedPersonaId(persona.id);
  }

  function deletePersona(personaId: string) {
    setPersonas((current) => current.filter((persona) => persona.id !== personaId));
    setSelectedPersonaId((currentId) => {
      if (currentId !== personaId) return currentId;
      return personas.find((persona) => persona.id !== personaId)?.id ?? "";
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
  }

  function toggleReferenceDefault(assetId: string) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? { ...asset, isDefaultReference: !asset.isDefaultReference }
          : asset,
      ),
    );
  }

  function deleteReferenceAsset(personaId: string, assetId: string) {
    setAssets((currentAssets) => {
      const nextAssets = currentAssets.filter((asset) => asset.id !== assetId);
      const remainingReferences = nextAssets.filter(
        (asset) =>
          asset.personaId === personaId && (asset.kind === "avatar" || asset.kind === "upload"),
      );
      const nextReferenceId =
        remainingReferences.find((asset) => asset.isDefaultReference)?.id ?? remainingReferences[0]?.id;
      setPersonas((currentPersonas) =>
        currentPersonas.map((persona) =>
          persona.id === personaId ? { ...persona, referenceAssetId: nextReferenceId } : persona,
        ),
      );
      return nextAssets;
    });
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
          <p className="text-sm font-semibold text-stone-900">Usage</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{formatCredits(spentCents)}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Estimated generation usage recorded for billing.</p>
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
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets);
                addJob(job);
                setNotice(`${nextAssets.length} reference asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onToggleReferenceDefault={toggleReferenceDefault}
              onDeleteReference={deleteReferenceAsset}
              onRenameReference={renameReferenceAsset}
              onNavigateToGenerate={() => setView("generate")}
            />
          )}
          {view === "generate" && (
            <GeneratePersonaView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              onAssetsCreated={(nextAssets, job) => {
                addAssets(nextAssets);
                addJob(job);
                setNotice(`${nextAssets.length} reference asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
              onBack={() => setView("personas")}
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
                addAssets(nextAssets);
                addJob(job);
                setNotice(`${nextAssets.length} asset${nextAssets.length === 1 ? "" : "s"} generated.`);
              }}
              onSelectPersona={setSelectedPersonaId}
            />
          )}
          {view === "assets" && <AssetsView assets={assets} personas={personas} />}
          {view === "jobs" && <JobsView jobs={jobs} />}
          {view === "settings" && <SettingsView spentCents={spentCents} />}
        </div>
      </main>
    </div>
  );
}

function PersonasView({
  personas,
  assets,
  selectedPersonaId,
  onSelect,
  onUpdatePersona,
  onCreatePersona,
  onDeletePersona,
  onAddReferences,
  onAssetsCreated,
  onToggleReferenceDefault,
  onDeleteReference,
  onRenameReference,
  onNavigateToGenerate,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersonaId?: string;
  onSelect: (id: string) => void;
  onUpdatePersona: (personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) => void;
  onCreatePersona: (persona: Persona) => void;
  onDeletePersona: (personaId: string) => void;
  onAddReferences: (personaId: string, assets: Asset[]) => void;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (personaId: string, assetId: string) => void;
  onRenameReference: (assetId: string, title: string) => void;
  onNavigateToGenerate: () => void;
}) {
  const [managedPersonaId, setManagedPersonaId] = useState<string | undefined>();
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const managedPersona = personas.find((persona) => persona.id === managedPersonaId);

  function openPersona(personaId: string) {
    onSelect(personaId);
    setManagedPersonaId(personaId);
  }

  function createPersona(event: FormEvent) {
    event.preventDefault();
    const name = newPersonaName.trim();
    const description = newDescription.trim();
    if (!name || !description) return;

    const personaId = `persona-${crypto.randomUUID()}`;
    onCreatePersona({
      id: personaId,
      name,
      description,
      styleNotes: "",
      status: "active",
      createdAt: new Date().toISOString(),
    });
    setManagedPersonaId(personaId);
    setNewPersonaName("");
    setNewDescription("");
    setIsCreatingPersona(false);
  }

  if (managedPersona) {
    return (
      <PersonaManagementView
        key={managedPersona.id}
        persona={managedPersona}
        assets={assets}
        onBack={() => setManagedPersonaId(undefined)}
        onDeletePersona={(personaId) => {
          onDeletePersona(personaId);
          setManagedPersonaId(undefined);
        }}
        onUpdatePersona={onUpdatePersona}
        onAddReferences={onAddReferences}
        onAssetsCreated={onAssetsCreated}
        onToggleReferenceDefault={onToggleReferenceDefault}
        onDeleteReference={onDeleteReference}
        onRenameReference={onRenameReference}
        onNavigateToGenerate={onNavigateToGenerate}
      />
    );
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PanelTitle icon={UserRound} title="Personas" />
        <button
          type="button"
          onClick={() => setIsCreatingPersona(true)}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          <WandSparkles size={18} />
          Create persona
        </button>
      </div>

      {personas.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {personas.map((persona) => {
            const reference = assets.find((asset) => asset.id === persona.referenceAssetId);
            const personaAssets = assets.filter((asset) => asset.personaId === persona.id);
            return (
              <button
                key={persona.id}
                onClick={() => openPersona(persona.id)}
                className={cn(
                  "overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-colors hover:border-emerald-800",
                  selectedPersonaId === persona.id ? "border-emerald-800" : "border-stone-200",
                )}
              >
                <div className="h-36 bg-stone-100">
                  {reference ? (
                    <img src={reference.url} alt={persona.name} className="h-full w-full object-contain p-3" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl font-semibold text-stone-400">
                      {initials(persona.name)}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-stone-950">{persona.name}</h2>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                      {persona.status}
                    </span>
                  </div>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{persona.description}</p>
                  <p className="mt-3 text-xs font-medium uppercase text-stone-400">
                    {personaAssets.length} asset{personaAssets.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center">
          <WandSparkles className="mx-auto text-emerald-800" size={32} />
          <h2 className="mt-3 text-lg font-semibold text-stone-950">No personas yet</h2>
          <button
            type="button"
            onClick={() => setIsCreatingPersona(true)}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            <WandSparkles size={18} />
            Create persona
          </button>
        </div>
      )}

      {isCreatingPersona ? (
        <CreatePersonaDialog
          name={newPersonaName}
          description={newDescription}
          onNameChange={setNewPersonaName}
          onDescriptionChange={setNewDescription}
          onSubmit={createPersona}
          onClose={() => setIsCreatingPersona(false)}
        />
      ) : null}
    </section>
  );
}

function PersonaManagementView({
  persona,
  assets,
  onBack,
  onDeletePersona,
  onUpdatePersona,
  onAddReferences,
  onAssetsCreated,
  onToggleReferenceDefault,
  onDeleteReference,
  onRenameReference,
  onNavigateToGenerate,
}: {
  persona: Persona;
  assets: Asset[];
  onBack: () => void;
  onDeletePersona: (personaId: string) => void;
  onUpdatePersona: (personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) => void;
  onAddReferences: (personaId: string, assets: Asset[]) => void;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (personaId: string, assetId: string) => void;
  onRenameReference: (assetId: string, title: string) => void;
  onNavigateToGenerate: () => void;
}) {
  const [generationSlotId, setGenerationSlotId] = useState<ReferenceSlotId | undefined>();
  const [faceGenerationMode, setFaceGenerationMode] = useState<FaceGenerationMode>("scratch");
  const [generationPrompt, setGenerationPrompt] = useState(DEFAULT_PROMPTS.face);
  const [hybridSources, setHybridSources] = useState<SourceImageInput[]>([]);
  const [confirmsRights, setConfirmsRights] = useState(false);
  const [confirmsAdultPersona, setConfirmsAdultPersona] = useState(false);
  const [isGeneratingReference, setIsGeneratingReference] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [personaNameDraft, setPersonaNameDraft] = useState(persona.name);
  const [personaDescriptionDraft, setPersonaDescriptionDraft] = useState(persona.description);
  const [previewAssetId, setPreviewAssetId] = useState<string | undefined>();
  const referenceAssets = assets.filter(
    (asset) => asset.personaId === persona.id && (asset.kind === "avatar" || asset.kind === "upload"),
  );
  const imageAssets = assets.filter((asset) => asset.personaId === persona.id && asset.kind === "image");
  const videoAssets = assets.filter((asset) => asset.personaId === persona.id && asset.kind === "video");
  const activeSlot = referenceSlots.find((slot) => slot.id === generationSlotId);
  const previewAsset = assets.find((asset) => asset.id === previewAssetId);

  function assetsForSlot(slotId: ReferenceSlotId) {
    return referenceAssets.filter((asset) =>
      slotId === "face" ? asset.referenceSlot === slotId || !asset.referenceSlot : asset.referenceSlot === slotId,
    );
  }

  function beginEditPersona() {
    setPersonaNameDraft(persona.name);
    setPersonaDescriptionDraft(persona.description);
    setIsEditingPersona(true);
  }

  function savePersonaDetails(event: FormEvent) {
    event.preventDefault();
    const nextName = personaNameDraft.trim();
    const nextDescription = personaDescriptionDraft.trim();
    if (!nextName || !nextDescription) return;
    onUpdatePersona(persona.id, { name: nextName, description: nextDescription });
    setIsEditingPersona(false);
  }

  function openGeneration(slot: (typeof referenceSlots)[number]) {
    setGenerationSlotId(slot.id);
    setFaceGenerationMode("scratch");
    setGenerationPrompt(slot.prompt);
    setHybridSources([]);
    setConfirmsRights(false);
    setConfirmsAdultPersona(false);
    setGenerationError("");
  }

  async function captureSlotUpload(slot: (typeof referenceSlots)[number], files: FileList | null) {
    const images = await encodeFiles(files, "image/png");
    if (!images.length) return;
    const createdAt = new Date().toISOString();
    const hasDefault = referenceAssets.some((asset) => asset.isDefaultReference);
    const nextAssets: Asset[] = images.map((image, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "upload",
      title: `${slot.label} reference ${assetsForSlot(slot.id).length + index + 1}`,
      url: sourceImageToDataUrl(image),
      prompt: "Uploaded local reference.",
      personaId: persona.id,
      referenceSlot: slot.id,
      isDefaultReference: !hasDefault && index === 0,
      generationType: "reference_upload",
      provider: "demo",
      model: "local-upload",
      mimeType: image.mimeType,
      createdAt,
    }));
    onAddReferences(persona.id, nextAssets);
  }

  async function captureHybridSources(files: FileList | null) {
    const newImages = await encodeFiles(files, "image/png");
    setHybridSources((current) => [...current, ...newImages]);
  }

  function removeHybridSource(index: number) {
    setHybridSources((current) => current.filter((_, i) => i !== index));
  }

  function confirmPersonaDelete() {
    if (window.confirm("Are you sure you want to do this?")) {
      onDeletePersona(persona.id);
    }
  }

  async function generateReference(event: FormEvent) {
    event.preventDefault();
    if (!activeSlot) return;
    if (!confirmsRights || !confirmsAdultPersona) return;
    if (activeSlot.id === "face" && faceGenerationMode === "hybrid" && hybridSources.length < 2) return;

    setIsGeneratingReference(true);
    setGenerationError("");
    try {
      const hasDefault = referenceAssets.some((asset) => asset.isDefaultReference);
      if (activeSlot.id === "face") {
        const prompt = faceGenerationMode === "hybrid" ? DEFAULT_PROMPTS.hybrid : generationPrompt;
        const response = await fetch("/api/generate/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: faceGenerationMode === "hybrid" ? "blend" : "prompt",
            personaName: persona.name,
            description: persona.description,
            styleNotes: persona.styleNotes,
            prompt,
            aspectRatio: activeSlot.aspectRatio,
            imageSize: "4K",
            count: 1,
            sourceImages: faceGenerationMode === "hybrid" ? hybridSources.slice(0, 2) : [],
            confirmsRights,
            confirmsAdultPersona,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        const nextAssets = payload.assets.map((asset: Asset, index: number) => ({
          ...asset,
          kind: "avatar" as const,
          title: `${activeSlot.label} reference ${assetsForSlot(activeSlot.id).length + index + 1}`,
          prompt,
          personaId: persona.id,
          referenceSlot: activeSlot.id,
          isDefaultReference: !hasDefault && index === 0,
        }));
        onAssetsCreated(nextAssets, { ...payload.job, personaId: persona.id, prompt });
      } else {
        const defaultReferences = referenceAssets.filter((asset) => asset.isDefaultReference);
        const referenceAssetIds = defaultReferences.map((asset) => asset.id);
        const referenceImageUrls = defaultReferences.map((asset) => asset.url);
        const response = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: persona.id,
            personaName: persona.name,
            model: "gemini-3-pro-image-preview",
            prompt: generationPrompt,
            styleNotes: persona.styleNotes,
            aspectRatio: activeSlot.aspectRatio,
            imageSize: "4K",
            count: 1,
            referenceImageUrls,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        const nextAssets = payload.assets.map((asset: Asset, index: number) => ({
          ...asset,
          kind: "avatar" as const,
          title: `${activeSlot.label} reference ${assetsForSlot(activeSlot.id).length + index + 1}`,
          personaId: persona.id,
          referenceSlot: activeSlot.id,
          referenceAssetIds,
          isDefaultReference: !hasDefault && index === 0,
        }));
        onAssetsCreated(nextAssets, { ...payload.job, personaId: persona.id });
      }
      setGenerationSlotId(undefined);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Reference generation failed.");
    } finally {
      setIsGeneratingReference(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <ArrowLeft size={16} />
            Personas
          </button>
          {isEditingPersona ? (
            <form onSubmit={savePersonaDetails} className="mt-4 max-w-3xl rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Persona name" value={personaNameDraft} onChange={setPersonaNameDraft} />
                <TextArea label="Description" value={personaDescriptionDraft} onChange={setPersonaDescriptionDraft} rows={4} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersonaNameDraft(persona.name);
                    setPersonaDescriptionDraft(persona.description);
                    setIsEditingPersona(false);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 px-4 text-sm font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="mt-4 text-2xl font-semibold text-stone-950">{persona.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{persona.description}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEditingPersona ? (
            <>
              <button
                type="button"
                onClick={onNavigateToGenerate}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                <WandSparkles size={16} />
                Generate references
              </button>
              <button
                type="button"
                onClick={beginEditPersona}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
              >
                Edit persona
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={confirmPersonaDelete}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            <Trash2 size={17} />
            Delete persona
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {referenceSlots.map((slot) => (
          <ReferenceSlotCard
            key={slot.id}
            slot={slot}
            assets={assetsForSlot(slot.id)}
            onGenerate={() => openGeneration(slot)}
            onUpload={(files) => void captureSlotUpload(slot, files)}
            onToggleReferenceDefault={onToggleReferenceDefault}
            onDeleteReference={(assetId) => onDeleteReference(persona.id, assetId)}
            onRenameReference={onRenameReference}
            onPreviewReference={(asset) => setPreviewAssetId(asset.id)}
          />
        ))}
      </div>

      <AssetSection title="Images" assets={imageAssets} />
      <AssetSection title="Videos" assets={videoAssets} />

      {previewAsset ? <ReferencePreviewDialog asset={previewAsset} onClose={() => setPreviewAssetId(undefined)} /> : null}

      {activeSlot ? (
        <ReferenceGenerationDialog
          slot={activeSlot}
          faceGenerationMode={faceGenerationMode}
          prompt={activeSlot.id === "face" && faceGenerationMode === "hybrid" ? DEFAULT_PROMPTS.hybrid : generationPrompt}
          hybridSources={hybridSources}
          confirmsRights={confirmsRights}
          confirmsAdultPersona={confirmsAdultPersona}
          isGenerating={isGeneratingReference}
          error={generationError}
          onModeChange={(mode) => {
            setFaceGenerationMode(mode);
            setGenerationPrompt(mode === "hybrid" ? DEFAULT_PROMPTS.hybrid : DEFAULT_PROMPTS.face);
          }}
          onPromptChange={setGenerationPrompt}
          onHybridSourcesChange={(files) => void captureHybridSources(files)}
          onRemoveHybridSource={removeHybridSource}
          onConfirmsRightsChange={setConfirmsRights}
          onConfirmsAdultPersonaChange={setConfirmsAdultPersona}
          onSubmit={generateReference}
          onClose={() => setGenerationSlotId(undefined)}
        />
      ) : null}
    </section>
  );
}

function ReferenceSlotCard({
  slot,
  assets,
  onGenerate,
  onUpload,
  onToggleReferenceDefault,
  onDeleteReference,
  onRenameReference,
  onPreviewReference,
}: {
  slot: (typeof referenceSlots)[number];
  assets: Asset[];
  onGenerate: () => void;
  onUpload: (files: FileList | null) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (assetId: string) => void;
  onRenameReference: (assetId: string, title: string) => void;
  onPreviewReference: (asset: Asset) => void;
}) {
  const latestAsset = assets[0];
  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-stone-950">{slot.label}</h3>
        {latestAsset?.isDefaultReference ? <Star className="text-emerald-800" size={16} /> : null}
      </div>
      <div className="mt-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-white">
        {latestAsset ? (
          <img src={latestAsset.url} alt={latestAsset.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-stone-400">Empty</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          <WandSparkles size={16} />
          Generate
        </button>
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950">
          <Upload size={16} />
          Upload
          <input className="sr-only" type="file" accept="image/*" onChange={(event) => onUpload(event.target.files)} />
        </label>
      </div>
      {assets.length ? (
        <div className="mt-3 grid gap-2">
          {assets.map((asset) => (
            <ReferenceAssetRow
              key={asset.id}
              asset={asset}
              onToggleReferenceDefault={onToggleReferenceDefault}
              onDeleteReference={onDeleteReference}
              onRenameReference={onRenameReference}
              onPreviewReference={onPreviewReference}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AssetSection({ title, assets }: { title: string; assets: Asset[] }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-950">{title}</h3>
        <span className="text-sm font-medium text-stone-500">{assets.length}</span>
      </div>
      {assets.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {assets.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <div className="aspect-[4/5] bg-stone-100">
                {asset.kind === "video" ? (
                  <video src={asset.url} className="h-full w-full object-cover" controls />
                ) : (
                  <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                <p className="mt-1 text-xs text-stone-500">{asset.model}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
          Empty
        </div>
      )}
    </section>
  );
}

function ReferenceAssetRow({
  asset,
  onToggleReferenceDefault,
  onDeleteReference,
  onRenameReference,
  onPreviewReference,
}: {
  asset: Asset;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (assetId: string) => void;
  onRenameReference: (assetId: string, title: string) => void;
  onPreviewReference: (asset: Asset) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(asset.title);

  function saveTitle(event: FormEvent) {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    onRenameReference(asset.id, nextTitle);
    setIsEditing(false);
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-2">
      {isEditing ? (
        <form onSubmit={saveTitle} className="grid gap-2">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="h-9 w-full rounded-md border border-stone-200 px-2 text-xs font-semibold text-stone-900 outline-none transition focus:border-emerald-800"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md border border-emerald-800 px-2 py-1 text-xs font-semibold text-emerald-800"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftTitle(asset.title);
                setIsEditing(false);
              }}
              className="rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onPreviewReference(asset)}
            className="block w-full text-left text-xs font-semibold text-stone-900 transition hover:text-emerald-800 hover:underline"
          >
            {asset.title}
          </button>
          <p className="mt-1 text-[11px] text-stone-500">Click the title to preview the full reference photo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftTitle(asset.title);
              setIsEditing(true);
            }}
            className="rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600"
          >
            Rename
            </button>
            <button
              type="button"
              onClick={() => onToggleReferenceDefault(asset.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                asset.isDefaultReference
                  ? "border-emerald-800 text-emerald-800"
                  : "border-stone-200 text-stone-600",
              )}
            >
              {asset.isDefaultReference ? "Default" : "Mark default"}
            </button>
            <button
              type="button"
              onClick={() => onDeleteReference(asset.id)}
              className="rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReferencePreviewDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/45 px-4 py-6">
      <div className="w-full max-w-4xl rounded-lg border border-stone-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">{asset.title}</p>
            <p className="text-xs text-stone-500">Reference preview</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 max-h-[75vh] overflow-hidden rounded-lg bg-stone-100">
          <img src={asset.url} alt={asset.title} className="max-h-[75vh] w-full object-contain" />
        </div>
      </div>
    </div>
  );
}

function CreatePersonaDialog({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onClose,
}: {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/35 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle icon={UserRound} title="Create persona" />
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <X size={18} />
          </button>
        </div>
        <TextField label="Name" value={name} onChange={onNameChange} />
        <TextArea label="Description" value={description} onChange={onDescriptionChange} rows={4} />
        <SubmitButton loading={false} icon={ArrowLeft} label="Continue" disabled={!name.trim() || !description.trim()} />
      </form>
    </div>
  );
}

function ReferenceGenerationDialog({
  slot,
  faceGenerationMode,
  prompt,
  hybridSources,
  confirmsRights,
  confirmsAdultPersona,
  isGenerating,
  error,
  onModeChange,
  onPromptChange,
  onHybridSourcesChange,
  onRemoveHybridSource,
  onConfirmsRightsChange,
  onConfirmsAdultPersonaChange,
  onSubmit,
  onClose,
}: {
  slot: (typeof referenceSlots)[number];
  faceGenerationMode: FaceGenerationMode;
  prompt: string;
  hybridSources: SourceImageInput[];
  confirmsRights: boolean;
  confirmsAdultPersona: boolean;
  isGenerating: boolean;
  error: string;
  onModeChange: (mode: FaceGenerationMode) => void;
  onPromptChange: (value: string) => void;
  onHybridSourcesChange: (files: FileList | null) => void;
  onRemoveHybridSource: (index: number) => void;
  onConfirmsRightsChange: (value: boolean) => void;
  onConfirmsAdultPersonaChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const isHybrid = slot.id === "face" && faceGenerationMode === "hybrid";
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/35 px-4 py-6">
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-stone-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <PanelTitle icon={WandSparkles} title={`${slot.label} generation`} />
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <X size={18} />
          </button>
        </div>

        {slot.id === "face" ? (
          <ModeToggle
            label="Mode"
            value={faceGenerationMode}
            options={[
              { value: "scratch", label: "Generate from scratch" },
              { value: "hybrid", label: "Hybrid mode" },
            ]}
            onChange={(value) => onModeChange(value as FaceGenerationMode)}
          />
        ) : null}

        {isHybrid ? (
          <>
            <UploadBox
              accept="image/*"
              multiple={false}
              icon={Upload}
              label={
                hybridSources.length < 2
                  ? `Upload face ${hybridSources.length + 1} of 2`
                  : "Both faces uploaded"
              }
              detail={hybridSources.length > 0 ? `${hybridSources.length} face${hybridSources.length === 1 ? "" : "s"} uploaded` : undefined}
              onChange={onHybridSourcesChange}
            />
            {hybridSources.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {hybridSources.map((image, index) => (
                  <div key={index} className="relative rounded-lg border border-stone-200 bg-white overflow-hidden">
                    <img 
                      src={sourceImageToDataUrl(image)} 
                      alt={`Face ${index + 1}`} 
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => onRemoveHybridSource(index)}
                        className="opacity-0 hover:opacity-100 transition flex size-10 items-center justify-center rounded-full bg-red-600 text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 rounded-full bg-emerald-800 text-white text-xs font-semibold size-7 flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <TextArea label="Prompt" value={prompt} onChange={onPromptChange} rows={7} />

        <label className="mt-4 flex items-start gap-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={confirmsRights}
            onChange={(event) => onConfirmsRightsChange(event.target.checked)}
            className="mt-1 size-4 accent-emerald-800"
          />
          <span>I confirm I have rights to use the provided identity references.</span>
        </label>
        <label className="mt-2 flex items-start gap-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={confirmsAdultPersona}
            onChange={(event) => onConfirmsAdultPersonaChange(event.target.checked)}
            className="mt-1 size-4 accent-emerald-800"
          />
          <span>I confirm this is an adult persona.</span>
        </label>

        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <SubmitButton
          loading={isGenerating}
          icon={WandSparkles}
          label="Generate"
          disabled={!confirmsRights || !confirmsAdultPersona || (isHybrid && hybridSources.length < 2)}
        />
      </form>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyPersonasView({
  personas,
  assets,
  selectedPersonaId,
  onSelect,
  onCreatePersona,
  onAddReferences,
  onToggleReferenceDefault,
  onDeleteReference,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersonaId?: string;
  onSelect: (id: string) => void;
  onCreatePersona: (persona: Persona, assets: Asset[]) => void;
  onAddReferences: (personaId: string, assets: Asset[]) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (personaId: string, assetId: string) => void;
}) {
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId);
  const referenceAssets = assets.filter(
    (asset) =>
      asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
  );
  const generatedAssets = assets.filter(
    (asset) =>
      asset.personaId === selectedPersona?.id && (asset.kind === "image" || asset.kind === "video"),
  );
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("Aria Sol");
  const [newDescription, setNewDescription] = useState("A fashion-tech creator with a warm, editorial social presence.");
  const [newStyleNotes, setNewStyleNotes] = useState("Natural skin texture, premium streetwear, warm studio light.");
  const [newReferences, setNewReferences] = useState<SourceImageInput[]>([]);
  const [pendingReferences, setPendingReferences] = useState<SourceImageInput[]>([]);

  async function captureNewPersonaReferences(files: FileList | null) {
    setNewReferences(await encodeFiles(files, "image/png"));
  }

  async function capturePersonaReferences(files: FileList | null) {
    setPendingReferences(await encodeFiles(files, "image/png"));
  }

  function createPersonaFromUploads(event: FormEvent) {
    event.preventDefault();
    if (!newReferences.length) return;

    const createdAt = new Date().toISOString();
    const personaId = `persona-${crypto.randomUUID()}`;
    const nextAssets: Asset[] = newReferences.map((image, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "upload",
      title: `${newPersonaName} uploaded reference ${index + 1}`,
      url: sourceImageToDataUrl(image),
      prompt: "Uploaded local reference.",
      personaId,
      isDefaultReference: index === 0,
      generationType: "reference_upload",
      provider: "demo",
      model: "local-upload",
      mimeType: image.mimeType,
      createdAt,
    }));

    onCreatePersona(
      {
        id: personaId,
        name: newPersonaName,
        description: newDescription,
        styleNotes: newStyleNotes,
        status: "active",
        referenceAssetId: nextAssets[0]?.id,
        createdAt,
      },
      nextAssets,
    );
    setNewReferences([]);
    setIsCreatingPersona(false);
  }

  function addPersonaReferences(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !pendingReferences.length) return;

    const createdAt = new Date().toISOString();
    const hasDefault = referenceAssets.some((asset) => asset.isDefaultReference);
    const nextAssets: Asset[] = pendingReferences.map((image, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "upload",
      title: `${selectedPersona.name} reference ${referenceAssets.length + index + 1}`,
      url: sourceImageToDataUrl(image),
      prompt: "Uploaded local reference.",
      personaId: selectedPersona.id,
      isDefaultReference: !hasDefault && index === 0,
      generationType: "reference_upload",
      provider: "demo",
      model: "local-upload",
      mimeType: image.mimeType,
      createdAt,
    }));

    onAddReferences(selectedPersona.id, nextAssets);
    setPendingReferences([]);
  }

  if (!personas.length) {
    return (
      <section className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10">
        {isCreatingPersona ? (
          <NewPersonaForm
            name={newPersonaName}
            description={newDescription}
            styleNotes={newStyleNotes}
            references={newReferences}
            onNameChange={setNewPersonaName}
            onDescriptionChange={setNewDescription}
            onStyleNotesChange={setNewStyleNotes}
            onReferencesChange={(files) => void captureNewPersonaReferences(files)}
            onSubmit={createPersonaFromUploads}
            onCancel={() => setIsCreatingPersona(false)}
          />
        ) : (
          <div className="text-center">
            <WandSparkles className="mx-auto text-emerald-800" size={32} />
            <h2 className="mt-3 text-lg font-semibold text-stone-950">No personas yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
              Upload reference photos to create a persona, then use Images, Videos, or Motion Control.
            </p>
            <button
              type="button"
              onClick={() => setIsCreatingPersona(true)}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              <WandSparkles size={18} />
              Create persona
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-5",
        selectedPersona ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1",
      )}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isCreatingPersona ? (
          <div className="md:col-span-2 xl:col-span-3">
            <NewPersonaForm
              name={newPersonaName}
              description={newDescription}
              styleNotes={newStyleNotes}
              references={newReferences}
              onNameChange={setNewPersonaName}
              onDescriptionChange={setNewDescription}
              onStyleNotesChange={setNewStyleNotes}
              onReferencesChange={(files) => void captureNewPersonaReferences(files)}
              onSubmit={createPersonaFromUploads}
              onCancel={() => setIsCreatingPersona(false)}
            />
          </div>
        ) : null}
        {personas.map((persona) => {
          const reference = assets.find((asset) => asset.id === persona.referenceAssetId);
          const personaAssets = assets.filter((asset) => asset.personaId === persona.id);
          return (
            <button
              key={persona.id}
              onClick={() => onSelect(persona.id)}
              className={cn(
                "overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-colors",
                selectedPersonaId === persona.id ? "border-emerald-800" : "border-stone-200",
              )}
            >
              <div className="h-32 bg-stone-100">
                {reference ? (
                  <img src={reference.url} alt={persona.name} className="h-full w-full object-contain p-3" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-semibold text-stone-400">
                    {initials(persona.name)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-stone-950">{persona.name}</h2>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                    {persona.status}
                  </span>
                </div>
                <p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{persona.description}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-400">
                  {personaAssets.length} assets
                </p>
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setIsCreatingPersona(true)}
          className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/70 p-8 text-center transition-colors hover:border-emerald-800 hover:bg-white"
        >
          <WandSparkles className="text-emerald-800" size={30} />
          <span className="mt-3 text-base font-semibold text-stone-950">New persona</span>
        </button>
      </section>

      {selectedPersona ? (
        <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto">
          <PanelTitle icon={UserRound} title="Manage Persona" />
          <h2 className="mt-4 text-lg font-semibold text-stone-950">{selectedPersona.name}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{selectedPersona.description}</p>
          <div className="mt-3 rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-600">
            {selectedPersona.styleNotes}
          </div>

          <form onSubmit={addPersonaReferences} className="mt-4">
            <UploadBox
              accept="image/*"
              multiple
              icon={Upload}
              label={
                pendingReferences.length
                  ? `${pendingReferences.length} reference image${pendingReferences.length === 1 ? "" : "s"} selected`
                  : "Add reference photos"
              }
              detail={pendingReferences.map((image) => image.name).join(", ")}
              onChange={(files) => void capturePersonaReferences(files)}
            />
            <SubmitButton
              loading={false}
              icon={Upload}
              label="Add references"
              disabled={!pendingReferences.length}
            />
          </form>

          <div className="mt-6">
            <p className="text-sm font-semibold text-stone-900">Reference library</p>
            {referenceAssets.length ? (
              <div className="mt-3 grid gap-3">
                {referenceAssets.map((asset) => {
                  const linkedAssets = generatedAssets.filter((generated) =>
                    generated.referenceAssetIds?.includes(asset.id),
                  );
                  const linkedImages = linkedAssets.filter((generated) => generated.kind === "image").length;
                  const linkedVideos = linkedAssets.filter((generated) => generated.kind === "video").length;
                  return (
                    <div key={asset.id} className="rounded-lg border border-stone-200 bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-stone-100 p-2">
                          <img src={asset.url} alt={asset.title} className="h-full w-full object-contain" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {linkedImages} image{linkedImages === 1 ? "" : "s"} · {linkedVideos} video
                            {linkedVideos === 1 ? "" : "s"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onToggleReferenceDefault(asset.id)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs font-semibold",
                                asset.isDefaultReference
                                  ? "border-emerald-800 text-emerald-800"
                                  : "border-stone-200 text-stone-600",
                              )}
                            >
                              {asset.isDefaultReference ? "Default" : "Mark default"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteReference(selectedPersona.id, asset.id)}
                              className="rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      {linkedAssets.length ? (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {linkedAssets.slice(0, 4).map((linkedAsset) =>
                            linkedAsset.kind === "video" ? (
                              <video
                                key={linkedAsset.id}
                                src={linkedAsset.url}
                                className="aspect-[4/5] w-full rounded-md object-cover"
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                key={linkedAsset.id}
                                src={linkedAsset.url}
                                alt={linkedAsset.title}
                                className="aspect-[4/5] w-full rounded-md object-cover"
                              />
                            ),
                          )}
                          {linkedAssets.length > 4 ? (
                            <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-stone-300 text-xs text-stone-500">
                              +{linkedAssets.length - 4}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-stone-500">
                          No images or videos generated with this reference yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
                Add reference photos to start generating with this persona.
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function NewPersonaForm({
  name,
  description,
  styleNotes,
  references,
  onNameChange,
  onDescriptionChange,
  onStyleNotesChange,
  onReferencesChange,
  onSubmit,
  onCancel,
}: {
  name: string;
  description: string;
  styleNotes: string;
  references: SourceImageInput[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStyleNotesChange: (value: string) => void;
  onReferencesChange: (files: FileList | null) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle icon={Upload} title="New Persona" />
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
        >
          Cancel
        </button>
      </div>
      <div className="mt-1 grid gap-4 md:grid-cols-2">
        <TextField label="Persona name" value={name} onChange={onNameChange} />
        <TextArea label="Description" value={description} onChange={onDescriptionChange} />
        <TextArea label="Style notes" value={styleNotes} onChange={onStyleNotesChange} />
      </div>
      <UploadBox
        accept="image/*"
        multiple
        icon={Upload}
        label={
          references.length
            ? `${references.length} reference image${references.length === 1 ? "" : "s"} selected`
            : "Upload reference photos"
        }
        detail={references.map((image) => image.name).join(", ")}
        onChange={onReferencesChange}
      />
      <SubmitButton loading={false} icon={Upload} label="Create persona" disabled={!references.length} />
    </form>
  );
}

function GenerationView({
  mode,
  personas,
  assets,
  selectedPersona,
  selectedReference,
  onAssetsCreated,
  onSelectPersona,
}: {
  mode: GenerationMode;
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  selectedReference?: Asset;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
}) {
  const [imagePrompt, setImagePrompt] = useState("Editorial product photo for a social launch campaign.");
  const [videoPrompt, setVideoPrompt] = useState("Short vertical clip with a confident camera turn and subtle smile.");
  const [useImageReferences, setUseImageReferences] = useState(true);
  const [useVideoReferences, setUseVideoReferences] = useState(true);
  const [imageModel, setImageModel] = useState("gemini-3-pro-image-preview");
  const [videoModel, setVideoModel] = useState("wan-2.2");
  const [motionVideoModel, setMotionVideoModel] = useState("wan-animate");
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});
  const [motionReference, setMotionReference] = useState("slow head turn, right hand product reveal");
  const [motionReferenceImage, setMotionReferenceImage] = useState<SourceImageInput | undefined>();
  const [motionReferenceVideo, setMotionReferenceVideo] = useState<SourceVideoInput | undefined>();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const personaOptions = useMemo(() => personas, [personas]);
  const imageModelOptions = modelsForCapability("image-reference");
  const videoModelOptions = modelsForCapability("video-normal");
  const motionModelOptions = modelsForCapability("video-motion");
  const selectedReferenceAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
      ),
    [assets, selectedPersona?.id],
  );
  const defaultReferenceIds = useMemo(
    () => selectedReferenceAssets.filter((asset) => asset.isDefaultReference).map((asset) => asset.id),
    [selectedReferenceAssets],
  );
  const fallbackReferenceIds = useMemo(
    () => (defaultReferenceIds.length ? defaultReferenceIds : selectedReferenceAssets.map((asset) => asset.id)),
    [defaultReferenceIds, selectedReferenceAssets],
  );
  const selectedReferenceIds = useMemo(
    () => (selectedPersona ? referenceSelectionByPersona[selectedPersona.id] ?? fallbackReferenceIds : []),
    [fallbackReferenceIds, referenceSelectionByPersona, selectedPersona],
  );
  const selectedReferenceSelection = useMemo(
    () => selectedReferenceAssets.filter((asset) => selectedReferenceIds.includes(asset.id)),
    [selectedReferenceAssets, selectedReferenceIds],
  );
  const latestAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (asset.personaId !== selectedPersona?.id) return false;
        if (mode === "images") return asset.kind === "image";
        return asset.kind === "video";
      }),
    [assets, mode, selectedPersona?.id],
  );
  const isGenerating = mode === "images" ? isGeneratingImage : isGeneratingVideo;

  function toggleReferenceSelection(assetId: string) {
    if (!selectedPersona) return;
    setReferenceSelectionByPersona((current) => {
      const currentIds = current[selectedPersona.id] ?? fallbackReferenceIds;
      const nextIds = currentIds.includes(assetId)
        ? currentIds.filter((id) => id !== assetId)
        : [...currentIds, assetId];
      return { ...current, [selectedPersona.id]: nextIds };
    });
  }

  async function generateImage(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona) return;
    const referenceAssets = useImageReferences ? selectedReferenceSelection : [];
    if (useImageReferences && !referenceAssets.length) return;
    const referenceImageUrls = referenceAssets.map((asset) => asset.url);
    setIsGeneratingImage(true);
    try {
      const requestBody = {
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        prompt: imagePrompt,
        model: imageModel,
        styleNotes: selectedPersona.styleNotes,
        aspectRatio: "4:5",
        imageSize: "2K",
        count: 2,
        ...(referenceImageUrls.length
          ? { referenceImageUrl: referenceImageUrls[0], referenceImageUrls }
          : {}),
      };
      const response = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Image generation failed.");
      }
      const referenceAssetIds = referenceAssets.map((asset) => asset.id);
      const nextAssets = payload.assets.map((asset: Asset) => ({
        ...asset,
        referenceAssetIds,
      }));
      onAssetsCreated(nextAssets, payload.job);
    } finally {
      setIsGeneratingImage(false);
    }
  }

  async function generateVideo(event: FormEvent, mode: "normal" | "motion") {
    event.preventDefault();
    if (!selectedPersona) return;
    const referenceAssets = mode === "normal" && useVideoReferences ? selectedReferenceSelection : [];
    if (mode === "normal" && useVideoReferences && !referenceAssets.length) return;
    const referenceImageUrl =
      mode === "motion"
        ? motionReferenceImage
          ? sourceImageToDataUrl(motionReferenceImage)
          : selectedReference?.url
        : referenceAssets[0]?.url;
    if (mode === "motion" && !referenceImageUrl) return;
    setIsGeneratingVideo(true);
    try {
      const requestBody = {
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        prompt: videoPrompt,
        mode,
        model: mode === "motion" ? motionVideoModel : videoModel,
        durationSeconds: 5,
        aspectRatio: "9:16",
        motionReference: mode === "motion" ? motionReference : "",
        motionReferenceVideo: mode === "motion" ? motionReferenceVideo : undefined,
        ...(referenceImageUrl ? { referenceImageUrl } : {}),
      };
      const response = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Video generation failed.");
      }
      const referenceAssetIds =
        mode === "normal"
          ? referenceAssets.map((asset) => asset.id)
          : motionReferenceImage
            ? []
            : selectedReference
              ? [selectedReference.id]
              : [];
      const nextAssets = payload.asset
        ? [
            {
              ...payload.asset,
              referenceAssetIds,
            },
          ]
        : [];
      onAssetsCreated(nextAssets, payload.job);
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  async function captureMotionReferenceImage(files: FileList | null) {
    const [image] = await encodeFiles(files, "image/png");
    setMotionReferenceImage(image);
  }

  async function captureMotionReferenceVideo(files: FileList | null) {
    const [video] = await encodeFiles(files, "video/mp4");
    setMotionReferenceVideo(video);
  }

  const PanelIcon = mode === "images" ? ImageIcon : mode === "videos" ? Clapperboard : Play;
  const panelTitle = mode === "images" ? "Images" : mode === "videos" ? "Videos" : "Motion Control";
  const emptyCopy =
    mode === "images"
      ? "Generated stills will appear here."
      : mode === "videos"
        ? "Generated videos will appear here."
        : "Motion-control videos will appear here.";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={PanelIcon} title={`${panelTitle} Result`} />

        <div className="mt-5 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-sm text-stone-600">
              <Loader2 className="mb-3 animate-spin text-emerald-800" size={28} />
              Waiting for the provider result.
            </div>
          ) : latestAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {latestAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="aspect-[4/5] bg-stone-100">
                    {asset.kind === "video" ? (
                      <video src={asset.url} className="h-full w-full object-cover" controls />
                    ) : (
                      <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                    <p className="mt-1 text-xs text-stone-500">{asset.model}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <PanelIcon className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">Ready when you are</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">{emptyCopy}</p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        {mode === "images" ? (
          <form onSubmit={generateImage}>
            <PanelTitle icon={ImageIcon} title="Image Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect label="Image model" value={imageModel} options={imageModelOptions} onChange={setImageModel} />
            <ModeToggle
              label="Reference mode"
              value={useImageReferences ? "references" : "prompt"}
              options={[
                { value: "references", label: "Use references" },
                { value: "prompt", label: "Prompt only" },
              ]}
              onChange={(value) => setUseImageReferences(value === "references")}
            />
            <ReferenceSummary
              useReferences={useImageReferences}
              selectedCount={selectedReferenceSelection.length}
              totalCount={selectedReferenceAssets.length}
            />
            {useImageReferences ? (
              <ReferencePicker
                references={selectedReferenceAssets}
                selectedIds={selectedReferenceIds}
                onToggle={toggleReferenceSelection}
              />
            ) : null}
            <TextArea label="Image prompt" value={imagePrompt} onChange={setImagePrompt} rows={6} />
            <SubmitButton
              loading={isGeneratingImage}
              icon={ImageIcon}
              label="Generate images"
              disabled={!selectedPersona || (useImageReferences && !selectedReferenceSelection.length)}
            />
          </form>
        ) : null}

        {mode === "videos" ? (
          <form onSubmit={(event) => void generateVideo(event, "normal")}>
            <PanelTitle icon={Clapperboard} title="Video Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect label="Video model" value={videoModel} options={videoModelOptions} onChange={setVideoModel} />
            <ModeToggle
              label="Reference mode"
              value={useVideoReferences ? "references" : "prompt"}
              options={[
                { value: "references", label: "Use references" },
                { value: "prompt", label: "Prompt only" },
              ]}
              onChange={(value) => setUseVideoReferences(value === "references")}
            />
            <ReferenceSummary
              useReferences={useVideoReferences}
              selectedCount={selectedReferenceSelection.length}
              totalCount={selectedReferenceAssets.length}
            />
            {useVideoReferences ? (
              <ReferencePicker
                references={selectedReferenceAssets}
                selectedIds={selectedReferenceIds}
                onToggle={toggleReferenceSelection}
              />
            ) : null}
            <TextArea label="Video prompt" value={videoPrompt} onChange={setVideoPrompt} rows={6} />
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate video"
              disabled={!selectedPersona || (useVideoReferences && !selectedReferenceSelection.length)}
            />
          </form>
        ) : null}

        {mode === "motion" ? (
          <form onSubmit={(event) => void generateVideo(event, "motion")}>
            <PanelTitle icon={Play} title="Motion Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect
              label="Motion model"
              value={motionVideoModel}
              options={motionModelOptions}
              onChange={setMotionVideoModel}
            />
            <UploadBox
              accept="image/*"
              icon={Upload}
              label={motionReferenceImage ? motionReferenceImage.name : "Upload reference image"}
              detail={selectedReference && !motionReferenceImage ? `Using ${selectedReference.title}` : ""}
              onChange={(files) => void captureMotionReferenceImage(files)}
            />
            <UploadBox
              accept="video/*"
              icon={Clapperboard}
              label={motionReferenceVideo ? motionReferenceVideo.name : "Upload motion video to imitate"}
              onChange={(files) => void captureMotionReferenceVideo(files)}
            />
            <TextArea label="Video prompt" value={videoPrompt} onChange={setVideoPrompt} rows={5} />
            <TextField label="Motion reference" value={motionReference} onChange={setMotionReference} />
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate motion video"
              disabled={!selectedPersona || (!selectedReference && !motionReferenceImage) || !motionReferenceVideo}
            />
          </form>
        ) : null}
      </aside>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function encodeFiles(files: FileList | null, fallbackMimeType: string) {
  const inputFiles = Array.from(files ?? []);
  return Promise.all(
    inputFiles.map(async (file) => {
      const dataUrl = await fileToDataUrl(file);
      return {
        name: file.name,
        mimeType: file.type || fallbackMimeType,
        data: dataUrl.split(",")[1] ?? "",
      };
    }),
  );
}

function sourceImageToDataUrl(image: SourceImageInput) {
  return `data:${image.mimeType};base64,${image.data}`;
}

function GeneratePersonaView({
  personas,
  assets,
  selectedPersona,
  onAssetsCreated,
  onSelectPersona,
  onBack,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onBack: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<ReferenceSlotId | undefined>("face");
  const [generationMode, setGenerationMode] = useState<FaceGenerationMode>("scratch");
  const [generationPrompt, setGenerationPrompt] = useState(DEFAULT_PROMPTS.face);
  const [hybridSources, setHybridSources] = useState<SourceImageInput[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-image-preview");
  const [confirmsRights, setConfirmsRights] = useState(false);
  const [confirmsAdultPersona, setConfirmsAdultPersona] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});

  const personaOptions = useMemo(() => personas, [personas]);
  const avatarModelOptions = modelsForCapability("avatar");
  const imageModelOptions = modelsForCapability("image-reference");
  
  const selectedReferenceAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
      ),
    [assets, selectedPersona?.id],
  );

  const defaultReferenceIds = useMemo(
    () => selectedReferenceAssets.filter((asset) => asset.isDefaultReference).map((asset) => asset.id),
    [selectedReferenceAssets],
  );

  const fallbackReferenceIds = useMemo(
    () => (defaultReferenceIds.length ? defaultReferenceIds : selectedReferenceAssets.map((asset) => asset.id)),
    [defaultReferenceIds, selectedReferenceAssets],
  );

  const selectedReferenceIds = useMemo(
    () => (selectedPersona ? referenceSelectionByPersona[selectedPersona.id] ?? fallbackReferenceIds : []),
    [fallbackReferenceIds, referenceSelectionByPersona, selectedPersona],
  );

  const selectedReferenceSelection = useMemo(
    () => selectedReferenceAssets.filter((asset) => selectedReferenceIds.includes(asset.id)),
    [selectedReferenceAssets, selectedReferenceIds],
  );

  function toggleReferenceSelection(assetId: string) {
    if (!selectedPersona) return;
    setReferenceSelectionByPersona((current) => {
      const currentIds = current[selectedPersona.id] ?? fallbackReferenceIds;
      const nextIds = currentIds.includes(assetId)
        ? currentIds.filter((id) => id !== assetId)
        : [...currentIds, assetId];
      return { ...current, [selectedPersona.id]: nextIds };
    });
  }

  async function captureHybridSources(files: FileList | null) {
    const newImages = await encodeFiles(files, "image/png");
    setHybridSources((current) => [...current, ...newImages]);
  }

  function removeHybridSource(index: number) {
    setHybridSources((current) => current.filter((_, i) => i !== index));
  }

  async function generateReference(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !selectedSlot) return;
    if (!confirmsRights || !confirmsAdultPersona) return;
    if (selectedSlot === "face" && generationMode === "hybrid" && hybridSources.length < 2) return;

    setIsGenerating(true);
    setGenerationError("");
    try {
      const activeSlot = referenceSlots.find((slot) => slot.id === selectedSlot);
      if (!activeSlot) throw new Error("Invalid slot");

      const assetsForSlot = assets.filter((asset) =>
        selectedSlot === "face"
          ? asset.personaId === selectedPersona.id && (asset.referenceSlot === selectedSlot || !asset.referenceSlot)
          : asset.personaId === selectedPersona.id && asset.referenceSlot === selectedSlot,
      );
      const hasDefault = assetsForSlot.some((asset) => asset.isDefaultReference);

      if (selectedSlot === "face") {
        const prompt = generationMode === "hybrid" ? DEFAULT_PROMPTS.hybrid : generationPrompt;
        const response = await fetch("/api/generate/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: generationMode === "hybrid" ? "blend" : "prompt",
            personaName: selectedPersona.name,
            description: selectedPersona.description,
            styleNotes: selectedPersona.styleNotes,
            prompt,
            aspectRatio: activeSlot.aspectRatio,
            imageSize: "4K",
            count: 1,
            sourceImages: generationMode === "hybrid" ? hybridSources.slice(0, 2) : [],
            confirmsRights,
            confirmsAdultPersona,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        const nextAssets = payload.assets.map((asset: Asset, index: number) => ({
          ...asset,
          kind: "avatar" as const,
          title: `${activeSlot.label} reference ${assetsForSlot.length + index + 1}`,
          prompt,
          personaId: selectedPersona.id,
          referenceSlot: activeSlot.id,
          isDefaultReference: !hasDefault && index === 0,
        }));
        onAssetsCreated(nextAssets, { ...payload.job, personaId: selectedPersona.id, prompt });
      } else {
        const defaultReferences = selectedReferenceSelection.length > 0 ? selectedReferenceSelection : selectedReferenceAssets;
        const referenceAssetIds = defaultReferences.map((asset) => asset.id);
        const referenceImageUrls = defaultReferences.map((asset) => asset.url);
        const response = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: selectedPersona.id,
            personaName: selectedPersona.name,
            model: selectedModel,
            prompt: generationPrompt,
            styleNotes: selectedPersona.styleNotes,
            aspectRatio: activeSlot.aspectRatio,
            imageSize: "4K",
            count: 1,
            referenceImageUrls,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        const nextAssets = payload.assets.map((asset: Asset, index: number) => ({
          ...asset,
          kind: "avatar" as const,
          title: `${activeSlot.label} reference ${assetsForSlot.length + index + 1}`,
          personaId: selectedPersona.id,
          referenceSlot: activeSlot.id,
          referenceAssetIds,
          isDefaultReference: !hasDefault && index === 0,
        }));
        onAssetsCreated(nextAssets, { ...payload.job, personaId: selectedPersona.id });
      }

      // Reset form for next generation
      setHybridSources([]);
      setConfirmsRights(false);
      setConfirmsAdultPersona(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Reference generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  const isHybrid = selectedSlot === "face" && generationMode === "hybrid";
  const activeSlot = referenceSlots.find((slot) => slot.id === selectedSlot);
  const modelOptions = selectedSlot === "face" ? avatarModelOptions : imageModelOptions;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <PanelTitle icon={WandSparkles} title="Generate References" />
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold text-stone-950 mb-3">Reference Slot</h3>
            <div className="grid grid-cols-2 gap-2">
              {referenceSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    setGenerationPrompt(slot.prompt);
                    setGenerationMode("scratch");
                    setHybridSources([]);
                    setGenerationError("");
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition",
                    selectedSlot === slot.id
                      ? "border-emerald-800 bg-white text-emerald-800"
                      : "border-stone-200 text-stone-600 hover:border-emerald-800",
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {activeSlot ? (
            <>
              {selectedSlot === "face" ? (
                <ModeToggle
                  label="Generation Mode"
                  value={generationMode}
                  options={[
                    { value: "scratch", label: "Generate from scratch" },
                    { value: "hybrid", label: "Hybrid mode" },
                  ]}
                  onChange={(value) => {
                    setGenerationMode(value as FaceGenerationMode);
                    setGenerationPrompt(value === "hybrid" ? DEFAULT_PROMPTS.hybrid : DEFAULT_PROMPTS.face);
                    setHybridSources([]);
                  }}
                />
              ) : null}

              {isHybrid ? (
                <>
                  <UploadBox
                    accept="image/*"
                    multiple={false}
                    icon={Upload}
                    label={
                      hybridSources.length < 2
                        ? `Upload face ${hybridSources.length + 1} of 2`
                        : "Both faces uploaded"
                    }
                    detail={hybridSources.length > 0 ? `${hybridSources.length} face${hybridSources.length === 1 ? "" : "s"} uploaded` : undefined}
                    onChange={captureHybridSources}
                  />
                  {hybridSources.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {hybridSources.map((image, index) => (
                        <div key={index} className="relative rounded-lg border border-stone-200 bg-white overflow-hidden">
                          <img 
                            src={sourceImageToDataUrl(image)} 
                            alt={`Face ${index + 1}`} 
                            className="aspect-square w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removeHybridSource(index)}
                              className="opacity-0 hover:opacity-100 transition flex size-10 items-center justify-center rounded-full bg-red-600 text-white"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 rounded-full bg-emerald-800 text-white text-xs font-semibold size-7 flex items-center justify-center">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              {selectedSlot !== "face" ? (
                <>
                  <ModeToggle
                    label="Reference mode"
                    value={selectedReferenceSelection.length > 0 ? "references" : "prompt"}
                    options={[
                      { value: "references", label: "Use references" },
                      { value: "prompt", label: "Prompt only" },
                    ]}
                    onChange={(value) => {
                      if (value === "prompt") {
                        setReferenceSelectionByPersona((current) => ({
                          ...current,
                          [selectedPersona?.id ?? ""]: [],
                        }));
                      }
                    }}
                  />
                  <ReferenceSummary
                    useReferences={selectedReferenceSelection.length > 0}
                    selectedCount={selectedReferenceSelection.length}
                    totalCount={selectedReferenceAssets.length}
                  />
                  {selectedReferenceAssets.length > 0 ? (
                    <ReferencePicker
                      references={selectedReferenceAssets}
                      selectedIds={selectedReferenceIds}
                      onToggle={toggleReferenceSelection}
                    />
                  ) : null}
                </>
              ) : null}

              <TextArea label="Prompt" value={generationPrompt} onChange={setGenerationPrompt} rows={7} />
            </>
          ) : null}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <form onSubmit={generateReference}>
          <PanelTitle icon={WandSparkles} title="Generation Settings" />

          {selectedSlot !== "face" ? (
            <ModelSelect label="Model" value={selectedModel} options={modelOptions} onChange={setSelectedModel} />
          ) : null}

          <label className="mt-4 flex items-start gap-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={confirmsRights}
              onChange={(event) => setConfirmsRights(event.target.checked)}
              className="mt-1 size-4 accent-emerald-800"
            />
            <span>I confirm I have rights to use the provided identity references.</span>
          </label>

          <label className="mt-2 flex items-start gap-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={confirmsAdultPersona}
              onChange={(event) => setConfirmsAdultPersona(event.target.checked)}
              className="mt-1 size-4 accent-emerald-800"
            />
            <span>I confirm this is an adult persona.</span>
          </label>

          {generationError ? (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{generationError}</p>
          ) : null}

          <SubmitButton
            loading={isGenerating}
            icon={WandSparkles}
            label="Generate"
            disabled={
              !selectedPersona ||
              !confirmsRights ||
              !confirmsAdultPersona ||
              (isHybrid && hybridSources.length < 2)
            }
          />
        </form>
      </aside>
    </div>
  );
}

function AssetsView({ assets, personas }: { assets: Asset[]; personas: Persona[] }) {
  const [filter, setFilter] = useState<AssetFilter>("all");
  const visibleAssets = assets.filter((asset) => filter === "all" || asset.kind === filter);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ModeToggle
          label="Asset filter"
          value={filter}
          options={[
            { value: "all", label: "All" },
            { value: "avatar", label: "Avatars" },
            { value: "upload", label: "Uploads" },
            { value: "image", label: "Images" },
            { value: "video", label: "Videos" },
          ]}
          onChange={(value) => setFilter(value as AssetFilter)}
        />
      </div>
      {visibleAssets.length ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleAssets.map((asset) => {
          const persona = personas.find((item) => item.id === asset.personaId);
          return (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="aspect-[4/5] bg-stone-100">
                {asset.kind === "video" ? (
                  <video src={asset.url} className="h-full w-full object-cover" controls />
                ) : (
                  <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
                <p className="mt-1 text-xs text-stone-500">{persona?.name ?? "Unassigned"} · {asset.model}</p>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-9 items-center rounded-md bg-stone-900 px-3 text-sm font-medium text-white"
                >
                  Open
                </a>
              </div>
            </article>
          );
        })}
      </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center text-sm text-stone-500">
          No assets match this filter yet.
        </div>
      )}
    </section>
  );
}

function JobsView({ jobs }: { jobs: GenerationJob[] }) {
  if (!jobs.length) {
    return (
      <section className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center text-sm text-stone-500">
        Generation jobs will appear here after you create references, images, or videos.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_130px_120px_110px] gap-4 border-b border-stone-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
        <span>Job</span>
        <span>Provider</span>
        <span>Status</span>
        <span>Cost</span>
      </div>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="grid grid-cols-[1fr_130px_120px_110px] gap-4 border-b border-stone-100 px-4 py-4 text-sm last:border-b-0"
        >
          <div>
            <p className="font-medium text-stone-950">{job.generationType.replaceAll("_", " ")}</p>
            <p className="mt-1 line-clamp-1 text-stone-500">{job.prompt}</p>
          </div>
          <span className="text-stone-600">{job.provider}</span>
          <span className="font-medium text-emerald-800">{job.status}</span>
          <span className="text-stone-600">{formatCredits(job.costEstimateCents)}</span>
        </div>
      ))}
    </section>
  );
}

function SettingsView({ spentCents }: { spentCents: number }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Settings} title="Provider Environment" />
        <div className="mt-5 grid gap-3">
          {[
            ["NEXT_PUBLIC_SUPABASE_URL", "Supabase app URL"],
            ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase browser key"],
            ["SUPABASE_SERVICE_ROLE_KEY", "Server-side storage and jobs"],
            ["GEMINI_API_KEY", "Nano Banana Pro image generation"],
            ["OPENAI_API_KEY", "ChatGPT image generation"],
            ["NANO_BANANA_MODEL", "Defaults to gemini-3-pro-image-preview"],
            ["WAN_API_BASE_URL", "Wan-compatible video endpoint"],
            ["WAN_API_KEY", "Wan video provider key"],
          ].map(([name, detail]) => (
            <div key={name} className="rounded-lg bg-stone-50 p-4">
              <p className="font-mono text-sm font-semibold text-stone-900">{name}</p>
              <p className="mt-1 text-sm text-stone-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Coins} title="Models And Usage" />
        <p className="mt-5 text-3xl font-semibold text-emerald-900">{formatCredits(spentCents)}</p>
        <div className="mt-5 grid gap-3">
          {MODEL_REGISTRY.map((model) => (
            <div key={model.id} className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-stone-950">{model.label}</p>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                  {model.provider}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-stone-500">{model.id}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{model.notes}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Sparkles; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
        <Icon size={19} />
      </div>
      <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
    </div>
  );
}

function UploadBox({
  accept,
  multiple = false,
  icon: Icon,
  label,
  detail,
  onChange,
}: {
  accept: string;
  multiple?: boolean;
  icon: typeof Sparkles;
  label: string;
  detail?: string;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 text-center text-sm font-medium text-stone-700 transition hover:border-emerald-800 hover:bg-white">
      <span className="inline-flex items-center gap-2">
        <Icon className="text-emerald-800" size={18} />
        {label}
      </span>
      {detail ? <span className="mt-2 max-w-full truncate text-xs font-normal text-stone-500">{detail}</span> : null}
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onChange(event.target.files)}
      />
    </label>
  );
}

function ReferencePicker({
  references,
  selectedIds,
  onToggle,
}: {
  references: Asset[];
  selectedIds: string[];
  onToggle: (assetId: string) => void;
}) {
  if (!references.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        No reference images yet. Add references from the persona manager.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {references.map((asset) => {
        const isSelected = selectedIds.includes(asset.id);
        return (
          <label
            key={asset.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border bg-stone-50 p-3 text-sm text-stone-700 transition",
              isSelected ? "border-emerald-800" : "border-stone-200",
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(asset.id)}
              className="size-4 accent-emerald-800"
            />
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-md bg-stone-100 p-2">
              <img src={asset.url} alt={asset.title} className="h-full w-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
              <p className="mt-1 text-xs text-stone-500">
                {asset.isDefaultReference ? "Default" : "Optional"}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function ReferenceSummary({
  useReferences,
  selectedCount,
  totalCount,
}: {
  useReferences: boolean;
  selectedCount: number;
  totalCount: number;
}) {
  return (
    <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
      {!useReferences
        ? "Prompt-only generation enabled. No references will be used."
        : totalCount === 0
          ? "No references available yet. Add references to this persona first."
          : selectedCount === 0
            ? "Select at least one reference or switch to prompt-only."
            : `${selectedCount} of ${totalCount} reference image${totalCount === 1 ? "" : "s"} selected.`}
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-800"
      />
    </label>
  );
}

function ModeToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1 rounded-md bg-stone-100 p-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 flex-1 rounded-[5px] px-3 text-sm font-medium transition",
              value === option.value ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonaSelect({
  personas,
  value,
  onChange,
}: {
  personas: Persona[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">Persona</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      >
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({
  loading,
  icon: Icon,
  label,
  disabled,
}: {
  loading: boolean;
  icon: typeof Sparkles;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:bg-stone-300"
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : <Icon size={18} />}
      {label}
    </button>
  );
}
