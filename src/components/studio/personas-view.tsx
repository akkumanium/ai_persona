/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, Loader2, Pencil, Star, Trash2, Upload, UserRound, WandSparkles, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { referenceSlots } from "@/components/studio/constants";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { ReferenceSlotId } from "@/components/studio/types";
import { PanelTitle, SubmitButton, TextArea, TextField } from "@/components/studio/ui";
import { NANO_BANANA_PRO_MODEL_ID } from "@/lib/image-model-options";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

export function PersonasView({
  personas,
  assets,
  supabaseReady,
  personaLimit = 0,
  selectedPersonaId,
  onSelect,
  onUpdatePersona,
  onCreatePersona,
  onCreateLimitReached,
  onDeletePersona,
  onAddReferences,
  onToggleReferenceDefault,
  onDeleteReference,
  onReferenceEdited,
  onNavigateToGenerate,
}: {
  personas: Persona[];
  assets: Asset[];
  supabaseReady?: boolean;
  personaLimit?: number | null;
  selectedPersonaId?: string;
  onSelect: (id: string) => void;
  onUpdatePersona: (personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) => void;
  onCreatePersona: (persona: Persona) => boolean | Promise<boolean>;
  onCreateLimitReached?: () => boolean | Promise<boolean>;
  onDeletePersona: (personaId: string) => void;
  onAddReferences: (personaId: string, assets: Asset[]) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (personaId: string, assetId: string) => void;
  onReferenceEdited: (assets: Asset[], job: GenerationJob) => void;
  onNavigateToGenerate: (slotId?: ReferenceSlotId, personaId?: string) => void;
}) {
  const [managedPersonaId, setManagedPersonaId] = useState<string | undefined>();
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const managedPersona = personas.find((persona) => persona.id === managedPersonaId);
  const canCreatePersona = personaLimit === null || personas.length < personaLimit;

  function openPersona(personaId: string) {
    onSelect(personaId);
    setManagedPersonaId(personaId);
  }

  async function beginCreatePersona() {
    if (!canCreatePersona) {
      const canCreateAfterRefresh = await onCreateLimitReached?.();
      if (!canCreateAfterRefresh) return;
    }
    setIsCreatingPersona(true);
  }

  async function createPersona(event: FormEvent) {
    event.preventDefault();
    const name = newPersonaName.trim();
    const description = newDescription.trim();
    if (!canCreatePersona) {
      const canCreateAfterRefresh = await onCreateLimitReached?.();
      if (!canCreateAfterRefresh) return;
    }
    if (!name || !description) return;

    const personaId = crypto.randomUUID();
    const created = await onCreatePersona({
      id: personaId,
      name,
      description,
      styleNotes: "",
      status: "active",
      createdAt: new Date().toISOString(),
    });
    if (!created) return;
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
        supabaseReady={supabaseReady}
        onBack={() => setManagedPersonaId(undefined)}
        onDeletePersona={(personaId) => {
          onDeletePersona(personaId);
          setManagedPersonaId(undefined);
        }}
        onUpdatePersona={onUpdatePersona}
        onAddReferences={onAddReferences}
        onToggleReferenceDefault={onToggleReferenceDefault}
        onDeleteReference={onDeleteReference}
        onReferenceEdited={onReferenceEdited}
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
          onClick={beginCreatePersona}
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
            const personaAssets = assets.filter(
              (asset) => asset.personaId === persona.id && !isUploadedVideoSource(asset),
            );
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
            onClick={beginCreatePersona}
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
  supabaseReady,
  onBack,
  onDeletePersona,
  onUpdatePersona,
  onAddReferences,
  onToggleReferenceDefault,
  onDeleteReference,
  onReferenceEdited,
  onNavigateToGenerate,
}: {
  persona: Persona;
  assets: Asset[];
  supabaseReady?: boolean;
  onBack: () => void;
  onDeletePersona: (personaId: string) => void;
  onUpdatePersona: (personaId: string, updates: Partial<Pick<Persona, "name" | "description" | "styleNotes">>) => void;
  onAddReferences: (personaId: string, assets: Asset[]) => void;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (personaId: string, assetId: string) => void;
  onReferenceEdited: (assets: Asset[], job: GenerationJob) => void;
  onNavigateToGenerate: (slotId?: ReferenceSlotId, personaId?: string) => void;
}) {
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [personaNameDraft, setPersonaNameDraft] = useState(persona.name);
  const [personaDescriptionDraft, setPersonaDescriptionDraft] = useState(persona.description);
  const [previewAssetId, setPreviewAssetId] = useState<string | undefined>();
  const [uploadingSlotId, setUploadingSlotId] = useState<ReferenceSlotId | undefined>();
  const [uploadError, setUploadError] = useState("");
  const [editingReference, setEditingReference] = useState<Asset | undefined>();
  const referenceAssets = assets.filter(
    (asset) => asset.personaId === persona.id && (asset.kind === "avatar" || asset.kind === "upload"),
  );
  const imageAssets = assets.filter((asset) => asset.personaId === persona.id && asset.kind === "image");
  const videoAssets = assets.filter(
    (asset) => asset.personaId === persona.id && asset.kind === "video" && !isUploadedVideoSource(asset),
  );
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

  async function captureSlotUpload(slot: (typeof referenceSlots)[number], files: FileList | null) {
    setUploadingSlotId(slot.id);
    setUploadError("");
    try {
      const images = await encodeFiles(files, "image/png", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `references/${persona.id}/${slot.id}`,
      });
      if (!images.length) return;
      const createdAt = new Date().toISOString();
      const hasDefault = referenceAssets.some((asset) => asset.isDefaultReference);
      const nextAssets: Asset[] = images.map((image, index) => ({
        id: crypto.randomUUID(),
        kind: "upload",
        title: `${slot.label} reference ${assetsForSlot(slot.id).length + index + 1}`,
        url: sourceImageToDataUrl(image),
        storageBucket: image.storageBucket,
        storagePath: image.storagePath,
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
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Reference upload failed.");
    } finally {
      setUploadingSlotId(undefined);
    }
  }

  function confirmPersonaDelete() {
    if (window.confirm("Are you sure you want to do this?")) {
      onDeletePersona(persona.id);
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
                onClick={() => onNavigateToGenerate(undefined, persona.id)}
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
            previewAsset={previewAsset?.referenceSlot === slot.id ? previewAsset : undefined}
            onGenerate={() => onNavigateToGenerate(slot.id, persona.id)}
            onUpload={(files) => void captureSlotUpload(slot, files)}
            uploading={uploadingSlotId === slot.id}
            onToggleReferenceDefault={onToggleReferenceDefault}
            onDeleteReference={(assetId) => onDeleteReference(persona.id, assetId)}
            onEditReference={setEditingReference}
            onPreviewReference={(asset) => setPreviewAssetId(asset.id)}
          />
        ))}
      </div>
      {uploadError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{uploadError}</p> : null}

      {editingReference ? (
        <ReferenceEditor
          asset={editingReference}
          persona={persona}
          onAssetsCreated={onReferenceEdited}
          onClose={() => setEditingReference(undefined)}
        />
      ) : null}

      <AssetSection title="Images" assets={imageAssets} />
      <AssetSection title="Videos" assets={videoAssets} />
    </section>
  );
}

function ReferenceSlotCard({
  slot,
  assets,
  previewAsset,
  onGenerate,
  onUpload,
  uploading,
  onToggleReferenceDefault,
  onDeleteReference,
  onEditReference,
  onPreviewReference,
}: {
  slot: (typeof referenceSlots)[number];
  assets: Asset[];
  previewAsset?: Asset;
  onGenerate: () => void;
  onUpload: (files: FileList | null) => void;
  uploading?: boolean;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (assetId: string) => void;
  onEditReference: (asset: Asset) => void;
  onPreviewReference: (asset: Asset) => void;
}) {
  const latestAsset = assets[0];
  const displayAsset = previewAsset ?? latestAsset;
  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-stone-950">{slot.label}</h3>
        {displayAsset?.isDefaultReference ? <Star className="text-emerald-800" size={16} /> : null}
      </div>
      <div className="mt-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-white">
        {displayAsset ? (
          <img src={displayAsset.url} alt={displayAsset.title} className="h-full w-full object-cover" />
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
        <label
          className={cn(
            "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950",
            uploading && "opacity-80",
          )}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload size={16} />}
          {uploading ? "Uploading" : "Upload"}
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              onUpload(event.target.files);
              event.target.value = "";
            }}
          />
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
              onEditReference={onEditReference}
              onPreviewReference={onPreviewReference}
              isPreviewed={previewAsset?.id === asset.id}
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
                  <img src={asset.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-3">
                {asset.kind !== "image" ? (
                  <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                ) : null}
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
  onEditReference,
  onPreviewReference,
  isPreviewed = false,
}: {
  asset: Asset;
  onToggleReferenceDefault: (assetId: string) => void;
  onDeleteReference: (assetId: string) => void;
  onEditReference: (asset: Asset) => void;
  onPreviewReference: (asset: Asset) => void;
  isPreviewed?: boolean;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2">
      <>
          <button
            type="button"
            onClick={() => onPreviewReference(asset)}
            className={cn(
              "block w-full text-left text-xs font-semibold transition hover:text-emerald-800 hover:underline",
              isPreviewed ? "text-emerald-800" : "text-stone-900",
            )}
          >
            Preview image
          </button>
          <p className="mt-1 text-[11px] text-stone-500"></p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEditReference(asset)}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-emerald-800"
            >
              <Pencil size={12} />
              Edit
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
    </div>
  );
}

function ReferenceEditor({
  asset,
  persona,
  onAssetsCreated,
  onClose,
}: {
  asset: Asset;
  persona: Persona;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onClose: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const slotId: ReferenceSlotId = asset.referenceSlot === "chest-up" || asset.referenceSlot === "body" || asset.referenceSlot === "face-grid"
    ? asset.referenceSlot
    : "face";
  const slot = referenceSlots.find((candidate) => candidate.id === slotId) ?? referenceSlots[0];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const requestedChanges = instructions.trim();
    if (requestedChanges.length < 10) return;

    setIsGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: persona.id,
          personaName: persona.name,
          model: NANO_BANANA_PRO_MODEL_ID,
          prompt: [
            "Edit this reference image while preserving the persona's identity, facial features, body proportions, and overall likeness.",
            `Requested changes: ${requestedChanges}`,
          ].join("\n"),
          additionalPrompt: "",
          styleNotes: persona.styleNotes,
          aspectRatio: slot.aspectRatio,
          imageSize: "2K",
          count: 1,
          assetKind: "avatar",
          referenceSlot: slotId,
          referenceAssetIds: [asset.id],
          referenceImageUrls: [asset.url],
          isDefaultReference: false,
          titlePrefix: `Edited ${slot.label} reference`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Reference edit failed.");
      onAssetsCreated(payload.assets, payload.job);
      onClose();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Reference edit failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="reference-editor-title">
      <form onSubmit={submit} className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="reference-editor-title" className="text-lg font-semibold text-stone-950">Edit {slot.label.toLowerCase()} reference</h2>
            <p className="mt-1 text-sm text-stone-600">Describe the changes to make. The edited version will be saved in this same reference slot; the original remains available.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-md p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 disabled:opacity-50"
            aria-label="Close reference editor"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
            <img src={asset.url} alt={asset.title} className="aspect-[4/5] h-full w-full object-cover" />
          </div>
          <div>
            <TextArea
              label="Changes"
              value={instructions}
              onChange={setInstructions}
              rows={7}
            />
            <p className="mt-2 text-xs leading-5 text-stone-500">Identity and proportions are kept from the selected reference.</p>
            {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <SubmitButton
              loading={isGenerating}
              icon={Pencil}
              label="Save edited reference"
              disabled={instructions.trim().length < 10}
            />
          </div>
        </div>
      </form>
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/80 px-4">
      <form onSubmit={onSubmit} className="persona-dialog-panel w-full max-w-lg rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
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

function isUploadedVideoSource(asset: Asset) {
  return asset.kind === "video" && asset.generationType === "reference_upload";
}
