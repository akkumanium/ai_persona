/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, Upload, WandSparkles, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { DEFAULT_PROMPTS, referenceSlots } from "@/components/studio/constants";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { FaceGenerationMode, ReferenceSlotId, SourceImageInput } from "@/components/studio/types";
import {
  ModelSelect,
  ModeToggle,
  PanelTitle,
  PersonaSelect,
  ReferencePicker,
  ReferenceSummary,
  SubmitButton,
  TextArea,
  UploadBox,
} from "@/components/studio/ui";
import { modelsForCapability } from "@/lib/model-registry";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GeneratePersonaView({
  personas,
  assets,
  selectedPersona,
  initialSlotId,
  onAssetsCreated,
  onSelectPersona,
  onBack,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  initialSlotId?: ReferenceSlotId;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onBack: () => void;
}) {
  const initialSelectedSlot = initialSlotId ?? "face";
  const initialPrompt = referenceSlots.find((slot) => slot.id === initialSelectedSlot)?.prompt ?? DEFAULT_PROMPTS.face;
  const [selectedSlot, setSelectedSlot] = useState<ReferenceSlotId | undefined>(initialSelectedSlot);
  const [generationMode, setGenerationMode] = useState<FaceGenerationMode>("scratch");
  const [generationPrompt, setGenerationPrompt] = useState(initialPrompt);
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
    () => {
      if (!selectedPersona) return [];
      const selectedIds = referenceSelectionByPersona[selectedPersona.id];
      return selectedIds && selectedIds.length > 0 ? selectedIds : fallbackReferenceIds;
    },
    [fallbackReferenceIds, referenceSelectionByPersona, selectedPersona],
  );

  const selectedReferenceSelection = useMemo(
    () => selectedReferenceAssets.filter((asset) => selectedReferenceIds.includes(asset.id)),
    [selectedReferenceAssets, selectedReferenceIds],
  );

  function toggleReferenceSelection(assetId: string) {
    if (!selectedPersona) return;
    setReferenceSelectionByPersona((current) => {
      const storedIds = current[selectedPersona.id];
      const currentIds = storedIds && storedIds.length > 0 ? storedIds : fallbackReferenceIds;
      const nextIds = currentIds.includes(assetId)
        ? currentIds.filter((id) => id !== assetId)
        : [...currentIds, assetId];
      return { ...current, [selectedPersona.id]: nextIds.length > 0 ? nextIds : currentIds };
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
    if (selectedSlot !== "face" && selectedReferenceSelection.length === 0) return;

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
        const defaultReferences = selectedReferenceSelection;
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
                  <ReferenceSummary
                    useReferences={true}
                    allowPromptOnly={false}
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
              (isHybrid && hybridSources.length < 2) ||
              (selectedSlot !== "face" && selectedReferenceSelection.length === 0)
            }
          />
        </form>
      </aside>
    </div>
  );
}
