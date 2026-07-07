/* eslint-disable @next/next/no-img-element */

import {
  Check,
  Clapperboard,
  Download,
  Flame,
  ImageIcon,
  LinkIcon,
  Loader2,
  Play,
  Settings2,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { SourceImageInput, SourceVideoInput } from "@/components/studio/types";
import {
  ModelSelect,
  NumberField,
  PanelTitle,
  PersonaSelect,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
  UploadBox,
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
import { modelsForCapability } from "@/lib/model-registry";
import { estimateImageGenerationPricing, estimateVideoGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatTokens } from "@/lib/utils";

type ImportState = "idle" | "importing" | "capturing" | "ready";
type GenerationStage = "import" | "faces" | "motion";
type ImportedVideo = SourceVideoInput & {
  sourceUrl?: string;
  durationSeconds?: number;
  sizeBytes?: number;
};

const motionResolutions = ["480p", "720p"] as const;

export function TrendVideoView({
  personas,
  assets,
  selectedPersona,
  supabaseReady,
  onAssetsCreated,
  onSelectPersona,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  supabaseReady?: boolean;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
}) {
  const [stage, setStage] = useState<GenerationStage>("import");
  const [trendUrl, setTrendUrl] = useState("");
  const [importedVideo, setImportedVideo] = useState<ImportedVideo | undefined>();
  const [firstFrame, setFirstFrame] = useState<SourceImageInput | undefined>();
  const [firstFramePreview, setFirstFramePreview] = useState("");
  const [importState, setImportState] = useState<ImportState>("idle");
  const [imageModel, setImageModel] = useState(NANO_BANANA_PRO_MODEL_ID);
  const [imageAspectRatio, setImageAspectRatio] = useState("9:16");
  const [imageSize, setImageSize] = useState("2K");
  const [imageQuality, setImageQuality] = useState("medium");
  const [candidateCount, setCandidateCount] = useState(3);
  const [facePrompt, setFacePrompt] = useState(
    "Replace the visible face with the selected Persona while preserving the original frame, pose, styling, lighting, clothing, hands, body, camera angle, and background.",
  );
  const [candidateAssets, setCandidateAssets] = useState<Asset[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [motionModel, setMotionModel] = useState("wan-animate");
  const [motionPrompt, setMotionPrompt] = useState(
    "Follow the driving video's motion, timing, framing, dance movement, and camera rhythm with stable identity.",
  );
  const [motionReference, setMotionReference] = useState("copy the original dance, body timing, camera movement, and framing");
  const [motionMode, setMotionMode] = useState<"animate" | "replace">("animate");
  const [motionResolution, setMotionResolution] = useState<(typeof motionResolutions)[number]>("720p");
  const [motionNegativePrompt, setMotionNegativePrompt] = useState("blur, distorted body, warped hands, flicker, low quality");
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);
  const [isGeneratingFaces, setIsGeneratingFaces] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [finalVideo, setFinalVideo] = useState<Asset | undefined>();
  const [error, setError] = useState("");

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
  const imageAspectRatioOptions = aspectRatiosForImageModel(imageModel);
  const safeImageAspectRatio = imageAspectRatioOptions.includes(imageAspectRatio)
    ? imageAspectRatio
    : imageAspectRatioOptions[0];
  const imageModelSupportsSize = supportsImageSize(imageModel);
  const imageModelSupportsQuality = supportsImageQuality(imageModel);
  const selectedCandidate = candidateAssets.find((asset) => asset.id === selectedCandidateId) ?? candidateAssets[0];
  const safeCandidateCount = Math.min(4, Math.max(1, Math.round(candidateCount)));
  const detectedDuration = importedVideo?.durationSeconds ? Math.round(importedVideo.durationSeconds) : 5;
  const safeMotionDuration = Math.min(15, Math.max(3, detectedDuration));
  const faceCostLabel = formatTokens(
    estimateImageGenerationPricing({
      prompt: facePrompt,
      model: imageModel,
      aspectRatio: safeImageAspectRatio,
      imageSize: imageModelSupportsSize ? imageSize : "2K",
      imageQuality: imageModelSupportsQuality ? (imageQuality as "low" | "medium" | "high") : undefined,
      count: safeCandidateCount,
      referenceImages: [
        ...personaReferences.map((asset) => ({ name: asset.title, mimeType: asset.mimeType, data: "x" })),
        ...(firstFrame ? [{ name: firstFrame.name, mimeType: firstFrame.mimeType, data: "x" }] : []),
      ],
      generationType: "image_from_reference",
    }).tokens,
  );
  const motionCostLabel = formatTokens(
    estimateVideoGenerationPricing({
      prompt: motionPrompt,
      model: motionModel,
      mode: "motion",
      durationSeconds: safeMotionDuration,
      aspectRatio: "9:16",
      resolution: motionResolution,
      motionReference,
      motionMode,
      characterOrientation: "video",
      keepOriginalSound,
      negativePrompt: motionNegativePrompt,
    }).tokens,
  );

  const stageSteps: Array<{ id: GenerationStage; label: string; done: boolean }> = [
    { id: "import", label: "Source", done: Boolean(importedVideo) },
    { id: "faces", label: "Faces", done: candidateAssets.length > 0 },
    { id: "motion", label: "Motion", done: Boolean(finalVideo) },
  ];

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

  async function importVideoFromUrl(event: FormEvent) {
    event.preventDefault();
    const trimmedUrl = trendUrl.trim();
    if (!trimmedUrl) return;
    setError("");
    setFinalVideo(undefined);
    setImportState("importing");
    try {
      const response = await fetch("/api/media/import-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Video import failed.");
      }
      const video: ImportedVideo = {
        name: payload.name ?? "trend-video.mp4",
        mimeType: payload.mimeType ?? "video/mp4",
        url: payload.url,
        sourceUrl: trimmedUrl,
        sizeBytes: payload.sizeBytes,
      };
      await prepareImportedVideo(video);
    } catch (importError) {
      setImportState("idle");
      setError(importError instanceof Error ? importError.message : "Video import failed.");
    }
  }

  async function captureUploadedVideo(files: FileList | null) {
    setError("");
    setFinalVideo(undefined);
    setImportState("importing");
    try {
      const [video] = await encodeFiles(files, "video/mp4", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `trend-videos/${selectedPersona?.id ?? "unassigned"}`,
      });
      if (!video) {
        setImportState("idle");
        return;
      }
      await prepareImportedVideo({
        name: video.name,
        mimeType: video.mimeType,
        data: video.data,
        url: video.url,
      });
    } catch (uploadError) {
      setImportState("idle");
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
    }
  }

  async function prepareImportedVideo(video: ImportedVideo) {
    const videoUrl = sourceVideoToUrl(video);
    setImportedVideo(video);
    setCandidateAssets([]);
    setSelectedCandidateId("");
    setFirstFrame(undefined);
    setFirstFramePreview("");
    setImportState("capturing");
    const captured = await captureFirstFrame(videoUrl, video.name);
    setImportedVideo((current) => current ? { ...current, durationSeconds: captured.durationSeconds } : current);
    setFirstFrame(captured.image);
    setFirstFramePreview(sourceImageToDataUrl(captured.image));
    setImportState("ready");
    setStage("faces");
  }

  async function generateFaceCandidates(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !firstFrame || !personaReferences.length || !supportsImageReferences(imageModel)) return;
    setIsGeneratingFaces(true);
    setError("");
    try {
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
          referenceImageUrls: personaReferences.map((asset) => asset.url),
          sourceImages: [{ name: firstFrame.name, mimeType: firstFrame.mimeType, data: firstFrame.data ?? "" }],
          referenceAssetIds: personaReferences.map((asset) => asset.id),
          titlePrefix: `${selectedPersona.name} trend face`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Face frame generation failed.");
      }
      const nextAssets = (payload.assets as Asset[]).map((asset) => ({
        ...asset,
        referenceAssetIds: personaReferences.map((reference) => reference.id),
      }));
      setCandidateAssets(nextAssets);
      setSelectedCandidateId(nextAssets[0]?.id ?? "");
      onAssetsCreated(nextAssets, payload.job);
      setStage("motion");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Face frame generation failed.");
    } finally {
      setIsGeneratingFaces(false);
    }
  }

  async function generateTrendVideo(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !selectedCandidate || !importedVideo) return;
    setIsGeneratingVideo(true);
    setError("");
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
          negativePrompt: motionNegativePrompt,
          providerMode: providerModeForVideoModel(motionModel, "std"),
          cfgScale: 0.5,
          generateAudio: false,
          resolution: motionResolution,
          returnLastFrame: false,
          motionReference,
          motionMode,
          characterOrientation: "video",
          keepOriginalSound,
          startFrameImage: candidateInput,
          motionReferenceVideoUrl: importedVideo.url,
          motionReferenceVideo: importedVideo.data
            ? { name: importedVideo.name, mimeType: importedVideo.mimeType, data: importedVideo.data }
            : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Trend video generation failed.");
      }
      const nextAssets = payload.asset ? [{ ...payload.asset, referenceAssetIds: [selectedCandidate.id] }] : [];
      if (nextAssets[0]) setFinalVideo(nextAssets[0]);
      onAssetsCreated(nextAssets, payload.job);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Trend video generation failed.");
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle icon={Flame} title="Trend Video" />
          <ol className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
            {stageSteps.map((step, index) => {
              const isActive = stage === step.id;
              return (
                <li key={step.id} className="flex items-center gap-1">
                  {index > 0 ? <span className="text-stone-300">/</span> : null}
                  <button
                    type="button"
                    onClick={() => setStage(step.id)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 transition",
                      isActive ? "bg-emerald-50 text-emerald-800" : step.done ? "text-stone-700 hover:bg-stone-100" : "hover:bg-stone-100",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[9px] font-bold",
                        isActive ? "bg-emerald-800 text-white" : step.done ? "bg-emerald-800/70 text-white" : "bg-stone-200 text-stone-500",
                      )}
                    >
                      {step.done && !isActive ? <Check size={10} strokeWidth={3} /> : index + 1}
                    </span>
                    {step.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <TrendPanel
            step="01"
            title="Source"
            subtitle={importedVideo ? `${Math.round(detectedDuration)}s clip` : "Import a trend"}
            active={stage === "import"}
          >
            <div className="aspect-[9/16] overflow-hidden rounded-md border border-stone-200 bg-stone-900">
              {importedVideo ? (
                <video src={sourceVideoToUrl(importedVideo)} className="h-full w-full object-cover" controls muted />
              ) : (
                <EmptyPreview icon={Clapperboard} label="No video" />
              )}
            </div>
            {firstFramePreview ? (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={firstFramePreview}
                  alt="Captured first frame"
                  className="h-20 w-12 shrink-0 rounded-md border border-stone-200 object-cover"
                />
                <div>
                  <p className="text-xs font-semibold text-stone-950">First frame captured</p>
                  <p className="mt-0.5 text-[11px] text-stone-500">Used as the face-swap source.</p>
                </div>
              </div>
            ) : null}
          </TrendPanel>

          <TrendPanel
            step="02"
            title="Face candidates"
            subtitle={candidateAssets.length ? `${candidateAssets.length} generated` : "Swap the face"}
            active={stage === "faces"}
            className="lg:col-span-2"
          >
            {isGeneratingFaces ? (
              <LoadingBlock label="Generating face-swapped frames" />
            ) : candidateAssets.length ? (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {candidateAssets.map((asset) => {
                  const isSelected = selectedCandidate?.id === asset.id;
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => setSelectedCandidateId(asset.id)}
                      title={asset.title}
                      className={cn(
                        "group relative overflow-hidden rounded-md border bg-white text-left transition",
                        isSelected ? "border-emerald-800 ring-1 ring-emerald-800" : "border-stone-200 hover:border-emerald-800",
                      )}
                    >
                      <div className="relative aspect-[9/16] bg-stone-100">
                        <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                        <span
                          className={cn(
                            "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border transition",
                            isSelected
                              ? "border-emerald-800 bg-emerald-800 text-white"
                              : "border-white/60 bg-black/30 text-transparent group-hover:border-white/80",
                          )}
                        >
                          <Check size={14} strokeWidth={3} />
                        </span>
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="line-clamp-1 text-xs font-semibold text-stone-950">{asset.title}</p>
                        <p className="mt-0.5 text-[11px] text-stone-500">{isSelected ? "Selected for motion" : asset.model}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyPreview icon={ImageIcon} label="No face frames yet" />
            )}
          </TrendPanel>

          <TrendPanel
            step="03"
            title="Final video"
            subtitle={finalVideo ? "Ready" : "Apply the motion"}
            active={stage === "motion"}
            className="lg:col-span-3"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              {selectedCandidate ? (
                <div className="flex items-center gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <img
                    src={selectedCandidate.url}
                    alt={selectedCandidate.title}
                    className="h-24 w-16 shrink-0 rounded-md border border-stone-200 object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-stone-950">Selected frame</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-500">{selectedCandidate.title}</p>
                    <p className="mt-2 text-[11px] text-stone-500">Driving motion from the source clip.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-stone-500">
                  Pick a candidate first.
                </div>
              )}
              <div className="aspect-[9/16] max-h-[34rem] overflow-hidden rounded-md border border-stone-200 bg-stone-900">
                {isGeneratingVideo ? (
                  <LoadingBlock label="Generating motion video" />
                ) : finalVideo ? (
                  <video src={finalVideo.url} className="h-full w-full object-cover" controls />
                ) : (
                  <EmptyPreview icon={Play} label="No output video" />
                )}
              </div>
            </div>
          </TrendPanel>
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        {stage === "import" ? (
          <div>
            <PanelTitle icon={Download} title="Trend Source" />
            <PersonaSelect personas={personas} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <form onSubmit={importVideoFromUrl}>
              <TextField label="Video link" value={trendUrl} onChange={setTrendUrl} />
              <SubmitButton
                loading={importState === "importing" || importState === "capturing"}
                icon={LinkIcon}
                label={importState === "capturing" ? "Capturing frame" : "Import video"}
                disabled={!trendUrl.trim()}
              />
            </form>
            <UploadBox
              accept="video/*"
              compact
              icon={Upload}
              label={importedVideo?.name ?? "Upload trend video"}
              detail={importedVideo?.durationSeconds ? `${Math.round(importedVideo.durationSeconds)}s detected` : "MP4, WebM, or MOV"}
              loading={importState === "importing" || importState === "capturing"}
              onChange={(files) => void captureUploadedVideo(files)}
            />
          </div>
        ) : null}

        {stage === "faces" ? (
          <form onSubmit={(event) => void generateFaceCandidates(event)}>
            <PanelTitle icon={ImageIcon} title="Image Options" />
            <ModelSelect label="Model" value={imageModel} options={imageModelOptions} onChange={changeImageModel} />
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <SelectField label="Aspect ratio" value={safeImageAspectRatio} options={imageAspectRatioOptions} onChange={setImageAspectRatio} />
              {imageModelSupportsSize ? (
                <SelectField label="Size" value={imageSize} options={imageSizesForModel(imageModel)} onChange={setImageSize} />
              ) : <div />}
            </div>
            {imageModelSupportsQuality ? (
              <SelectField label="Quality" value={imageQuality} options={chatGptImageQualities} onChange={setImageQuality} />
            ) : null}
            <NumberField label="Candidates" value={safeCandidateCount} min={1} max={4} onChange={setCandidateCount} />
            <TextArea label="Face swap prompt" value={facePrompt} onChange={setFacePrompt} rows={4} />
            <SubmitButton
              loading={isGeneratingFaces}
              icon={ImageIcon}
              label="Generate face frames"
              costLabel={faceCostLabel}
              disabled={!selectedPersona || !firstFrame || !personaReferences.length || !supportsImageReferences(imageModel)}
            />
          </form>
        ) : null}

        {stage === "motion" ? (
          <form onSubmit={(event) => void generateTrendVideo(event)}>
            <PanelTitle icon={Settings2} title="Video Options" />
            <ModelSelect label="Model" value={motionModel} options={motionModelOptions} onChange={setMotionModel} />
            <SelectField
              label="Resolution"
              value={motionResolution}
              options={[...motionResolutions]}
              onChange={(value) => setMotionResolution(value as (typeof motionResolutions)[number])}
            />
            <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
              {(["animate", "replace"] as const).map((modeValue) => (
                <button
                  type="button"
                  key={modeValue}
                  onClick={() => setMotionMode(modeValue)}
                  className={cn(
                    "h-9 rounded-[5px] px-3 text-xs font-medium capitalize transition",
                    motionMode === modeValue ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
                  )}
                >
                  {modeValue}
                </button>
              ))}
            </div>
            <label className="mt-2.5 flex h-9 cursor-pointer items-center gap-2.5 rounded-md border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 transition hover:border-emerald-800">
              <input
                type="checkbox"
                checked={keepOriginalSound}
                onChange={(event) => setKeepOriginalSound(event.target.checked)}
                className="size-4 accent-emerald-800"
              />
              Keep original sound
            </label>
            <TextArea label="Video prompt" value={motionPrompt} onChange={setMotionPrompt} rows={4} />
            <TextField label="Motion reference" value={motionReference} onChange={setMotionReference} />
            <TextArea label="Negative prompt" value={motionNegativePrompt} onChange={setMotionNegativePrompt} rows={2} />
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate trend video"
              costLabel={motionCostLabel}
              disabled={!selectedPersona || !importedVideo || !selectedCandidate}
            />
          </form>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-700">{error}</p>
        ) : null}
      </aside>
    </div>
  );
}

function TrendPanel({
  step,
  title,
  subtitle,
  active,
  className,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-stone-50 p-3.5 transition",
        active ? "border-emerald-800/60 ring-1 ring-emerald-800/30" : "border-stone-200",
        className,
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] font-semibold text-emerald-800">{step}</span>
          <p className="text-sm font-semibold text-stone-950">{title}</p>
        </div>
        {subtitle ? <span className="text-[11px] text-stone-500">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyPreview({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-md text-center text-xs text-stone-500">
      <Icon className="mb-2 text-emerald-800" size={26} />
      {label}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-md text-center text-xs text-stone-600">
      <Loader2 className="mb-3 animate-spin text-emerald-800" size={24} />
      {label}
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

function providerModeForVideoModel(modelId: string, fallback: "std" | "pro") {
  if (modelId.endsWith("-pro")) return "pro";
  if (modelId.endsWith("-std")) return "std";
  return fallback;
}
