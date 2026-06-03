"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Activity,
  Clapperboard,
  Coins,
  ImageIcon,
  Loader2,
  Play,
  Settings,
  Sparkles,
  Upload,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { demoAssets, demoJobs, demoLedger, demoPersonas } from "@/lib/demo-data";
import { MODEL_REGISTRY } from "@/lib/model-registry";
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

type View = "personas" | "create" | "assets" | "jobs" | "settings";
type CreateTab = "references" | "images" | "videos" | "motion";
type AvatarMode = "prompt" | "normalization" | "blend";
type AssetFilter = "all" | "avatar" | "upload" | "image" | "video";

const navItems = [
  { id: "personas", label: "Personas", icon: UserRound },
  { id: "create", label: "Create", icon: WandSparkles },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const createTabs = [
  { id: "references", label: "References", icon: Sparkles },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Clapperboard },
  { id: "motion", label: "Motion Control", icon: Play },
] as const;

const promptModePromptSuggestions = [
  {
    label: "Face grid - 4K, 1:1",
    prompt:
      "A 3x3 grid face sheet of the same woman, consistent facial identity, showing multiple different expressions (smiling, neutral, surprised, angry, sad) and looking into different directions (left, right, bottom, up). Character model sheet, extremely photorealistic, identical facial features, studio lighting, clean background, no text.",
  },
];

const normalizationPromptSuggestions = [
  {
    label: "Face avatar reference",
    prompt:
      "Using the uploaded reference photo as the identity reference, create a super-realistic passport-style headshot of the same adult woman. Make it a very tight close-up with only the face and hair visible, filling most of the frame, with no clothing visible. The composition must be centered and strictly front-facing, looking directly into the camera with a neutral expression, closed mouth, relaxed eyes, and no head tilt.\n\nKeep the face recognizable and realistic while gently refining the appearance into a natural, elegant, feminine, adult look. Improve facial clarity, skin texture, and overall image quality while preserving realistic proportions and identity. Use soft, even passport-photo lighting, a plain light gray or off-white background, and true-to-life color. Skin should look natural and detailed with subtle pores and realistic texture, never plastic or over-retouched. Hair should appear natural and neatly arranged around the face.\n\nThe final image should feel mature, realistic, clean, and high-resolution, avoiding exaggerated youthfulness, childish facial features, beauty-filter effects, heavy makeup, glamor lighting, blur, cartoon/anime styling, dramatic shadows, or artificial-looking skin.",
  },
  {
    label: "Full body avatar reference",
    prompt:
      "Create a hyperrealistic full-body portrait of the same woman from the reference photo, using the uploaded face as the sole identity reference. Preserve her facial structure, skin tone, expression, and natural realism with extreme fidelity. Extend the image from the passport-style headshot to a knees-up composition, standing or posing naturally, front-facing, elegant, and centered. She should have curvy feminine proportions with a 90-60-90 figure, noticeably narrow waist, rounded hips, clearly visible silhouette, including full hips and a medium-full bust, wearing fitted black tank top and high-waisted jeans. Neutral expression, closed mouth, relaxed eyes, and no head tilt.\n\nKeep the result extremely photorealistic, true-to-life skin texture, natural pores, realistic hair strands, realistic anatomy, subtle body contours, and believable fabric behavior. Use soft, even passport-style studio lighting, a clean white background, neutral shadows, accurate color, and a crisp high-end editorial finish. The image should feel like a real photograph, not illustration, CGI, or beauty-filtered. Maintain natural proportions, refined symmetry, and a graceful, premium fashion/editorial look. Camera should be eye-level, sharp focus, centered composition, and realistic lens rendering.",
  },
];

const blendPromptSuggestions = [
  {
    label: "Hybrid",
    prompt:
      "Make a hybrid of these two faces, merge them into a single, cohesive identity with balanced proportions. The hair must be like on the first picture but with red alternating colour instead of yellow. Blue eyes. Natural, elegant, feminine, young look. Improve facial clarity, skin texture, and overall image quality. Soft, even passport-photo lighting, a plain light gray or off-white background, and true-to-life color. Natural, detailed skin with subtle pores and realistic texture. Realistic, clean, high-resolution, 4K.",
  },
];

const avatarPromptDefaults: Record<AvatarMode, string> = {
  prompt: promptModePromptSuggestions[0]?.prompt ?? "",
  normalization: normalizationPromptSuggestions[0]?.prompt ?? "",
  blend: blendPromptSuggestions[0]?.prompt ?? "",
};

function promptSuggestionsForMode(mode: AvatarMode) {
  if (mode === "normalization") {
    return normalizationPromptSuggestions;
  }

  if (mode === "blend") {
    return blendPromptSuggestions;
  }

  return promptModePromptSuggestions;
}

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

  function addPersona(persona: Persona) {
    setPersonas((current) => [persona, ...current]);
    setSelectedPersonaId(persona.id);
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
              onCreate={() => setView("create")}
              onAddReferences={addReferenceAssets}
              onToggleReferenceDefault={toggleReferenceDefault}
              onDeleteReference={deleteReferenceAsset}
            />
          )}
          {view === "create" && (
            <CreateView
              personas={personas}
              assets={assets}
              selectedPersona={selectedPersona}
              selectedReference={selectedReference}
              onPersonaCreated={(persona, nextAssets, job) => {
                addPersona(persona);
                addAssets(nextAssets);
                addJob(job);
                setNotice(`${persona.name} is ready as an active reference persona.`);
              }}
              onReferencesUploaded={(persona, nextAssets) => {
                addPersona(persona);
                addAssets(nextAssets);
                setNotice(`${nextAssets.length} reference upload${nextAssets.length === 1 ? "" : "s"} added for ${persona.name}.`);
              }}
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
  onCreate,
  onAddReferences,
  onToggleReferenceDefault,
  onDeleteReference,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersonaId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
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
  const [pendingReferences, setPendingReferences] = useState<SourceImageInput[]>([]);

  async function capturePersonaReferences(files: FileList | null) {
    setPendingReferences(await encodeFiles(files, "image/png"));
  }

  function addPersonaReferences(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !pendingReferences.length) return;

    const createdAt = new Date().toISOString();
    const hasDefault = referenceAssets.some((asset) => asset.isDefaultReference);
    const isDefaultReference = !hasDefault;
    const nextAssets: Asset[] = pendingReferences.map((image, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "upload",
      title: `${selectedPersona.name} reference ${referenceAssets.length + index + 1}`,
      url: sourceImageToDataUrl(image),
      prompt: "Uploaded local reference.",
      personaId: selectedPersona.id,
      isDefaultReference,
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
      <section className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center">
        <WandSparkles className="mx-auto text-emerald-800" size={32} />
        <h2 className="mt-3 text-lg font-semibold text-stone-950">No personas yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
          Create a persona or upload your own reference photos to start creating images and videos.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          <WandSparkles size={18} />
          Create personas
        </button>
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
        {personas.map((persona) => {
          const reference = assets.find((asset) => asset.id === persona.referenceAssetId);
          const personaAssets = assets.filter((asset) => asset.personaId === persona.id);
          return (
            <button
              key={persona.id}
              onClick={() => onSelect(persona.id)}
              className={cn(
                "overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
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
          onClick={onCreate}
          className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/70 p-8 text-center transition hover:border-emerald-800 hover:bg-white"
        >
          <WandSparkles className="text-emerald-800" size={30} />
          <span className="mt-3 text-base font-semibold text-stone-950">New persona</span>
        </button>
      </section>

      {selectedPersona ? (
        <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
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

function CreateView({
  personas,
  assets,
  selectedPersona,
  selectedReference,
  onPersonaCreated,
  onReferencesUploaded,
  onAssetsCreated,
  onSelectPersona,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  selectedReference?: Asset;
  onPersonaCreated: (persona: Persona, assets: Asset[], job: GenerationJob) => void;
  onReferencesUploaded: (persona: Persona, assets: Asset[]) => void;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<CreateTab>("references");
  const [referenceMode, setReferenceMode] = useState<"chooser" | "generate" | "upload">("chooser");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("prompt");
  const [personaName, setPersonaName] = useState("Aria Sol");
  const [description, setDescription] = useState("A fashion-tech creator with a warm, editorial social presence.");
  const [styleNotes, setStyleNotes] = useState("Natural skin texture, premium streetwear, warm studio light.");
  const [avatarPrompt, setAvatarPrompt] = useState(avatarPromptDefaults.prompt);
  const [sourceImages, setSourceImages] = useState<SourceImageInput[]>([]);
  const [uploadedReferences, setUploadedReferences] = useState<SourceImageInput[]>([]);
  const [confirmsRights, setConfirmsRights] = useState(true);
  const [confirmsAdultPersona, setConfirmsAdultPersona] = useState(true);
  const [imagePrompt, setImagePrompt] = useState("Editorial product photo for a social launch campaign.");
  const [videoPrompt, setVideoPrompt] = useState("Short vertical clip with a confident camera turn and subtle smile.");
  const [useImageReferences, setUseImageReferences] = useState(true);
  const [useVideoReferences, setUseVideoReferences] = useState(true);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [motionReference, setMotionReference] = useState("slow head turn, right hand product reveal");
  const [motionReferenceImage, setMotionReferenceImage] = useState<SourceImageInput | undefined>();
  const [motionReferenceVideo, setMotionReferenceVideo] = useState<SourceVideoInput | undefined>();
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const avatarPromptSuggestions = useMemo(() => promptSuggestionsForMode(avatarMode), [avatarMode]);
  const requiredSourceImages = avatarMode === "blend" ? 2 : avatarMode === "normalization" ? 1 : 0;
  const personaOptions = useMemo(() => personas, [personas]);
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
  const selectedReferenceSelection = useMemo(
    () => selectedReferenceAssets.filter((asset) => selectedReferenceIds.includes(asset.id)),
    [selectedReferenceAssets, selectedReferenceIds],
  );
  const activeReferenceMode =
    activeTab === "images" ? useImageReferences : activeTab === "videos" ? useVideoReferences : activeTab === "motion";
  const activeReferencePreview =
    activeTab === "motion" ? selectedReference : selectedReferenceSelection[0] ?? selectedReferenceAssets[0];
  const activeReferenceAssets =
    activeTab === "motion"
      ? selectedReference
        ? [selectedReference]
        : []
      : selectedReferenceSelection;
  const hasReference = Boolean(selectedPersona && activeReferencePreview);
  const showReferencePanel = activeTab !== "references" && activeReferenceMode && hasReference;

  useEffect(() => {
    if (!selectedPersona) {
      setSelectedReferenceIds([]);
      return;
    }

    if (defaultReferenceIds.length) {
      setSelectedReferenceIds(defaultReferenceIds);
      return;
    }

    setSelectedReferenceIds(selectedReferenceAssets.map((asset) => asset.id));
  }, [selectedPersona?.id, selectedReferenceAssets, defaultReferenceIds]);

  function handleAvatarModeChange(nextMode: AvatarMode) {
    setAvatarMode(nextMode);
    setAvatarPrompt(avatarPromptDefaults[nextMode]);
    setSourceImages((current) => {
      if (nextMode === "prompt") {
        return [];
      }

      if (nextMode === "normalization") {
        return current.slice(0, 1);
      }

      return current;
    });
  }

  function toggleReferenceSelection(assetId: string) {
    setSelectedReferenceIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  async function generateAvatar(event: FormEvent) {
    event.preventDefault();
    if (requiredSourceImages && sourceImages.length < requiredSourceImages) {
      return;
    }

    const avatarSourceImages = avatarMode === "prompt" ? [] : sourceImages;
    setIsGeneratingAvatar(true);
    try {
      const response = await fetch("/api/generate/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: avatarMode,
          personaName,
          description,
          prompt: avatarPrompt,
          styleNotes,
          aspectRatio: "4:5",
          imageSize: "2K",
          count: 1,
          sourceImageNames: avatarSourceImages.map((image) => image.name),
          sourceImages: avatarSourceImages,
          confirmsRights,
          confirmsAdultPersona,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Avatar generation failed.");
      }
      const nextAssets = payload.assets.map((asset: Asset) => ({
        ...asset,
        isDefaultReference: true,
      }));
      onPersonaCreated(payload.persona, nextAssets, payload.job);
    } finally {
      setIsGeneratingAvatar(false);
    }
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
        model: mode === "motion" ? "wan-animate" : "wan-2.2",
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

  async function captureSourceImages(files: FileList | null) {
    setSourceImages(await encodeFiles(files, "image/png"));
  }

  async function captureUploadedReferences(files: FileList | null) {
    setUploadedReferences(await encodeFiles(files, "image/png"));
  }

  async function captureMotionReferenceImage(files: FileList | null) {
    const [image] = await encodeFiles(files, "image/png");
    setMotionReferenceImage(image);
  }

  async function captureMotionReferenceVideo(files: FileList | null) {
    const [video] = await encodeFiles(files, "video/mp4");
    setMotionReferenceVideo(video);
  }

  function uploadReferences(event: FormEvent) {
    event.preventDefault();
    if (!uploadedReferences.length) return;

    const createdAt = new Date().toISOString();
    const personaId = `persona-${crypto.randomUUID()}`;
    const nextAssets: Asset[] = uploadedReferences.map((image, index) => ({
      id: `asset-${crypto.randomUUID()}`,
      kind: "upload",
      title: `${personaName} uploaded reference ${index + 1}`,
      url: sourceImageToDataUrl(image),
      prompt: "Uploaded local reference.",
      personaId,
      isDefaultReference: true,
      generationType: "reference_upload",
      provider: "demo",
      model: "local-upload",
      mimeType: image.mimeType,
      createdAt,
    }));

    onReferencesUploaded(
      {
        id: personaId,
        name: personaName,
        description,
        styleNotes,
        status: "active",
        referenceAssetId: nextAssets[0]?.id,
        createdAt,
      },
      nextAssets,
    );
    setUploadedReferences([]);
  }

  function renderReferenceTabContent() {
    if (referenceMode === "chooser") {
      return (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setReferenceMode("generate")}
            className="rounded-lg border border-stone-200 bg-stone-100 p-6 text-left transition hover:-translate-y-0.5 hover:border-emerald-800 hover:bg-white hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-950">Generate References</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Create a new reference persona from prompt guidance or blended inputs.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setReferenceMode("upload")}
            className="rounded-lg border border-stone-200 bg-stone-100 p-6 text-left transition hover:-translate-y-0.5 hover:border-emerald-800 hover:bg-white hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <Upload size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-950">Upload Existing References</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Bring in existing reference images to create a persona from uploads.
                </p>
              </div>
            </div>
          </button>
          </div>
        </div>
      );
    }

    if (referenceMode === "generate") {
      return (
        <div className="grid gap-5">
          <button
            type="button"
            onClick={() => setReferenceMode("chooser")}
            className="w-fit rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            Back
          </button>

          <form onSubmit={generateAvatar} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <PanelTitle icon={Sparkles} title="Generate References" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField label="Persona name" value={personaName} onChange={setPersonaName} />
              <ModeToggle
                label="Avatar source"
                value={avatarMode}
                options={[
                  { value: "prompt", label: "Prompt" },
                  { value: "normalization", label: "Normalize image" },
                  { value: "blend", label: "Blend images" },
                ]}
                onChange={(value) => handleAvatarModeChange(value as AvatarMode)}
              />
              <TextArea label="Description" value={description} onChange={setDescription} />
              <TextArea label="Style notes" value={styleNotes} onChange={setStyleNotes} />
            </div>
            {avatarPromptSuggestions.length ? (
              <PromptSuggestions
                suggestions={avatarPromptSuggestions}
                onSelect={(prompt) => setAvatarPrompt(prompt)}
              />
            ) : null}
            <TextArea label="Avatar prompt" value={avatarPrompt} onChange={setAvatarPrompt} rows={7} />
            {avatarMode !== "prompt" && (
              <UploadBox
                accept="image/*"
                multiple={avatarMode === "blend"}
                icon={Upload}
                label={
                  sourceImages.length
                    ? `${sourceImages.length} ${
                        avatarMode === "blend" ? "source" : "reference"
                      } image${sourceImages.length === 1 ? "" : "s"} selected`
                    : avatarMode === "blend"
                      ? "Upload source images"
                      : "Upload reference image to normalize"
                }
                detail={sourceImages.map((image) => image.name).join(", ")}
                onChange={(files) => void captureSourceImages(files)}
              />
            )}
            <div className="mt-4 grid gap-2 text-sm text-stone-700 md:grid-cols-2">
              <Checkbox checked={confirmsRights} onChange={setConfirmsRights} label="I have rights to the inputs." />
              <Checkbox
                checked={confirmsAdultPersona}
                onChange={setConfirmsAdultPersona}
                label="This persona represents an adult."
              />
            </div>
            <SubmitButton
              loading={isGeneratingAvatar}
              icon={WandSparkles}
              label="Generate reference"
              disabled={Boolean(requiredSourceImages && sourceImages.length < requiredSourceImages)}
            />
          </form>
        </div>
      );
    }

    return (
      <div className="grid gap-5">
        <button
          type="button"
          onClick={() => setReferenceMode("chooser")}
          className="w-fit rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
        >
          Back
        </button>

        <form onSubmit={uploadReferences} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <PanelTitle icon={Upload} title="Upload Existing References" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField label="Persona name" value={personaName} onChange={setPersonaName} />
            <TextArea label="Description" value={description} onChange={setDescription} />
            <TextArea label="Style notes" value={styleNotes} onChange={setStyleNotes} />
          </div>
          <UploadBox
            accept="image/*"
            multiple
            icon={Upload}
            label={
              uploadedReferences.length
                ? `${uploadedReferences.length} reference image${uploadedReferences.length === 1 ? "" : "s"} selected`
                : "Upload reference photos"
            }
            detail={uploadedReferences.map((image) => image.name).join(", ")}
            onChange={(files) => void captureUploadedReferences(files)}
          />
          <SubmitButton
            loading={false}
            icon={Upload}
            label="Add references"
            disabled={!uploadedReferences.length}
          />
        </form>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-5",
        showReferencePanel ? "xl:grid-cols-[minmax(0,1fr)_390px]" : "xl:grid-cols-1",
      )}
    >
      <div className="grid gap-5">
        <div className="rounded-lg border border-stone-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 md:grid-cols-4">
            {createTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                    activeTab === tab.id
                      ? "tab-selected text-white"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  )}
                >
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "references" && renderReferenceTabContent()}

        {activeTab === "images" && (
          <form onSubmit={generateImage} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <PanelTitle icon={ImageIcon} title="Images" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
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
              disabled={useImageReferences && !selectedReferenceSelection.length}
            />
          </form>
        )}

        {activeTab === "videos" && (
          <form
            onSubmit={(event) => void generateVideo(event, "normal")}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <PanelTitle icon={Clapperboard} title="Videos" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
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
              disabled={useVideoReferences && !selectedReferenceSelection.length}
            />
          </form>
        )}

        {activeTab === "motion" && (
          <form
            onSubmit={(event) => void generateVideo(event, "motion")}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <PanelTitle icon={Play} title="Motion Control Video" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
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
        )}
      </div>

      {showReferencePanel ? (
        <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <PanelTitle icon={UserRound} title="Reference Overview" />
          {selectedPersona ? (
            <>
              {activeReferenceMode ? (
                activeReferenceAssets.length ? (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {activeReferenceAssets.slice(0, 6).map((asset) => (
                      <div
                        key={asset.id}
                        className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-stone-100 p-2"
                      >
                        <img src={asset.url} alt={asset.title} className="h-full w-full object-contain" />
                      </div>
                    ))}
                    {activeReferenceAssets.length > 6 ? (
                      <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500">
                        +{activeReferenceAssets.length - 6}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
                    No references selected yet.
                  </div>
                )
              ) : (
                <div className="mt-5 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
                  Prompt-only generation enabled for this step.
                </div>
              )}
              <h2 className="mt-4 text-xl font-semibold text-stone-950">{selectedPersona.name}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{selectedPersona.description}</p>
              <div className="mt-4 rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                {selectedPersona.styleNotes}
              </div>
            </>
          ) : null}
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {["References", "Uploads", "Images", "Videos"].map((label) => (
              <div key={label} className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">{label}</p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {
                    assets.filter((asset) =>
                      label === "References"
                        ? asset.kind === "avatar" && asset.personaId === selectedPersona?.id
                        : label === "Uploads"
                          ? asset.kind === "upload" && asset.personaId === selectedPersona?.id
                          : label === "Images"
                            ? asset.kind === "image" && asset.personaId === selectedPersona?.id
                            : asset.kind === "video" && asset.personaId === selectedPersona?.id,
                    ).length
                  }
                </p>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
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

function PromptSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: { label: string; prompt: string }[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-stone-700">Default prompts</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion.label}
            onClick={() => onSelect(suggestion.prompt)}
            className="inline-flex min-h-9 items-center rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:border-emerald-800 hover:text-emerald-900"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
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

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-emerald-800"
      />
      <span>{label}</span>
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
