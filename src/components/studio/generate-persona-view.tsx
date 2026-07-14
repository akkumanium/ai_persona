import { ArrowLeft, ImageIcon, Loader2, Pencil, Upload, WandSparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { DEFAULT_PROMPTS, referenceSlots } from "@/components/studio/constants";
import { encodeFiles } from "@/components/studio/media";
import { useStudioTokenBalance } from "@/components/studio/token-balance-context";
import { AssetExpiryCaption } from "@/components/studio/asset-expiry-caption";
import type { FaceGenerationMode, ReferenceSlotId, SourceImageInput } from "@/components/studio/types";
import {
  CheckboxField,
  CardImage,
  ImageThumbStrip,
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
  NANO_BANANA_PRO_MODEL_ID,
  chatGptImageQualities,
  imageSizesForModel,
  requiresImageReferences,
  supportsImageQuality,
  supportsImageReferences,
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
  onEditReference,
}: {
  personas: Persona[];
  assets: Asset[];
  supabaseReady?: boolean;
  selectedPersona?: Persona;
  initialSlotId?: ReferenceSlotId;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onBack: () => void;
  onEditReference: (asset: Asset) => void;
}) {
  const initialSlot = referenceSlots.find((slot) => slot.id === (initialSlotId ?? "face")) ?? referenceSlots[0];
  const [selectedSlotId, setSelectedSlotId] = useState<ReferenceSlotId>(initialSlot.id);
  const [generationMode, setGenerationMode] = useState<FaceGenerationMode>("hybrid");
  const [scratchPrompt, setScratchPrompt] = useState("");
  const [referencePrompt, setReferencePrompt] = useState(
    initialSlot.id === "face" ? DEFAULT_PROMPTS.hybrid : initialSlot.prompt,
  );
  const [scratchSources, setScratchSources] = useState<SourceImageInput[]>([]);
  const [hybridSources, setHybridSources] = useState<SourceImageInput[]>([]);
  const [selectedModel, setSelectedModel] = useState(NANO_BANANA_PRO_MODEL_ID);
  const [aspectRatio, setAspectRatio] = useState<string>(initialSlot.aspectRatio);
  const [imageSize, setImageSize] = useState("4K");
  const [imageQuality, setImageQuality] = useState("medium");
  const [confirmsRights, setConfirmsRights] = useState(false);
  const [confirmsAdultPersona, setConfirmsAdultPersona] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState(0);
  const [uploadingInputs, setUploadingInputs] = useState<Record<string, boolean>>({});
  const [generationError, setGenerationError] = useState("");
  const { balanceTokens, tryReserveTokens, reconcileTokenBalance } = useStudioTokenBalance();
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});

  const activeSlot = referenceSlots.find((slot) => slot.id === selectedSlotId) ?? referenceSlots[0];
  const allImageModelOptions = modelsForCapability("image-prompt");
  const referenceCapableImageModelOptions = useMemo(
    () => allImageModelOptions.filter((model) => supportsImageReferences(model.id)),
    [allImageModelOptions],
  );
  const modelOptions =
    selectedSlotId === "face" && generationMode === "scratch"
      ? allImageModelOptions
      : referenceCapableImageModelOptions;
  const safeSelectedModel = modelOptions.some((model) => model.id === selectedModel)
    ? selectedModel
    : modelOptions[0]?.id ?? selectedModel;
  const imageAspectRatios = aspectRatiosForImageModel(safeSelectedModel);
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
  const imageModelSupportsSize = supportsImageSize(safeSelectedModel);
  const imageModelSupportsQuality = supportsImageQuality(safeSelectedModel);
  const imageModelSupportsReferences = supportsImageReferences(safeSelectedModel);
  const imageModelRequiresReferences = requiresImageReferences(safeSelectedModel);
  const isGenerating = activeGenerations > 0;
  const referenceInputCount = isHybridFace
    ? hybridSources.length
    : isScratchFace
      ? imageModelSupportsReferences
        ? scratchSources.length
        : 0
    : selectedSlotId === "face"
      ? 0
      : selectedReferenceSelection.length;
  const referenceCostTokens = estimateImageGenerationPricing({
      prompt: isScratchFace ? scratchPrompt : referencePrompt,
      model: safeSelectedModel,
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
    }).tokens;
  const referenceCostLabel = formatTokens(referenceCostTokens);

  function selectSlot(slotId: ReferenceSlotId) {
    const nextSlot = referenceSlots.find((slot) => slot.id === slotId) ?? referenceSlots[0];
    setSelectedSlotId(slotId);
    setAspectRatio(nextSlot.aspectRatio);
    setGenerationMode(slotId === "face" ? "hybrid" : "scratch");
    setHybridSources([]);
    setScratchSources([]);
    setScratchPrompt("");
    setReferencePrompt(slotId === "face" ? DEFAULT_PROMPTS.hybrid : nextSlot.prompt);
    setGenerationError("");
  }

  function changeModel(modelId: string) {
    setSelectedModel(modelId);
    const nextAspectRatios = aspectRatiosForImageModel(modelId);
    if (!nextAspectRatios.includes(aspectRatio)) {
      setAspectRatio(nextAspectRatios.includes(activeSlot.aspectRatio) ? activeSlot.aspectRatio : nextAspectRatios[0]);
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

  async function withUploadState(key: string, upload: () => Promise<void>) {
    setUploadingInputs((current) => ({ ...current, [key]: true }));
    setGenerationError("");
    try {
      await upload();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingInputs((current) => ({ ...current, [key]: false }));
    }
  }

  async function captureHybridSources(files: FileList | null) {
    await withUploadState("hybridSources", async () => {
      const newImages = await encodeFiles(files, "image/png", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `hybrid-sources/${selectedPersona?.id ?? "unassigned"}`,
      });
      setHybridSources((current) => [...current, ...newImages].slice(0, 8));
    });
  }

  async function captureScratchSources(files: FileList | null) {
    await withUploadState("scratchSources", async () => {
      const newImages = await encodeFiles(files, "image/png", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `scratch-sources/${selectedPersona?.id ?? "unassigned"}`,
      });
      setScratchSources((current) => [...current, ...newImages].slice(0, 8));
    });
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
    if (!isScratchFace && referencePrompt.trim().length < 10) return;
    if (isScratchFace && imageModelRequiresReferences && scratchSources.length === 0) return;
    if (isHybridFace && hybridSources.length < 2) return;
    if (selectedSlotId !== "face" && selectedReferenceSelection.length === 0) return;
    if (!tryReserveTokens(referenceCostTokens)) {
      setGenerationError(`Insufficient token balance. This generation costs ${referenceCostTokens} tokens, but your balance is ${balanceTokens}.`);
      return;
    }

    setActiveGenerations((current) => current + 1);
    setGenerationError("");
    let balanceReconciled = false;
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
            model: safeSelectedModel,
            prompt: isScratchFace ? scratchPrompt.trim() : referencePrompt.trim(),
            additionalPrompt: "",
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
              : isScratchFace && imageModelSupportsReferences
                ? scratchSources
                    .filter((image) => image.data)
                    .map((image) => ({ name: image.name, mimeType: image.mimeType, data: image.data ?? "" }))
                : [],
            sourceImageUrls: isHybridFace
              ? hybridSources.map((image) => image.url).filter((url): url is string => Boolean(url))
              : isScratchFace && imageModelSupportsReferences
                ? scratchSources.map((image) => image.url).filter((url): url is string => Boolean(url))
                : [],
            confirmsRights,
            confirmsAdultPersona,
          }),
        });
        const payload = await response.json();
        if (typeof payload.balanceTokens === "number") {
          reconcileTokenBalance(payload.balanceTokens);
          balanceReconciled = true;
        }
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
            model: safeSelectedModel,
            prompt: referencePrompt.trim(),
            additionalPrompt: "",
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
        if (typeof payload.balanceTokens === "number") {
          reconcileTokenBalance(payload.balanceTokens);
          balanceReconciled = true;
        }
        if (!response.ok) throw new Error(payload.error ?? "Reference generation failed.");
        onAssetsCreated(payload.assets, payload.job);
      }

      setHybridSources([]);
      setScratchSources([]);
      setConfirmsRights(false);
      setConfirmsAdultPersona(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Reference generation failed.");
    } finally {
      if (!balanceReconciled) reconcileTokenBalance();
      setActiveGenerations((current) => Math.max(0, current - 1));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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

        <div className="mt-4 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-800/20 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              <Loader2 className="size-4 animate-spin" />
              {activeGenerations} reference generation{activeGenerations === 1 ? "" : "s"} running.
            </div>
          ) : null}
          {slotAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {slotAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="group overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="relative aspect-[4/5] bg-stone-100">
                    <CardImage src={asset.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onEditReference(asset)}
                      className="absolute left-2 top-2 flex h-8 items-center gap-1.5 rounded-md bg-black/55 px-2 text-xs font-semibold text-white opacity-0 transition hover:bg-emerald-800 group-hover:opacity-100"
                      aria-label="Edit this reference in Images"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="mt-1 text-xs text-stone-500">{asset.isDefaultReference ? "Default" : asset.model}</p>
                    <AssetExpiryCaption asset={asset} className="mt-1" />
                  </div>
                </article>
              ))}
            </div>
          ) : !isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <ImageIcon className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">No {activeSlot.label.toLowerCase()} reference yet</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                Generated references will appear here for review and reuse.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
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
                setReferencePrompt(value === "hybrid" ? DEFAULT_PROMPTS.hybrid : activeSlot.prompt);
                setGenerationError("");
              }}
            />
          ) : null}

          <ModelSelect label="Model" value={safeSelectedModel} options={modelOptions} onChange={changeModel} />
          <SelectField label="Aspect ratio" value={safeAspectRatio} options={imageAspectRatios} onChange={setAspectRatio} />
          {imageModelSupportsSize ? (
            <SelectField label="Resolution" value={imageSize} options={imageSizesForModel(safeSelectedModel)} onChange={setImageSize} />
          ) : null}
          {imageModelSupportsQuality ? (
            <SelectField label="Quality" value={imageQuality} options={chatGptImageQualities} onChange={setImageQuality} />
          ) : null}

          {isHybridFace ? (
            <>
              <UploadBox
                accept="image/*"
                multiple
                compact
                icon={Upload}
                label={hybridSources.length ? "Add more faces" : "Upload face images"}
                detail={hybridSources.length ? `${hybridSources.length} face image${hybridSources.length === 1 ? "" : "s"} ready (min 2)` : "Add 2 or more faces to blend"}
                loading={Boolean(uploadingInputs.hybridSources)}
                onChange={(files) => void captureHybridSources(files)}
              />
              <ImageThumbStrip images={hybridSources} onRemove={removeHybridSource} />
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
              {imageModelSupportsReferences ? (
                <UploadBox
                  accept="image/*"
                  multiple
                  compact
                  icon={Upload}
                  label="Upload optional source images"
                  detail={
                    scratchSources.length
                      ? `${scratchSources.length} image${scratchSources.length === 1 ? "" : "s"} ready`
                      : "Use your own PC images as optional identity or style inputs."
                  }
                  loading={Boolean(uploadingInputs.scratchSources)}
                  onChange={(files) => void captureScratchSources(files)}
                />
              ) : null}
              <ImageThumbStrip images={scratchSources} onRemove={removeScratchSource} />
              <TextArea label="Prompt" value={scratchPrompt} onChange={setScratchPrompt} rows={6} />
            </>
          ) : (
            <TextArea label="Prompt" value={referencePrompt} onChange={setReferencePrompt} rows={6} />
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
            disableWhileLoading={false}
            disabled={
              !selectedPersona ||
              !confirmsRights ||
              !confirmsAdultPersona ||
              (isScratchFace && scratchPrompt.trim().length < 10) ||
              (!isScratchFace && referencePrompt.trim().length < 10) ||
              (isScratchFace && imageModelRequiresReferences && scratchSources.length === 0) ||
              (isHybridFace && hybridSources.length < 2) ||
              (selectedSlotId !== "face" && selectedReferenceSelection.length === 0)
            }
          />
        </form>
      </aside>
    </div>
  );
}
