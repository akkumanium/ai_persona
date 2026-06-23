/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, ImageIcon, Loader2, Upload, WandSparkles, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { referenceSlots } from "@/components/studio/constants";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { FaceGenerationMode, ReferenceSlotId, SourceImageInput } from "@/components/studio/types";
import {
  CheckboxField,
  ModelSelect,
  ModeToggle,
  PanelTitle,
  PersonaSelect,
  ReferencePicker,
  ReferenceSummary,
  SelectField,
  SubmitButton,
  TextArea,
  UploadBox,
} from "@/components/studio/ui";
import {
  aspectRatiosForImageModel,
  CHATGPT_IMAGE_MODEL_ID,
  NANO_BANANA_PRO_MODEL_ID,
  chatGptImageQualities,
  imageSizesForModel,
  supportsImageQuality,
  supportsImageSize,
} from "@/lib/image-model-options";
import { modelsForCapability } from "@/lib/model-registry";
import { estimateImageGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatTokens } from "@/lib/utils";

export function GeneratePersonaView({
  personas,
  assets,
  supabaseReady,
  selectedPersona,
  initialSlotId,
  onAssetsCreated,
  onSelectPersona,
  onBack,
}: {
  personas: Persona[];
  assets: Asset[];
  supabaseReady?: boolean;
  selectedPersona?: Persona;
  initialSlotId?: ReferenceSlotId;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onBack: () => void;
}) {
  const initialSlot = referenceSlots.find((slot) => slot.id === (initialSlotId ?? "face")) ?? referenceSlots[0];
  const [selectedSlotId, setSelectedSlotId] = useState<ReferenceSlotId>(initialSlot.id);
  const [generationMode, setGenerationMode] = useState<FaceGenerationMode>("hybrid");
  const [scratchPrompt, setScratchPrompt] = useState("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [scratchSources, setScratchSources] = useState<SourceImageInput[]>([]);
  const [hybridSources, setHybridSources] = useState<SourceImageInput[]>([]);
  const [selectedModel, setSelectedModel] = useState(NANO_BANANA_PRO_MODEL_ID);
  const [aspectRatio, setAspectRatio] = useState<string>(initialSlot.aspectRatio);
  const [imageSize, setImageSize] = useState("4K");
  const [imageQuality, setImageQuality] = useState("medium");
  const [confirmsRights, setConfirmsRights] = useState(false);
  const [confirmsAdultPersona, setConfirmsAdultPersona] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});

  const activeSlot = referenceSlots.find((slot) => slot.id === selectedSlotId) ?? referenceSlots[0];
  const avatarModelOptions = modelsForCapability("avatar");
  const imageModelOptions = modelsForCapability("image-reference");
  const modelOptions = selectedSlotId === "face" ? avatarModelOptions : imageModelOptions;
  const imageAspectRatios = aspectRatiosForImageModel(selectedModel);
  const safeAspectRatio = imageAspectRatios.includes(aspectRatio) ? aspectRatio : imageAspectRatios[0];
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
  const slotAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (asset.personaId !== selectedPersona?.id || (asset.kind !== "avatar" && asset.kind !== "upload")) {
          return false;
        }
        return selectedSlotId === "face"
          ? asset.referenceSlot === "face" || !asset.referenceSlot
          : asset.referenceSlot === selectedSlotId;
      }),
    [assets, selectedPersona?.id, selectedSlotId],
  );
  const isScratchFace = selectedSlotId === "face" && generationMode === "scratch";
  const isHybridFace = selectedSlotId === "face" && generationMode === "hybrid";
  const imageModelSupportsSize = supportsImageSize(selectedModel);
  const imageModelSupportsQuality = supportsImageQuality(selectedModel);
  const referenceInputCount = isHybridFace
    ? hybridSources.length
    : isScratchFace
      ? scratchSources.length
    : selectedSlotId === "face"
      ? 0
      : selectedReferenceSelection.length;
  const referenceCostLabel = formatTokens(
    estimateImageGenerationPricing({
      prompt: isScratchFace ? scratchPrompt : additionalPrompt || activeSlot.prompt,
      model: selectedModel,
      aspectRatio: safeAspectRatio,
      imageSize: imageModelSupportsSize ? imageSize : "2K",
      imageQuality: imageModelSupportsQuality ? (imageQuality as "low" | "medium" | "high") : undefined,
      count: 1,
      referenceImages: Array.from({ length: referenceInputCount }, (_, index) => ({
        name: `reference-${index + 1}`,
        mimeType: "image/png",
        data: "x",
      })),
      generationType: isHybridFace
        ? "avatar_image_blend"
        : selectedSlotId === "face"
          ? "avatar_prompt"
          : "image_from_reference",
    }).tokens,
  );

  function selectSlot(slotId: ReferenceSlotId) {
    const nextSlot = referenceSlots.find((slot) => slot.id === slotId) ?? referenceSlots[0];
    setSelectedSlotId(slotId);
    setAspectRatio(nextSlot.aspectRatio);
    setGenerationMode(slotId === "face" ? "hybrid" : "scratch");
    setHybridSources([]);
    setScratchSources([]);
    setScratchPrompt("");
    setAdditionalPrompt("");
    setGenerationError("");
  }

  function changeModel(modelId: string) {
    setSelectedModel(modelId);
    const nextAspectRatios = aspectRatiosForImageModel(modelId);
    if (!nextAspectRatios.includes(aspectRatio)) {
      setAspectRatio(nextAspectRatios.includes(activeSlot.aspectRatio) ? activeSlot.aspectRatio : nextAspectRatios[0]);
    }
    if (modelId === CHATGPT_IMAGE_MODEL_ID && imageSize !== "2K") {
      setImageSize("2K");
    }
    const nextImageSizes = imageSizesForModel(modelId);
    if (!nextImageSizes.includes(imageSize)) {
      setImageSize(nextImageSizes[0]);
    }
  }

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
    const newImages = await encodeFiles(files, "image/png", {
      enabled: supabaseReady,
      bucket: "uploads",
      folder: `hybrid-sources/${selectedPersona?.id ?? "unassigned"}`,
    });
    setHybridSources((current) => [...current, ...newImages].slice(0, 2));
  }

  async function captureScratchSources(files: FileList | null) {
    const newImages = await encodeFiles(files, "image/png", {
      enabled: supabaseReady,
      bucket: "uploads",
      folder: `scratch-sources/${selectedPersona?.id ?? "unassigned"}`,
    });
    setScratchSources((current) => [...current, ...newImages].slice(0, 4));
  }

  function removeHybridSource(index: number) {
    setHybridSources((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function removeScratchSource(index: number) {
    setScratchSources((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function generateReference(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona) return;
    if (!confirmsRights || !confirmsAdultPersona) return;
    if (isScratchFace && scratchPrompt.trim().length < 10) return;
    if (isHybridFace && hybridSources.length < 2) return;
    if (selectedSlotId !== "face" && selectedReferenceSelection.length === 0) return;

    setIsGenerating(true);
    setGenerationError("");
    try {
      const hasDefault = selectedReferenceAssets.some((asset) => asset.isDefaultReference);
      const titlePrefix = `${activeSlot.label} reference ${slotAssets.length + 1}`;

      if (selectedSlotId === "face") {
        const response = await fetch("/api/generate/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: selectedPersona.id,
            mode: generationMode === "hybrid" ? "blend" : "prompt",
            personaName: selectedPersona.name,
            description: selectedPersona.description,
            styleNotes: selectedPersona.styleNotes,
            model: selectedModel,
            prompt: isScratchFace ? scratchPrompt.trim() : undefined,
            additionalPrompt: isScratchFace ? "" : additionalPrompt.trim(),
            aspectRatio: safeAspectRatio,
            imageSize: imageModelSupportsSize ? imageSize : "2K",
            imageQuality: imageModelSupportsQuality ? imageQuality : undefined,
            count: 1,
            referenceSlot: activeSlot.id,
            isDefaultReference: !hasDefault,
            titlePrefix,
            sourceImages: isHybridFace
              ? hybridSources
                  .filter((image) => image.data)
                  .map((image) => ({ name: image.name, mimeType: image.mimeType, data: image.data ?? "" }))
              : isScratchFace
                ? scratchSources
                    .filter((image) => image.data)
                    .map((image) => ({ name: image.name, mimeType: image.mimeType, data: image.data ?? "" }))
                : [],
            sourceImageUrls: isHybridFace
              ? hybridSources.map((image) => image.url).filter((url): url is string => Boolean(url))
              : isScratchFace
                ? scratchSources.map((image) => image.url).filter((url): url is string => Boolean(url))
                : [],
            confirmsRights,
            confirmsAdultPersona,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        onAssetsCreated(payload.assets, payload.job);
      } else {
        const referenceAssetIds = selectedReferenceSelection.map((asset) => asset.id);
        const response = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: selectedPersona.id,
            personaName: selectedPersona.name,
            model: selectedModel,
            additionalPrompt: additionalPrompt.trim(),
            styleNotes: selectedPersona.styleNotes,
            aspectRatio: safeAspectRatio,
            imageSize: imageModelSupportsSize ? imageSize : "2K",
            imageQuality: imageModelSupportsQuality ? imageQuality : undefined,
            count: 1,
            assetKind: "avatar",
            referenceSlot: activeSlot.id,
            referenceAssetIds,
            isDefaultReference: !hasDefault,
            titlePrefix,
            referenceImageUrls: selectedReferenceSelection.map((asset) => asset.url),
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        onAssetsCreated(payload.assets, payload.job);
      }

      setHybridSources([]);
      setScratchSources([]);
      setAdditionalPrompt("");
      setConfirmsRights(false);
      setConfirmsAdultPersona(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Reference generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
            >
              <ArrowLeft size={16} />
              Personas
            </button>
            <PanelTitle icon={WandSparkles} title={`${activeSlot.label} Reference`} />
          </div>
        </div>

        <div className="mt-5 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-sm text-stone-600">
              <Loader2 className="mb-3 animate-spin text-emerald-800" size={28} />
              Creating the reference.
            </div>
          ) : slotAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {slotAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="aspect-[4/5] bg-stone-100">
                    <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                    <p className="mt-1 text-xs text-stone-500">{asset.isDefaultReference ? "Default" : asset.model}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <ImageIcon className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">No {activeSlot.label.toLowerCase()} reference yet</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                Generated references will appear here for review and reuse.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        <form onSubmit={generateReference}>
          <PanelTitle icon={WandSparkles} title="Reference Options" />
          <PersonaSelect personas={personas} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />

          <div className="mt-4">
            <p className="text-sm font-medium text-stone-700">Reference type</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {referenceSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => selectSlot(slot.id)}
                  className={cn(
                    "h-10 rounded-md border px-3 text-sm font-medium transition",
                    selectedSlotId === slot.id
                      ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                      : "border-stone-200 text-stone-600 hover:border-emerald-800 hover:text-stone-950",
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {selectedSlotId === "face" ? (
            <ModeToggle
              label="Face mode"
              value={generationMode}
              options={[
                { value: "hybrid", label: "Hybrid mode" },
                { value: "scratch", label: "Generate" },
              ]}
              onChange={(value) => {
                setGenerationMode(value as FaceGenerationMode);
                setHybridSources([]);
                setScratchSources([]);
                setGenerationError("");
              }}
            />
          ) : null}

          <ModelSelect label="Model" value={selectedModel} options={modelOptions} onChange={changeModel} />
          <SelectField label="Aspect ratio" value={safeAspectRatio} options={imageAspectRatios} onChange={setAspectRatio} />
          {imageModelSupportsSize ? (
            <SelectField label="Image size" value={imageSize} options={imageSizesForModel(selectedModel)} onChange={setImageSize} />
          ) : null}
          {imageModelSupportsQuality ? (
            <SelectField label="Quality" value={imageQuality} options={chatGptImageQualities} onChange={setImageQuality} />
          ) : null}

          {isHybridFace ? (
            <>
              <UploadBox
                accept="image/*"
                icon={Upload}
                label={hybridSources.length < 2 ? `Upload face ${hybridSources.length + 1} of 2` : "Both faces uploaded"}
                detail={hybridSources.length ? `${hybridSources.length} face image${hybridSources.length === 1 ? "" : "s"} ready` : undefined}
                onChange={(files) => void captureHybridSources(files)}
              />
              {hybridSources.length ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {hybridSources.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                      <img src={sourceImageToDataUrl(image)} alt={`Face source ${index + 1}`} className="aspect-square w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeHybridSource(index)}
                        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-white/90 text-stone-700 shadow-sm transition hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {selectedSlotId !== "face" ? (
            <>
              <ReferenceSummary
                useReferences
                allowPromptOnly={false}
                selectedCount={selectedReferenceSelection.length}
                totalCount={selectedReferenceAssets.length}
              />
              <ReferencePicker
                references={selectedReferenceAssets}
                selectedIds={selectedReferenceIds}
                onToggle={toggleReferenceSelection}
              />
            </>
          ) : null}

          {isScratchFace ? (
            <>
              <UploadBox
                accept="image/*"
                multiple
                icon={Upload}
                label="Upload optional source images"
                detail={
                  scratchSources.length
                    ? `${scratchSources.length} image${scratchSources.length === 1 ? "" : "s"} ready`
                    : "Use your own PC images as optional identity or style inputs."
                }
                onChange={(files) => void captureScratchSources(files)}
              />
              {scratchSources.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {scratchSources.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-md border border-stone-200 bg-stone-100">
                      <img src={sourceImageToDataUrl(image)} alt={image.name ?? `Source ${index + 1}`} className="aspect-square w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeScratchSource(index)}
                        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-md bg-white/90 text-stone-700 shadow-sm transition hover:text-red-700"
                        aria-label="Remove source image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <TextArea label="Prompt" value={scratchPrompt} onChange={setScratchPrompt} rows={6} />
            </>
          ) : (
            <TextArea label="Additional prompt" value={additionalPrompt} onChange={setAdditionalPrompt} rows={4} />
          )}

          <CheckboxField
            label="I have rights to use the provided identity references."
            checked={confirmsRights}
            onChange={setConfirmsRights}
          />
          <CheckboxField
            label="This is an adult persona."
            checked={confirmsAdultPersona}
            onChange={setConfirmsAdultPersona}
          />

          {generationError ? (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{generationError}</p>
          ) : null}

          <SubmitButton
            loading={isGenerating}
            icon={WandSparkles}
            label="Generate reference"
            costLabel={referenceCostLabel}
            disabled={
              !selectedPersona ||
              !confirmsRights ||
              !confirmsAdultPersona ||
              (isScratchFace && scratchPrompt.trim().length < 10) ||
              (isHybridFace && hybridSources.length < 2) ||
              (selectedSlotId !== "face" && selectedReferenceSelection.length === 0)
            }
          />
        </form>
      </aside>
    </div>
  );
}
