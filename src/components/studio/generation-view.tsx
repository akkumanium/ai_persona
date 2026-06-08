/* eslint-disable @next/next/no-img-element */

import { Clapperboard, ImageIcon, Loader2, Play, Search, Trash2, Upload, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { GenerationMode, SourceImageInput, SourceVideoInput, VideoFrameSlot } from "@/components/studio/types";
import {
  CheckboxField,
  ModelSelect,
  ModeToggle,
  NumberField,
  PanelTitle,
  PersonaSelect,
  RangeField,
  ReferencePicker,
  ReferenceSummary,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
  UploadBox,
} from "@/components/studio/ui";
import { modelsForCapability } from "@/lib/model-registry";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

const klingAspectRatios = ["16:9", "9:16", "1:1"];
const seedanceAspectRatios = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const wanAspectRatios = ["16:9", "9:16", "1:1", "4:5", "3:4"];
const videoResolutionOptions = ["480p", "720p", "1080p"];
const imageAspectRatioOptions = ["1:1", "3:4", "4:5", "9:16", "16:9"];
const imageSizeOptions = ["1K", "2K", "4K"];
const imageQualityOptions = ["auto", "low", "medium", "high"];

export function GenerationView({
  mode,
  personas,
  assets,
  selectedPersona,
  selectedReference,
  onAssetsCreated,
  onSelectPersona,
  onDeleteAsset,
}: {
  mode: GenerationMode;
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  selectedReference?: Asset;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  const [imagePrompt, setImagePrompt] = useState("Editorial product photo for a social launch campaign.");
  const [videoPrompt, setVideoPrompt] = useState("Short vertical clip with a confident camera turn and subtle smile.");
  const [useImageReferences, setUseImageReferences] = useState(true);
  const [imageModel, setImageModel] = useState("gemini-3-pro-image-preview");
  const [imageAspectRatio, setImageAspectRatio] = useState("4:5");
  const [imageSize, setImageSize] = useState("2K");
  const [imageQuality, setImageQuality] = useState("auto");
  const [videoModel, setVideoModel] = useState("wan-2.2");
  const [motionVideoModel, setMotionVideoModel] = useState("wan-animate");
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});
  const [videoStartFrameByPersona, setVideoStartFrameByPersona] = useState<Record<string, string>>({});
  const [videoEndFrameByPersona, setVideoEndFrameByPersona] = useState<Record<string, string | undefined>>({});
  const [videoFrameSlot, setVideoFrameSlot] = useState<VideoFrameSlot>("start");
  const [videoImageSearch, setVideoImageSearch] = useState("");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(5);
  const [videoAspectRatio, setVideoAspectRatio] = useState("9:16");
  const [videoNegativePrompt, setVideoNegativePrompt] = useState("blur, distortions, warped hands, low quality");
  const [videoProviderMode, setVideoProviderMode] = useState<"std" | "pro">("std");
  const [videoCfgScale, setVideoCfgScale] = useState(0.5);
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(false);
  const [videoResolution, setVideoResolution] = useState<"480p" | "720p" | "1080p">("720p");
  const [videoReturnLastFrame, setVideoReturnLastFrame] = useState(false);
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
  const generatedImageAssets = useMemo(
    () => assets.filter((asset) => asset.personaId === selectedPersona?.id && asset.kind === "image"),
    [assets, selectedPersona?.id],
  );
  const selectedVideoStartFrame =
    generatedImageAssets.find((asset) => asset.id === (selectedPersona ? videoStartFrameByPersona[selectedPersona.id] : "")) ??
    generatedImageAssets[0];
  const selectedVideoEndFrame = generatedImageAssets.find(
    (asset) => asset.id === (selectedPersona ? videoEndFrameByPersona[selectedPersona.id] : ""),
  );
  const videoAspectRatioOptions = aspectRatiosForVideoModel(videoModel);
  const durationBounds = durationBoundsForVideoModel(videoModel);
  const safeVideoAspectRatio = videoAspectRatioOptions.includes(videoAspectRatio)
    ? videoAspectRatio
    : videoAspectRatioOptions[0];
  const safeVideoDuration = clampNumber(videoDurationSeconds, durationBounds.min, durationBounds.max);
  const safeVideoResolution =
    videoModel.includes("fast") && videoResolution === "1080p" ? "720p" : videoResolution;
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

  function selectVideoFrame(assetId: string) {
    if (!selectedPersona) return;
    if (videoFrameSlot === "start") {
      setVideoStartFrameByPersona((current) => ({ ...current, [selectedPersona.id]: assetId }));
      return;
    }

    setVideoEndFrameByPersona((current) => ({ ...current, [selectedPersona.id]: assetId }));
  }

  function clearVideoEndFrame() {
    if (!selectedPersona) return;
    setVideoEndFrameByPersona((current) => ({ ...current, [selectedPersona.id]: undefined }));
  }

  function changeVideoModel(modelId: string) {
    setVideoModel(modelId);
    const nextAspectRatios = aspectRatiosForVideoModel(modelId);
    if (!nextAspectRatios.includes(videoAspectRatio)) {
      setVideoAspectRatio(nextAspectRatios.includes("9:16") ? "9:16" : nextAspectRatios[0]);
    }

    const nextDurationBounds = durationBoundsForVideoModel(modelId);
    setVideoDurationSeconds((current) => clampNumber(current, nextDurationBounds.min, nextDurationBounds.max));
    if (modelId.includes("fast") && videoResolution === "1080p") {
      setVideoResolution("720p");
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
        model: imageModel,
        styleNotes: selectedPersona.styleNotes,
        aspectRatio: imageAspectRatio,
        imageSize,
        imageQuality,
        count: 1,
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
    const startFrameAsset = mode === "normal" ? selectedVideoStartFrame : undefined;
    const endFrameAsset = mode === "normal" ? selectedVideoEndFrame : undefined;
    if (mode === "normal" && !startFrameAsset) return;
    const referenceImageUrl =
      mode === "motion"
        ? motionReferenceImage
          ? sourceImageToDataUrl(motionReferenceImage)
          : selectedReference?.url
        : startFrameAsset?.url;
    if (mode === "motion" && !referenceImageUrl) return;
    setIsGeneratingVideo(true);
    try {
      const requestBody = {
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        prompt: videoPrompt,
        mode,
        model: mode === "motion" ? motionVideoModel : videoModel,
        durationSeconds: mode === "normal" ? safeVideoDuration : 5,
        aspectRatio: mode === "normal" ? safeVideoAspectRatio : "9:16",
        negativePrompt: mode === "normal" ? videoNegativePrompt : "",
        providerMode: mode === "normal" ? videoProviderMode : "std",
        cfgScale: mode === "normal" ? videoCfgScale : 0.5,
        generateAudio: mode === "normal" ? videoGenerateAudio : false,
        resolution: mode === "normal" ? safeVideoResolution : "720p",
        returnLastFrame: mode === "normal" ? videoReturnLastFrame : false,
        motionReference: mode === "motion" ? motionReference : "",
        motionReferenceVideo: mode === "motion" ? motionReferenceVideo : undefined,
        ...(referenceImageUrl ? { referenceImageUrl, startFrameImageUrl: referenceImageUrl } : {}),
        ...(mode === "normal" && endFrameAsset ? { endFrameImageUrl: endFrameAsset.url } : {}),
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
          ? [startFrameAsset?.id, endFrameAsset?.id].filter((id): id is string => Boolean(id))
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                        <p className="mt-1 text-xs text-stone-500">{asset.model}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteAsset(asset.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Delete ${asset.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
            <SelectField
              label="Aspect ratio"
              value={imageAspectRatio}
              options={imageAspectRatioOptions}
              onChange={setImageAspectRatio}
            />
            <SelectField label="Image size" value={imageSize} options={imageSizeOptions} onChange={setImageSize} />
            <SelectField label="Quality" value={imageQuality} options={imageQualityOptions} onChange={setImageQuality} />
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
            <ModelSelect label="Video model" value={videoModel} options={videoModelOptions} onChange={changeVideoModel} />
            <VideoFramePicker
              images={generatedImageAssets}
              activeSlot={videoFrameSlot}
              search={videoImageSearch}
              selectedStartId={selectedVideoStartFrame?.id}
              selectedEndId={selectedVideoEndFrame?.id}
              onActiveSlotChange={setVideoFrameSlot}
              onSearchChange={setVideoImageSearch}
              onSelect={selectVideoFrame}
              onClearEnd={clearVideoEndFrame}
            />
            <NumberField
              label="Duration"
              value={safeVideoDuration}
              min={durationBounds.min}
              max={durationBounds.max}
              step={durationBounds.step}
              suffix="s"
              onChange={setVideoDurationSeconds}
            />
            <SelectField
              label="Aspect ratio"
              value={safeVideoAspectRatio}
              options={videoAspectRatioOptions}
              onChange={setVideoAspectRatio}
            />
            {isKlingVideoModel(videoModel) ? (
              <>
                <ModeToggle
                  label="Quality"
                  value={selectedVideoEndFrame ? "pro" : videoProviderMode}
                  options={[
                    { value: "std", label: "Standard" },
                    { value: "pro", label: "Pro" },
                  ]}
                  onChange={(value) => setVideoProviderMode(value as "std" | "pro")}
                />
                <RangeField label="CFG" value={videoCfgScale} min={0} max={1} step={0.05} onChange={setVideoCfgScale} />
              </>
            ) : null}
            {isSeedanceVideoModel(videoModel) ? (
              <>
                <SelectField
                  label="Resolution"
                  value={safeVideoResolution}
                  options={videoModel.includes("fast") ? ["480p", "720p"] : videoResolutionOptions}
                  onChange={(value) => setVideoResolution(value as "480p" | "720p" | "1080p")}
                />
                <CheckboxField
                  label="Return last frame"
                  checked={videoReturnLastFrame}
                  onChange={setVideoReturnLastFrame}
                />
              </>
            ) : null}
            <CheckboxField label="Generate audio" checked={videoGenerateAudio} onChange={setVideoGenerateAudio} />
            <TextArea label="Video prompt" value={videoPrompt} onChange={setVideoPrompt} rows={5} />
            <TextArea label="Negative prompt" value={videoNegativePrompt} onChange={setVideoNegativePrompt} rows={3} />
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate video"
              disabled={!selectedPersona || !selectedVideoStartFrame}
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
function VideoFramePicker({
  images,
  activeSlot,
  search,
  selectedStartId,
  selectedEndId,
  onActiveSlotChange,
  onSearchChange,
  onSelect,
  onClearEnd,
}: {
  images: Asset[];
  activeSlot: VideoFrameSlot;
  search: string;
  selectedStartId?: string;
  selectedEndId?: string;
  onActiveSlotChange: (slot: VideoFrameSlot) => void;
  onSearchChange: (value: string) => void;
  onSelect: (assetId: string) => void;
  onClearEnd: () => void;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleImages = images.filter((image) => {
    if (!normalizedSearch) return true;
    return [image.title, image.prompt, image.model]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  return (
    <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-700">Video frames</p>
        {selectedEndId ? (
          <button
            type="button"
            onClick={onClearEnd}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950"
          >
            <X size={14} />
            Clear end
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
        {(["start", "end"] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onActiveSlotChange(slot)}
            className={cn(
              "h-9 rounded-[5px] px-3 text-sm font-medium capitalize transition",
              activeSlot === slot ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
            )}
          >
            {slot} frame
          </button>
        ))}
      </div>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-600 focus-within:border-emerald-800">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search generated images"
          className="h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      {visibleImages.length ? (
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
          {visibleImages.map((image) => {
            const isStart = image.id === selectedStartId;
            const isEnd = image.id === selectedEndId;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => onSelect(image.id)}
                className={cn(
                  "overflow-hidden rounded-md border bg-white text-left transition hover:border-emerald-800",
                  (activeSlot === "start" && isStart) || (activeSlot === "end" && isEnd)
                    ? "border-emerald-800"
                    : "border-stone-200",
                )}
              >
                <img src={image.url} alt={image.title} className="aspect-[4/5] w-full object-cover" />
                <div className="p-2">
                  <p className="line-clamp-1 text-xs font-semibold text-stone-900">{image.title}</p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {isStart ? "Start" : isEnd ? "End" : "Available"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-stone-300 bg-white px-3 py-4 text-sm text-stone-500">
          Generate still images first, then choose one as the video start frame.
        </div>
      )}
    </div>
  );
}

function aspectRatiosForVideoModel(modelId: string) {
  if (isKlingVideoModel(modelId)) return klingAspectRatios;
  if (isSeedanceVideoModel(modelId)) return seedanceAspectRatios;
  return wanAspectRatios;
}

function durationBoundsForVideoModel(modelId: string) {
  if (isKlingVideoModel(modelId)) return { min: 5, max: 10, step: 5 };
  if (isSeedanceVideoModel(modelId)) return { min: 4, max: 15, step: 1 };
  return { min: 3, max: 15, step: 1 };
}

function isKlingVideoModel(modelId: string) {
  return modelId === "kling" || modelId.startsWith("kling-");
}

function isSeedanceVideoModel(modelId: string) {
  return modelId === "seedance" || modelId.includes("seedance");
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
