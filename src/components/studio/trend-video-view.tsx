/* eslint-disable @next/next/no-img-element */

import {
  ArrowDown,
  ArrowLeft,
  Check,
  Clapperboard,
  Film,
  ImageIcon,
  Loader2,
  Play,
  Settings2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { encodeFiles, sourceImageToDataUrl, uploadSourceImage } from "@/components/studio/media";
import { AssetExpiryCaption } from "@/components/studio/asset-expiry-caption";
import { useStudioTokenBalance } from "@/components/studio/token-balance-context";
import type { SourceImageInput, SourceVideoInput } from "@/components/studio/types";
import {
  CardImage,
  DeferredVideo,
  ModelSelect,
  MediaLightbox,
  NumberField,
  PanelTitle,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/studio/ui";
import {
  aspectRatiosForImageModel,
  chatGptImageQualities,
  imageSizesForModel,
  NANO_BANANA_PRO_MODEL_ID,
  supportsImageQuality,
  supportsImageReferences,
  supportsImageSize,
} from "@/lib/image-model-options";
import {
  defaultModelForCapability,
  modelsForCapability,
  motionControlsForModel,
  providerModeForVideoModel,
} from "@/lib/model-registry";
import { estimateImageGenerationPricing, estimateVideoGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatTokens } from "@/lib/utils";

type ImportState = "capturing" | "ready";
type ImportedVideo = SourceVideoInput & {
  durationSeconds?: number;
};

export type LibraryItem = {
  id: string;
  video: ImportedVideo;
  firstFrame?: SourceImageInput;
  firstFramePreview?: string;
  importState: ImportState;
  candidates: Asset[];
  selectedCandidateId: string;
  finalVideo?: Asset;
  createdAt: string;
  expiresAt?: string;
  isGeneratingFaces?: boolean;
  isGeneratingVideo?: boolean;
};

const motionResolutions = ["480p", "720p"] as const;
const DEFAULT_MOTION_MODEL = defaultModelForCapability("video-motion") ?? "kling-v3-0-motion-std";
const TREND_SOURCE_MODEL = "local-trend-upload";

export function trendLibraryItemsFromAssets(assets: Asset[]): LibraryItem[] {
  const trendSources = assets
    .filter(
      (asset) =>
        asset.kind === "video" &&
        asset.generationType === "reference_upload" &&
        asset.model === TREND_SOURCE_MODEL,
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return trendSources.map((asset) => {
    const candidates = assets
        .filter(
          (candidate) =>
            candidate.kind === "image" &&
            candidate.generationType === "image_from_reference" &&
            Boolean(candidate.referenceAssetIds?.includes(asset.id)),
        )
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const finalVideo = assets
        .filter((candidate) => {
          if (candidate.kind !== "video" || candidate.generationType !== "video_motion") return false;
          const referenceIds = candidate.referenceAssetIds ?? [];
          return referenceIds.includes(asset.id) || candidates.some((face) => referenceIds.includes(face.id));
        })
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
    const finalCandidateId =
      finalVideo?.referenceAssetIds?.find((id) => candidates.some((candidate) => candidate.id === id)) ?? "";

    return {
      id: asset.id,
      video: {
        name: asset.title,
        mimeType: asset.mimeType,
        url: asset.url,
        storageBucket: asset.storageBucket,
        storagePath: asset.storagePath,
      },
      importState: "capturing",
      candidates,
      selectedCandidateId: finalCandidateId || candidates[0]?.id || "",
      finalVideo,
      createdAt: asset.createdAt,
      expiresAt: asset.expiresAt,
    };
  });
}

export function TrendVideoView({
  personas,
  assets,
  selectedPersona,
  supabaseReady,
  jobs,
  onAssetsCreated,
  onSelectPersona,
  library,
  onLibraryChange,
  onSourceAssetsCreated,
  onRemoveSource,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  supabaseReady?: boolean;
  jobs: GenerationJob[];
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  library: LibraryItem[];
  onLibraryChange: Dispatch<SetStateAction<LibraryItem[]>>;
  onSourceAssetsCreated: (assets: Asset[]) => void;
  onRemoveSource: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const capturingIds = useRef(new Set<string>());

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");
  const { balanceTokens, tryReserveTokens, reconcileTokenBalance } = useStudioTokenBalance();
  const [previewMedia, setPreviewMedia] = useState<{ src: string; title: string; kind?: "image" | "video" } | undefined>();

  const [imageModel, setImageModel] = useState(NANO_BANANA_PRO_MODEL_ID);
  const [imageAspectRatio, setImageAspectRatio] = useState("9:16");
  const [imageSize, setImageSize] = useState("2K");
  const [imageQuality, setImageQuality] = useState("medium");
  const [candidateCount, setCandidateCount] = useState(2);
  const [facePrompt, setFacePrompt] = useState(
  `Replace the woman in the first reference image with the woman from the second reference image. The second image is the strict identity reference — preserve her exact face, body shape, proportions, silhouette, and anatomy with maximum fidelity. Do not alter, stretch, resize, or reshape any body part.
Use the exact outfit, clothing fit, styling, and details from the first reference image.
Crucially important: Transfer the woman into the pose of the first reference image with absolute precision. Match the pose 100% exactly — every limb angle, joint position, hand placement, finger position, torso tilt, shoulder position, head angle, and body orientation must be copied perfectly from the first image. Do not change the pose in any way. Strongest possible pose adherence is required. The pose from reference photo 1 must remain completely unchanged.
The first image defines the entire scene: keep the exact same background, environment, camera angle, framing, perspective, depth of field, and composition without any deviation.
Match the lighting from the first image with perfect accuracy: same light direction, intensity, shadows, highlights, reflections, and color grading.
Replicate the image quality of the first photo exactly: same resolution, sharpness, skin texture detail, noise level, lens characteristics, and photorealism. Do not enhance or degrade the quality.
Ensure seamless integration with correct perspective, depth, and contact with the environment. Photorealistic result, natural skin, no stylization, no artistic interpretation, no body reshaping.
Delete the tattoos. No text, no logos, no watermarks.`);
  const [motionModel, setMotionModel] = useState(DEFAULT_MOTION_MODEL);
  const [motionPrompt, setMotionPrompt] = useState(
    "",
  );
  const [motionReference, setMotionReference] = useState("");
  const [motionMode, setMotionMode] = useState<"animate" | "replace">("animate");
  const [motionCharacterOrientation, setMotionCharacterOrientation] = useState<"image" | "video">("video");
  const [motionResolution, setMotionResolution] = useState<(typeof motionResolutions)[number]>("720p");
  const [motionNegativePrompt, setMotionNegativePrompt] = useState("");
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);

  const personaReferences = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.personaId === selectedPersona?.id && (asset.kind === "avatar" || asset.kind === "upload"),
      ),
    [assets, selectedPersona?.id],
  );
  const imageModelOptions = modelsForCapability("image-reference");
  const motionModelOptions = modelsForCapability("video-motion");
  const motionControls = motionControlsForModel(motionModel);
  const imageAspectRatioOptions = aspectRatiosForImageModel(imageModel);
  const safeImageAspectRatio = imageAspectRatioOptions.includes(imageAspectRatio)
    ? imageAspectRatio
    : imageAspectRatioOptions[0];
  const imageModelSupportsSize = supportsImageSize(imageModel);
  const imageModelSupportsQuality = supportsImageQuality(imageModel);

  const editingItem = library.find((item) => item.id === editingId);
  const selectedCandidate = editingItem
    ? editingItem.candidates.find((asset) => asset.id === editingItem.selectedCandidateId)
    : undefined;
  const activeJobsForEditingItem = editingItem
    ? jobs.filter(
        (job) =>
          (job.status === "queued" || job.status === "running") &&
          job.referenceAssetIds?.includes(editingItem.id),
      )
    : [];
  const isPersistentlyGeneratingFaces = activeJobsForEditingItem.some(
    (job) => job.generationType === "image_from_reference" || job.generationType === "image_from_prompt",
  );
  const isPersistentlyGeneratingVideo = activeJobsForEditingItem.some(
    (job) => job.generationType === "video_motion",
  );
  const safeCandidateCount = Math.min(4, Math.max(1, Math.round(candidateCount)));
  const detectedDuration = editingItem?.video.durationSeconds ? Math.round(editingItem.video.durationSeconds) : 5;
  const safeMotionDuration = Math.min(15, Math.max(3, detectedDuration));

  const faceCostTokens = estimateImageGenerationPricing({
      prompt: facePrompt,
      model: imageModel,
      aspectRatio: safeImageAspectRatio,
      imageSize: imageModelSupportsSize ? imageSize : "2K",
      imageQuality: imageModelSupportsQuality ? (imageQuality as "low" | "medium" | "high") : undefined,
      count: safeCandidateCount,
      referenceImages: [
        ...personaReferences.map((asset) => ({ name: asset.title, mimeType: asset.mimeType, data: "x" })),
        ...(editingItem?.firstFrame
          ? [{ name: editingItem.firstFrame.name, mimeType: editingItem.firstFrame.mimeType, data: "x" }]
          : []),
      ],
      generationType: "image_from_reference",
    }).tokens;
  const faceCostLabel = formatTokens(faceCostTokens);
  const motionCostTokens = estimateVideoGenerationPricing({
      prompt: motionPrompt,
      model: motionModel,
      mode: "motion",
      durationSeconds: safeMotionDuration,
      aspectRatio: "9:16",
      resolution: motionResolution,
      motionReference: motionControls.supportsMotionReference ? motionReference : "",
      motionMode: motionControls.supportsMotionMode ? motionMode : "animate",
      characterOrientation: motionControls.supportsCharacterOrientation ? motionCharacterOrientation : "video",
      keepOriginalSound: motionControls.supportsKeepOriginalSound ? keepOriginalSound : false,
      negativePrompt: motionControls.supportsNegativePrompt ? motionNegativePrompt : "",
    }).tokens;
  const motionCostLabel = formatTokens(motionCostTokens);

  const updateLibraryItem = useCallback((id: string, updates: Partial<LibraryItem>) => {
    onLibraryChange((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, [onLibraryChange]);

  useEffect(() => {
    library
      .filter((item) => item.importState === "capturing" && !capturingIds.current.has(item.id))
      .forEach((item) => {
        capturingIds.current.add(item.id);
        void (async () => {
          try {
            const videoUrl = sourceVideoToUrl(item.video);
            const captured = await captureFirstFrame(videoUrl, item.video.name);
            updateLibraryItem(item.id, {
              video: { ...item.video, durationSeconds: captured.durationSeconds },
              firstFrame: captured.image,
              firstFramePreview: sourceImageToDataUrl(captured.image),
              importState: "ready",
            });
          } catch (captureError) {
            updateLibraryItem(item.id, { importState: "ready" });
            setError(captureError instanceof Error ? captureError.message : "Could not capture the first frame.");
          } finally {
            capturingIds.current.delete(item.id);
          }
        })();
      });
  }, [library, updateLibraryItem]);

  function changeImageModel(modelId: string) {
    setImageModel(modelId);
    const ratios = aspectRatiosForImageModel(modelId);
    if (!ratios.includes(imageAspectRatio)) {
      setImageAspectRatio(ratios.includes("9:16") ? "9:16" : ratios[0]);
    }
    const sizes = imageSizesForModel(modelId);
    if (!sizes.includes(imageSize)) {
      setImageSize(sizes[0]);
    }
  }

  function addImportedVideo(video: ImportedVideo, id = crypto.randomUUID(), createdAt = new Date().toISOString(), expiresAt?: string) {
    onLibraryChange((current) => [
      {
        id,
        video,
        importState: "capturing",
        candidates: [],
        selectedCandidateId: "",
        createdAt,
        expiresAt,
      },
      ...current,
    ]);
  }

  async function importFromFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError("");
    setIsUploading(true);
    try {
      const encoded = await encodeFiles(files, "video/mp4", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `trend-videos/${selectedPersona?.id ?? "unassigned"}`,
      });
      const createdAt = new Date().toISOString();
      const sourceAssets: Asset[] = encoded.map((video) => ({
        id: crypto.randomUUID(),
        kind: "video",
        title: video.name,
        url: sourceVideoToUrl(video),
        storageBucket: video.storageBucket,
        storagePath: video.storagePath,
        prompt: "Uploaded trend source video.",
        personaId: selectedPersona?.id,
        generationType: "reference_upload",
        provider: "demo",
        model: TREND_SOURCE_MODEL,
        mimeType: video.mimeType,
        createdAt,
      }));
      onSourceAssetsCreated(sourceAssets);
      encoded.forEach((video, index) => {
        const sourceAsset = sourceAssets[index];
        addImportedVideo({
          name: video.name,
          mimeType: video.mimeType,
          data: video.data,
          url: video.url,
          storageBucket: video.storageBucket,
          storagePath: video.storagePath,
        }, sourceAsset?.id, sourceAsset?.createdAt, sourceAsset?.expiresAt);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));
    if (!videoFiles.length) {
      setError("Only video files are supported.");
      return;
    }
    const dataTransfer = new DataTransfer();
    videoFiles.forEach((file) => dataTransfer.items.add(file));
    await importFromFiles(dataTransfer.files);
  }

  function openEditor(item: LibraryItem) {
    setEditingId(item.id);
    setError("");
  }

  function closeEditor() {
    setEditingId(undefined);
    setError("");
  }

  function removeLibraryItem(id: string) {
    onRemoveSource(id);
    if (editingId === id) setEditingId(undefined);
  }

  function selectCandidate(assetId: string) {
    if (!editingItem) return;
    updateLibraryItem(editingItem.id, {
      selectedCandidateId: editingItem.selectedCandidateId === assetId ? "" : assetId,
    });
  }

  async function generateFaceCandidates(event: FormEvent) {
    event.preventDefault();
    const item = editingItem;
    if (!item || !item.firstFrame || !selectedPersona || !personaReferences.length || !supportsImageReferences(imageModel)) return;
    if (!tryReserveTokens(faceCostTokens)) {
      setError(`Insufficient token balance. This generation costs ${faceCostTokens} tokens, but your balance is ${balanceTokens}.`);
      return;
    }
    updateLibraryItem(item.id, { isGeneratingFaces: true });
    setError("");
    let balanceReconciled = false;
    try {
      const uploadedFrame = await uploadSourceImage(item.firstFrame, {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `trend-frames/${selectedPersona.id}`,
      });
      const response = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
          prompt: facePrompt,
          model: imageModel,
          styleNotes: selectedPersona.styleNotes,
          aspectRatio: safeImageAspectRatio,
          imageSize: imageModelSupportsSize ? imageSize : "2K",
          imageQuality: imageModelSupportsQuality ? imageQuality : undefined,
          count: safeCandidateCount,
          // WaveSpeed preserves the order of this array. The prompt treats the
          // target frame as image 1 and persona references as images 2+, so keep
          // the frame first when it was uploaded as a URL. A base64 fallback is
          // sent through sourceImages below, which the API also places first.
          referenceImageUrls: uploadedFrame.url
            ? [uploadedFrame.url, ...personaReferences.map((asset) => asset.url)]
            : personaReferences.map((asset) => asset.url),
          sourceImageUrls: [],
          sourceImages: uploadedFrame.data
            ? [{ name: uploadedFrame.name, mimeType: uploadedFrame.mimeType, data: uploadedFrame.data }]
            : [],
          referenceAssetIds: [item.id, ...personaReferences.map((asset) => asset.id)],
          titlePrefix: "Trend face",
        }),
      });
      const payload = await response.json();
      if (typeof payload.balanceTokens === "number") {
        reconcileTokenBalance(payload.balanceTokens);
        balanceReconciled = true;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Face frame generation failed.");
      }
      const nextAssets = (payload.assets as Asset[]).map((asset) => ({
        ...asset,
        referenceAssetIds: [item.id, ...personaReferences.map((reference) => reference.id)],
      }));
      onLibraryChange((current) => current.map((currentItem) => {
        if (currentItem.id !== item.id) return currentItem;
        return {
          ...currentItem,
          candidates: [
            ...nextAssets,
            ...currentItem.candidates.filter((candidate) => !nextAssets.some((asset) => asset.id === candidate.id)),
          ],
          selectedCandidateId: currentItem.selectedCandidateId || nextAssets[0]?.id || "",
          isGeneratingFaces: false,
        };
      }));
      onAssetsCreated(nextAssets, payload.job);
    } catch (generationError) {
      updateLibraryItem(item.id, { isGeneratingFaces: false });
      setError(generationError instanceof Error ? generationError.message : "Face frame generation failed.");
    } finally {
      if (!balanceReconciled) reconcileTokenBalance();
    }
  }

  async function generateTrendVideo(event: FormEvent) {
    event.preventDefault();
    const item = editingItem;
    if (!item || !selectedPersona || !selectedCandidate) return;
    if (!tryReserveTokens(motionCostTokens)) {
      setError(`Insufficient token balance. This generation costs ${motionCostTokens} tokens, but your balance is ${balanceTokens}.`);
      return;
    }
    updateLibraryItem(item.id, { isGeneratingVideo: true });
    setError("");
    let balanceReconciled = false;
    try {
      const candidateInput = await assetToProviderImageInput(selectedCandidate);
      const response = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
          prompt: motionPrompt,
          mode: "motion",
          model: motionModel,
          durationSeconds: safeMotionDuration,
          aspectRatio: "9:16",
          negativePrompt: motionControls.supportsNegativePrompt ? motionNegativePrompt : "",
          providerMode: providerModeForVideoModel(motionModel, "std"),
          cfgScale: 0.5,
          generateAudio: false,
          resolution: motionResolution,
          returnLastFrame: false,
          motionReference: motionControls.supportsMotionReference ? motionReference : "",
          motionMode: motionControls.supportsMotionMode ? motionMode : "animate",
          characterOrientation: motionControls.supportsCharacterOrientation ? motionCharacterOrientation : "video",
          keepOriginalSound: motionControls.supportsKeepOriginalSound ? keepOriginalSound : false,
          referenceAssetIds: [item.id, selectedCandidate.id],
          startFrameImage: candidateInput,
          motionReferenceVideoUrl: item.video.url,
          motionReferenceVideo: item.video.data
            ? { name: item.video.name, mimeType: item.video.mimeType, data: item.video.data }
            : undefined,
        }),
      });
      const payload = await response.json();
      if (typeof payload.balanceTokens === "number") {
        reconcileTokenBalance(payload.balanceTokens);
        balanceReconciled = true;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Trend video generation failed.");
      }
      const nextAssets = payload.asset ? [{ ...payload.asset, referenceAssetIds: [item.id, selectedCandidate.id] }] : [];
      updateLibraryItem(item.id, { finalVideo: nextAssets[0], isGeneratingVideo: false });
      onAssetsCreated(nextAssets, { ...payload.job, referenceAssetIds: [item.id, selectedCandidate.id] });
    } catch (generationError) {
      updateLibraryItem(item.id, { isGeneratingVideo: false });
      setError(generationError instanceof Error ? generationError.message : "Trend video generation failed.");
    } finally {
      if (!balanceReconciled) reconcileTokenBalance();
    }
  }

  if (editingItem) {
    return (
      <>
        {previewMedia ? (
          <MediaLightbox
            src={previewMedia.src}
            title={previewMedia.title}
            kind={previewMedia.kind}
            onClose={() => setPreviewMedia(undefined)}
          />
        ) : null}
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={closeEditor}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
          >
            <ArrowLeft size={16} />
            Library
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-stone-950" title={editingItem.video.name}>
              {editingItem.video.name}
            </p>
            <p className="text-[11px] text-stone-500">
              {editingItem.video.durationSeconds ? `${Math.round(editingItem.video.durationSeconds)}s · ` : ""}
              {editingItem.finalVideo ? "Completed" : editingItem.candidates.length ? "Faces ready" : "Draft"}
            </p>
          </div>
          <label className="flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 text-xs">
            <span className="font-medium text-stone-500">Persona</span>
            <select
              value={selectedPersona?.id ?? ""}
              onChange={(event) => onSelectPersona(event.target.value)}
              className="max-w-[7rem] bg-transparent text-xs font-semibold text-stone-950 outline-none"
            >
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 p-4">
          <StepSection
            step={1}
            title="Face Swap"
            icon={Wand2}
            hint="Swap the target frame's face with your persona, then pick the best result"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
              {/* Sources */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="aspect-[9/16] overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <DeferredVideo src={sourceVideoToUrl(editingItem.video)} title={editingItem.video.name} className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-1.5 text-center text-[11px] font-medium text-stone-500">Source reel</p>
                  <AssetExpiryCaption asset={editingItem} className="mt-0.5 justify-center" />
                </div>
                <div>
                  <div className="aspect-[9/16] overflow-hidden rounded-lg border-2 border-emerald-800 bg-stone-900">
                    {editingItem.firstFramePreview ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewMedia({
                            src: editingItem.firstFramePreview ?? "",
                            title: `${editingItem.video.name} first frame`,
                          })
                        }
                        className="block h-full w-full"
                        aria-label="Open first frame fullscreen"
                      >
                        <img
                          src={editingItem.firstFramePreview}
                          alt="Face-swap target"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <TilePlaceholder icon={Loader2} label="Capturing…" spin />
                    )}
                  </div>
                  <p className="mt-1.5 text-center text-[11px] font-medium text-emerald-800">First frame</p>
                </div>
              </div>

              {/* Persona references — the center column, now substantial */}
              <div className="rounded-lg border border-stone-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700">Persona references</p>
                  <span className="text-[10px] text-stone-500">
                    {personaReferences.length} ref{personaReferences.length === 1 ? "" : "s"}
                  </span>
                </div>
                {personaReferences.length ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {personaReferences.slice(0, 6).map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => setPreviewMedia({ src: ref.url, title: ref.title, kind: "image" })}
                        className="aspect-square overflow-hidden rounded-md border border-stone-200 transition hover:border-emerald-800"
                        aria-label={`Preview ${ref.title}`}
                      >
                        <CardImage src={ref.url} alt={ref.title} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 grid aspect-[3/2] place-items-center rounded-md border border-dashed border-stone-300 text-[11px] text-stone-400">
                    No persona references yet
                  </div>
                )}
                <p className="mt-2 text-[10px] leading-4 text-stone-500">
                  Persona reference images are combined with the target frame to rebuild the face.
                </p>
              </div>

              {/* Settings */}
              <form onSubmit={(event) => void generateFaceCandidates(event)} className="flex flex-col">
                <details className="rounded-md border border-stone-200 bg-stone-50">
                  <summary className="flex h-9 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-stone-700">
                    Face settings
                    <Settings2 size={13} className="text-stone-400" />
                  </summary>
                  <div className="space-y-1 px-3 pb-3">
                    <ModelSelect label="Model" value={imageModel} options={imageModelOptions} onChange={changeImageModel} />
                    <div className="grid grid-cols-2 gap-2">
                      <SelectField label="Aspect" value={safeImageAspectRatio} options={imageAspectRatioOptions} onChange={setImageAspectRatio} />
                      {imageModelSupportsSize ? (
                        <SelectField label="Resolution" value={imageSize} options={imageSizesForModel(imageModel)} onChange={setImageSize} />
                      ) : (
                        <div />
                      )}
                    </div>
                    {imageModelSupportsQuality ? (
                      <SelectField label="Quality" value={imageQuality} options={chatGptImageQualities} onChange={setImageQuality} />
                    ) : null}
                    <NumberField label="Candidates" value={safeCandidateCount} min={1} max={4} onChange={setCandidateCount} />
                    <TextArea label="Prompt" value={facePrompt} onChange={setFacePrompt} rows={3} />
                  </div>
                </details>
                <SubmitButton
                  loading={Boolean(editingItem.isGeneratingFaces) || isPersistentlyGeneratingFaces}
                  icon={Wand2}
                  label="Generate faces"
                  costLabel={faceCostLabel}
                  disableWhileLoading={false}
                  disabled={
                    !selectedPersona ||
                    !editingItem.firstFrame ||
                    !personaReferences.length ||
                    !supportsImageReferences(imageModel)
                  }
                />
              </form>
            </div>

            {editingItem.isGeneratingFaces || isPersistentlyGeneratingFaces || editingItem.candidates.length ? (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <p className="mb-2 text-[11px] font-semibold text-stone-700">
                  {editingItem.isGeneratingFaces || isPersistentlyGeneratingFaces
                    ? "Generating face-swapped frames"
                    : "Candidates — tap one to use it as the identity for motion"}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {editingItem.candidates.map((asset, index) => {
                    const isPicked = selectedCandidate?.id === asset.id;
                    return (
                      <div
                        key={asset.id}
                        title={asset.title}
                        className={cn(
                          "group relative w-24 shrink-0 overflow-hidden rounded-md border bg-white text-left transition",
                          isPicked ? "border-emerald-800 ring-2 ring-emerald-800" : "border-stone-200 hover:border-emerald-800",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isPicked) {
                              setPreviewMedia({ src: asset.url, title: asset.title, kind: "image" });
                              return;
                            }
                            selectCandidate(asset.id);
                          }}
                          className="block w-full text-left"
                          aria-label={isPicked ? `Open ${asset.title} fullscreen` : `Select ${asset.title}`}
                        >
                          <div className="relative aspect-[9/16] bg-stone-100">
                            <CardImage src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                          </div>
                          <p className="px-1.5 py-1 text-[9px] font-semibold text-stone-700">
                            {isPicked ? "Selected" : `#${index + 1}`}
                          </p>
                          <AssetExpiryCaption asset={asset} className="px-1.5 pb-1 text-[9px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => selectCandidate(asset.id)}
                          className={cn(
                            "absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border transition",
                            isPicked
                              ? "border-emerald-800 bg-emerald-800 text-white"
                              : "border-white/60 bg-black/30 text-transparent group-hover:border-white/80",
                          )}
                          aria-label={isPicked ? `Unselect ${asset.title}` : `Select ${asset.title}`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                      </div>
                    );
                  })}
                  {editingItem.isGeneratingFaces || isPersistentlyGeneratingFaces
                    ? Array.from({ length: safeCandidateCount }).map((_, index) => (
                        <CandidateLoadingCard key={`candidate-loading-${index}`} />
                      ))
                    : null}
                </div>
              </div>
            ) : null}
          </StepSection>

          <div className="flex justify-center" aria-hidden="true">
            <span className="flex size-6 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <ArrowDown size={14} />
            </span>
          </div>

          <StepSection
            step={2}
            title="Motion"
            icon={Film}
            hint="Drive the selected identity frame with the reel's motion"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="aspect-[9/16] overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    {selectedCandidate ? (
                      <CardImage src={selectedCandidate.url} alt={selectedCandidate.title} className="h-full w-full object-cover" />
                    ) : (
                      <TilePlaceholder icon={ImageIcon} label="From step 1" />
                    )}
                  </div>
                  <p className="mt-1.5 text-center text-[11px] font-medium text-stone-500">Identity frame</p>
                  {selectedCandidate ? <AssetExpiryCaption asset={selectedCandidate} className="mt-0.5 justify-center" /> : null}
                </div>
                <div>
                  <div className="aspect-[9/16] overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <DeferredVideo src={sourceVideoToUrl(editingItem.video)} title={editingItem.video.name} className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-1.5 text-center text-[11px] font-medium text-stone-500">Motion source</p>
                  <AssetExpiryCaption asset={editingItem} className="mt-0.5 justify-center" />
                </div>
              </div>

              {/* Output — the center climax */}
              <div className="rounded-lg border border-stone-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700">Final video</p>
                  {editingItem.finalVideo ? (
                    <span className="rounded-sm bg-emerald-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Done
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 aspect-[9/16] overflow-hidden rounded-lg border-2 border-emerald-800/30 bg-stone-900">
                  {editingItem.isGeneratingVideo || isPersistentlyGeneratingVideo ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-white/80" />
                    </div>
                  ) : editingItem.finalVideo ? (
                    <DeferredVideo src={editingItem.finalVideo.url} title={editingItem.finalVideo.title} className="h-full w-full object-cover" />
                  ) : (
                    <TilePlaceholder icon={Play} label="Output" />
                  )}
                </div>
                {editingItem.finalVideo ? <AssetExpiryCaption asset={editingItem.finalVideo} className="mt-1" /> : null}
              </div>

              {/* Settings */}
              <form onSubmit={(event) => void generateTrendVideo(event)} className="flex flex-col">
                <details className="rounded-md border border-stone-200 bg-stone-50">
                  <summary className="flex h-9 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-stone-700">
                    Motion settings
                    <Settings2 size={13} className="text-stone-400" />
                  </summary>
                  <div className="space-y-1 px-3 pb-3">
                    <ModelSelect label="Model" value={motionModel} options={motionModelOptions} onChange={setMotionModel} />
                    <div className="grid grid-cols-2 gap-2">
                      <SelectField
                        label="Resolution"
                        value={motionResolution}
                        options={[...motionResolutions]}
                        onChange={(value) => setMotionResolution(value as (typeof motionResolutions)[number])}
                      />
                      {motionControls.supportsCharacterOrientation ? (
                        <SelectField
                          label="Character orientation"
                          value={motionCharacterOrientation}
                          options={["video", "image"]}
                          onChange={(value) => setMotionCharacterOrientation(value as "image" | "video")}
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                    {motionControls.supportsMotionMode ? (
                      <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
                        {(["animate", "replace"] as const).map((modeValue) => (
                          <button
                            type="button"
                            key={modeValue}
                            onClick={() => setMotionMode(modeValue)}
                            className={cn(
                              "h-8 rounded-[5px] px-3 text-xs font-medium capitalize transition",
                              motionMode === modeValue ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
                            )}
                          >
                            {modeValue}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {motionControls.supportsKeepOriginalSound ? (
                      <label className="mt-1 flex h-9 cursor-pointer items-center gap-2.5 rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-emerald-800">
                        <input
                          type="checkbox"
                          checked={keepOriginalSound}
                          onChange={(event) => setKeepOriginalSound(event.target.checked)}
                          className="size-4 accent-emerald-800"
                        />
                        Keep original sound
                      </label>
                    ) : null}
                    <TextArea label="Video prompt" value={motionPrompt} onChange={setMotionPrompt} rows={3} />
                    {motionControls.supportsMotionReference ? (
                      <TextField label="Motion reference" value={motionReference} onChange={setMotionReference} />
                    ) : null}
                    {motionControls.supportsNegativePrompt ? (
                      <TextArea label="Negative prompt" value={motionNegativePrompt} onChange={setMotionNegativePrompt} rows={2} />
                    ) : null}
                  </div>
                </details>
                <SubmitButton
                  loading={Boolean(editingItem.isGeneratingVideo) || isPersistentlyGeneratingVideo}
                  icon={Film}
                  label="Generate reel"
                  costLabel={motionCostLabel}
                  disableWhileLoading={false}
                  disabled={!selectedPersona || !selectedCandidate}
                />
              </form>
            </div>
          </StepSection>

          {error ? <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{error}</p> : null}
        </div>
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-5">
      {previewMedia ? (
        <MediaLightbox
          src={previewMedia.src}
          title={previewMedia.title}
          kind={previewMedia.kind}
          onClose={() => setPreviewMedia(undefined)}
        />
      ) : null}
      <SourceIngress
        isUploading={isUploading}
        isDragOver={isDragOver}
        onDragStateChange={setIsDragOver}
        onDrop={handleDrop}
        onFiles={importFromFiles}
      />

      {library.length ? (
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <PanelTitle icon={Clapperboard} title="Library" />
            <span className="text-[11px] text-stone-500">
              {library.length} source{library.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {library.map((item) => {
              const hasCandidates = item.candidates.length > 0;
              const hasFinal = Boolean(item.finalVideo);
              const PrimaryIcon: LucideIcon = hasFinal ? Play : hasCandidates ? Film : Wand2;
              const primaryLabel = hasFinal ? "Open" : hasCandidates ? "Continue" : "Face swap";
              const statusLabel = item.importState === "capturing"
                ? "Preparing"
                : hasFinal
                  ? "Done"
                  : hasCandidates
                    ? "Faces ready"
                    : "Draft";
              return (
                <div
                  key={item.id}
                  className="group relative w-36 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white transition hover:border-emerald-800"
                >
                  <div className="relative aspect-[9/16] bg-stone-900">
                    {item.importState === "capturing" ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-white/80" />
                      </div>
                    ) : item.firstFramePreview ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewMedia({
                            src: item.firstFramePreview ?? "",
                            title: `${item.video.name} first frame`,
                          })
                        }
                        className="block h-full w-full"
                        aria-label="Open first frame fullscreen"
                      >
                        <img src={item.firstFramePreview} alt={item.video.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <DeferredVideo src={sourceVideoToUrl(item.video)} title={item.video.name} className="h-full w-full object-cover" />
                    )}
                    {item.video.durationSeconds ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1 py-0.5 text-[9px] font-semibold text-white">
                        {Math.round(item.video.durationSeconds)}s
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                        hasFinal
                          ? "bg-emerald-800 text-white"
                          : hasCandidates
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-black/45 text-white",
                      )}
                    >
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLibraryItem(item.id)}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-red-700 group-hover:opacity-100"
                      aria-label="Remove video"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-1 text-[11px] font-medium text-stone-950" title={item.video.name}>
                      {item.video.name}
                    </p>
                    <AssetExpiryCaption asset={item} className="mt-0.5" />
                    <button
                      type="button"
                      onClick={() => openEditor(item)}
                      className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-800 text-[11px] font-semibold text-white transition hover:bg-emerald-900"
                    >
                      <PrimaryIcon size={13} />
                      {primaryLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white p-10 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
              <Clapperboard size={26} />
            </div>
            <p className="mt-3 text-sm font-semibold text-stone-950">No reels yet</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
              Upload a video above. Your sources are saved here as a library you can edit anytime.
            </p>
          </div>
        </div>
      )}

      {error ? <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function SourceIngress({
  isUploading,
  isDragOver,
  onDragStateChange,
  onDrop,
  onFiles,
}: {
  isUploading: boolean;
  isDragOver: boolean;
  onDragStateChange: (value: boolean) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
          <Upload size={16} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-stone-950">Add a reel</h2>
          <p className="text-[11px] text-stone-500">Drop a file or choose one from your device.</p>
        </div>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={() => onDragStateChange(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 text-sm transition",
          isDragOver ? "border-emerald-800 bg-emerald-50" : "border-stone-300 bg-stone-50 hover:border-emerald-800 hover:bg-white",
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 animate-spin text-emerald-800" />
            <span className="text-stone-600">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="size-4 text-emerald-800" />
            <span className="font-medium text-stone-600">Drop video here or choose from device</span>
          </>
        )}
        <input
          type="file"
          accept="video/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}

function StepSection({
  step,
  title,
  icon: Icon,
  hint,
  children,
}: {
  step: number;
  title: string;
  icon: LucideIcon;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="trend-step-panel rounded-lg border border-stone-200 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
          {step}
        </span>
        <Icon className="text-emerald-800" size={16} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-950">{title}</p>
          {hint ? <p className="text-[11px] leading-4 text-stone-500">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function TilePlaceholder({
  icon: Icon,
  label,
  spin,
}: {
  icon: LucideIcon;
  label: string;
  spin?: boolean;
}) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-white/60">
      <Icon size={18} className={cn(spin && "animate-spin")} />
      {label}
    </div>
  );
}

function CandidateLoadingCard() {
  return (
    <div className="relative w-20 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-white">
      <div className="flex aspect-[9/16] items-center justify-center bg-stone-100">
        <Loader2 className="size-5 animate-spin text-stone-400" />
      </div>
      <p className="px-1.5 py-1 text-[9px] font-semibold text-stone-400">…</p>
    </div>
  );
}

function sourceVideoToUrl(video: SourceVideoInput) {
  if (video.url) return video.url;
  return `data:${video.mimeType};base64,${video.data}`;
}

async function captureFirstFrame(videoUrl: string, name: string) {
  return new Promise<{ image: SourceImageInput; durationSeconds?: number }>((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    // This must be set before src. Otherwise frames loaded from storage on
    // another origin taint the canvas and prevent exporting the thumbnail.
    video.crossOrigin = "anonymous";
    video.src = videoUrl;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      const width = video.videoWidth || 720;
      const height = video.videoHeight || 1280;
      const scale = Math.min(1, 1280 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        cleanup();
        reject(new Error("Could not capture the first frame."));
        return;
      }
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const durationSeconds = Number.isFinite(video.duration) ? video.duration : undefined;
        cleanup();
        resolve({
          image: {
            name: `${name.replace(/\.[^.]+$/, "") || "trend-video"} first frame.jpg`,
            mimeType: "image/jpeg",
            data: dataUrl.split(",")[1] ?? "",
          },
          durationSeconds,
        });
      } catch {
        cleanup();
        reject(new Error("Could not capture the first frame. The video host does not allow cross-origin access."));
      }
    }, { once: true });

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Could not read the imported video."));
    }, { once: true });
  });
}

async function assetToProviderImageInput(asset: Asset): Promise<SourceImageInput> {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error("Could not prepare the selected face frame.");
  }
  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  return {
    name: asset.title,
    mimeType: blob.type || asset.mimeType || "image/png",
    data: dataUrl.split(",")[1] ?? "",
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
