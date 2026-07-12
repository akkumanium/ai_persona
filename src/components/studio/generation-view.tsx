import { AudioLines, Check, Clapperboard, Film, ImageIcon, Loader2, Pencil, Play, Trash2, Upload, Video, WandSparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { GenerationMode, SourceAudioInput, SourceImageInput, SourceVideoInput } from "@/components/studio/types";
import {
  CheckboxField,
  CardImage,
  DeferredVideo,
  ImageThumbStrip,
  MediaLightbox,
  ModelSelect,
  ModeToggle,
  NumberField,
  PanelTitle,
  PersonaSelect,
  RangeField,
  SelectField,
  SourceImageField,
  SubmitButton,
  TextArea,
  TextField,
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
import {
  defaultModelForCapability,
  modelsForCapability,
  motionControlsForModel,
  providerModeForVideoModel,
} from "@/lib/model-registry";
import { estimateImageGenerationPricing, estimateVideoGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { cn, formatTokens } from "@/lib/utils";

const klingAspectRatios = ["16:9", "9:16", "1:1"];
const seedanceAspectRatios = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const wanAspectRatios = ["16:9", "9:16", "1:1", "4:5", "3:4"];
const DEFAULT_MOTION_MODEL = defaultModelForCapability("video-motion") ?? "kling-v3-0-motion-std";
type PromptSuggestion = { title: string; prompt: string };
export function GenerationView({
  mode,
  personas,
  assets,
  jobs,
  selectedPersona,
  supabaseReady,
  imagePromptSuggestions = [],
  initialImageReference,
  initialVideoStartFrame,
  initialMotionImage,
  onGenerateVideoFromImage,
  onGenerateMotionFromImage,
  onGenerateAvatarFromImage,
  onAssetsCreated,
  onSelectPersona,
  onDeleteAsset,
}: {
  mode: GenerationMode;
  personas: Persona[];
  assets: Asset[];
  jobs: GenerationJob[];
  selectedPersona?: Persona;
  supabaseReady?: boolean;
  imagePromptSuggestions?: PromptSuggestion[];
  initialImageReference?: { id: string; nonce: number };
  initialVideoStartFrame?: { id: string; nonce: number };
  initialMotionImage?: { image: SourceImageInput; nonce: number };
  onGenerateVideoFromImage?: (asset: Asset) => void;
  onGenerateMotionFromImage?: (asset: Asset) => void;
  onGenerateAvatarFromImage?: (asset: Asset) => void;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageModel, setImageModel] = useState(NANO_BANANA_PRO_MODEL_ID);
  const [imageAspectRatio, setImageAspectRatio] = useState("4:5");
  const [imageSize, setImageSize] = useState("2K");
  const [imageQuality, setImageQuality] = useState("medium");
  const [uploadedImageReferences, setUploadedImageReferences] = useState<SourceImageInput[]>([]);
  const [videoModel, setVideoModel] = useState("wan-2.7");
  const [motionVideoModel, setMotionVideoModel] = useState(DEFAULT_MOTION_MODEL);
  const [referenceSelectionByPersona, setReferenceSelectionByPersona] = useState<Record<string, string[]>>({});
  const [videoStartFrameByPersona, setVideoStartFrameByPersona] = useState<Record<string, string | undefined>>({});
  const [uploadedVideoStartFrame, setUploadedVideoStartFrame] = useState<SourceImageInput | undefined>();
  const [uploadedVideoEndFrame, setUploadedVideoEndFrame] = useState<SourceImageInput | undefined>();
  const [seedanceReferenceVideo, setSeedanceReferenceVideo] = useState<SourceVideoInput | undefined>();
  const [seedanceReferenceAudio, setSeedanceReferenceAudio] = useState<SourceAudioInput | undefined>();
  const [previewAsset, setPreviewAsset] = useState<Asset | undefined>();
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(5);
  const [videoAspectRatio, setVideoAspectRatio] = useState("9:16");
  const [videoNegativePrompt, setVideoNegativePrompt] = useState("");
  const [videoCfgScale, setVideoCfgScale] = useState(0.5);
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(false);
  const [videoResolution, setVideoResolution] = useState<"480p" | "720p" | "1080p" | "4K">("720p");
  const [videoReturnLastFrame, setVideoReturnLastFrame] = useState(false);
  const [motionReference, setMotionReference] = useState("");
  const [motionNegativePrompt, setMotionNegativePrompt] = useState("");
  const [motionMode, setMotionMode] = useState<"animate" | "replace">("animate");
  const [motionCharacterOrientation, setMotionCharacterOrientation] = useState<"image" | "video">("video");
  const [motionKeepOriginalSound, setMotionKeepOriginalSound] = useState(true);
  const [motionReferenceImage, setMotionReferenceImage] = useState<SourceImageInput | undefined>();
  const [motionReferenceVideo, setMotionReferenceVideo] = useState<SourceVideoInput | undefined>();
  const [activeImageGenerations, setActiveImageGenerations] = useState(0);
  const [activeVideoGenerations, setActiveVideoGenerations] = useState(0);
  const [uploadingInputs, setUploadingInputs] = useState<Record<string, boolean>>({});
  const [generationError, setGenerationError] = useState("");
  const personaOptions = useMemo(() => personas, [personas]);
  const imageModelOptions = modelsForCapability("image-prompt");
  const videoModelOptions = modelsForCapability("video-normal");
  const motionModelOptions = modelsForCapability("video-motion");
  const motionControls = motionControlsForModel(motionVideoModel);
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
  const selectedVideoStartFrame = selectedPersona
    ? generatedImageAssets.find((asset) => asset.id === videoStartFrameByPersona[selectedPersona.id])
    : undefined;
  const normalVideoSupportsEndFrame = supportsEndFrame(videoModel);
  const startFrameImage = uploadedVideoStartFrame
    ? { url: sourceImageToDataUrl(uploadedVideoStartFrame), name: uploadedVideoStartFrame.name }
    : selectedVideoStartFrame
      ? { url: selectedVideoStartFrame.url, name: selectedVideoStartFrame.title }
      : undefined;
  const endFrameImage = uploadedVideoEndFrame
    ? { url: sourceImageToDataUrl(uploadedVideoEndFrame), name: uploadedVideoEndFrame.name }
    : undefined;
  const videoAspectRatioOptions = aspectRatiosForVideoModel(videoModel);
  const imageAspectRatioOptions = aspectRatiosForImageModel(imageModel);
  const safeImageAspectRatio = imageAspectRatioOptions.includes(imageAspectRatio)
    ? imageAspectRatio
    : imageAspectRatioOptions[0];
  const durationBounds = durationBoundsForVideoModel(videoModel);
  const safeVideoAspectRatio = videoAspectRatioOptions.includes(videoAspectRatio)
    ? videoAspectRatio
    : videoAspectRatioOptions[0];
  const safeVideoDuration = clampNumber(videoDurationSeconds, durationBounds.min, durationBounds.max);
  const videoResolutionOptionsForModel = resolutionsForVideoModel(videoModel);
  const safeVideoResolution = videoResolutionOptionsForModel.includes(videoResolution)
    ? videoResolution
    : videoResolutionOptionsForModel[0];
  const normalVideoRequiresStartFrame = requiresStartFrame(videoModel);
  const latestAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (asset.personaId !== selectedPersona?.id) return false;
        if (mode === "images") return asset.kind === "image";
        return asset.kind === "video" && asset.generationType !== "reference_upload";
      }),
    [assets, mode, selectedPersona?.id],
  );
  const persistedImageGenerations = jobs.filter(
    (job) =>
      job.personaId === selectedPersona?.id &&
      (job.status === "queued" || job.status === "running") &&
      (job.generationType === "image_from_prompt" || job.generationType === "image_from_reference"),
  ).length;
  const persistedVideoGenerations = jobs.filter(
    (job) =>
      job.personaId === selectedPersona?.id &&
      (job.status === "queued" || job.status === "running") &&
      (job.generationType === "video_normal" || job.generationType === "video_motion" || job.generationType === "video_prompt"),
  ).length;
  const isGeneratingImage = activeImageGenerations + persistedImageGenerations > 0;
  const isGeneratingVideo = activeVideoGenerations + persistedVideoGenerations > 0;
  const isGenerating = mode === "images" ? isGeneratingImage : isGeneratingVideo;
  const imageModelSupportsSize = supportsImageSize(imageModel);
  const imageModelSupportsQuality = supportsImageQuality(imageModel);
  const imageModelSupportsReferences = supportsImageReferences(imageModel);
  const imageModelRequiresReferences = requiresImageReferences(imageModel);
  // References are now always "on" by default when the model supports them.
  // The user opts out by deselecting every reference tile (selectedReferenceSelection becomes empty),
  // at which point the request falls through to prompt-only generation.
  const useImageReferences = imageModelSupportsReferences;
  const totalReferenceCount = selectedReferenceSelection.length + uploadedImageReferences.length;
  const imageCostLabel = formatTokens(
    estimateImageGenerationPricing({
      prompt: imagePrompt,
      model: imageModel,
      aspectRatio: safeImageAspectRatio,
      imageSize: imageModelSupportsSize ? imageSize : "2K",
      imageQuality: imageModelSupportsQuality ? (imageQuality as "low" | "medium" | "high") : undefined,
      count: 1,
      referenceImages: useImageReferences
        ? Array.from({ length: totalReferenceCount }, (_, index) => ({
            name: `reference-${index + 1}`,
            mimeType: "image/png",
            data: "x",
          }))
        : [],
      generationType: useImageReferences && totalReferenceCount > 0 ? "image_from_reference" : "image_from_prompt",
    }).tokens,
  );
  const normalVideoCostLabel = formatTokens(
    estimateVideoGenerationPricing({
      prompt: videoPrompt,
      model: videoModel,
      mode: "normal",
      durationSeconds: safeVideoDuration,
      aspectRatio: safeVideoAspectRatio,
      negativePrompt: videoNegativePrompt,
      providerMode: providerModeForVideoModel(videoModel, "std"),
      cfgScale: videoCfgScale,
      generateAudio: videoGenerateAudio,
      resolution: safeVideoResolution,
      returnLastFrame: videoReturnLastFrame,
      endFrameImageUrl: normalVideoSupportsEndFrame ? uploadedVideoEndFrame?.url : undefined,
    }).tokens,
  );

  const [appliedImageReferenceNonce, setAppliedImageReferenceNonce] = useState<number | undefined>();
  if (initialImageReference && initialImageReference.nonce !== appliedImageReferenceNonce) {
    setAppliedImageReferenceNonce(initialImageReference.nonce);
    const asset = assets.find((candidate) => candidate.id === initialImageReference.id);
    if (asset) {
      setUploadedImageReferences((current) => {
        if (current.some((image) => image.url === asset.url)) return current;
        return [
          ...current,
          {
            name: asset.title || "Reference image",
            mimeType: asset.mimeType || "image/png",
            url: asset.url,
          },
        ].slice(0, 8);
      });
    }
  }
  const motionVideoCostLabel = formatTokens(
    estimateVideoGenerationPricing({
      prompt: videoPrompt,
      model: motionVideoModel,
      mode: "motion",
      durationSeconds: 5,
      aspectRatio: "9:16",
      resolution: "720p",
      motionReference: motionControls.supportsMotionReference ? motionReference : "",
      motionMode: motionControls.supportsMotionMode ? motionMode : "animate",
      characterOrientation: motionControls.supportsCharacterOrientation ? motionCharacterOrientation : "video",
      keepOriginalSound: motionControls.supportsKeepOriginalSound ? motionKeepOriginalSound : false,
      negativePrompt: motionControls.supportsNegativePrompt ? motionNegativePrompt : "",
    }).tokens,
  );

  const [appliedVideoStartFrameNonce, setAppliedVideoStartFrameNonce] = useState<number | undefined>();
  if (initialVideoStartFrame && initialVideoStartFrame.nonce !== appliedVideoStartFrameNonce) {
    setAppliedVideoStartFrameNonce(initialVideoStartFrame.nonce);
    setUploadedVideoStartFrame(undefined);
    if (selectedPersona) {
      setVideoStartFrameByPersona((current) => ({
        ...current,
        [selectedPersona.id]: initialVideoStartFrame.id,
      }));
    }
  }

  const [appliedMotionImageNonce, setAppliedMotionImageNonce] = useState<number | undefined>();
  if (initialMotionImage && initialMotionImage.nonce !== appliedMotionImageNonce) {
    setAppliedMotionImageNonce(initialMotionImage.nonce);
    setMotionReferenceImage(initialMotionImage.image);
  }

  function changeImageModel(modelId: string) {
    setImageModel(modelId);
    const nextAspectRatios = aspectRatiosForImageModel(modelId);
    if (!nextAspectRatios.includes(imageAspectRatio)) {
      setImageAspectRatio(nextAspectRatios.includes("4:5") ? "4:5" : nextAspectRatios[0]);
    }
    const nextImageSizes = imageSizesForModel(modelId);
    if (!nextImageSizes.includes(imageSize)) {
      setImageSize(nextImageSizes[0]);
    }
  }

  function applyRandomImagePrompt() {
    if (!imagePromptSuggestions.length) return;
    const nextPrompt = imagePromptSuggestions[Math.floor(Math.random() * imagePromptSuggestions.length)];
    setImagePrompt(nextPrompt.prompt);
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

  function clearVideoStartFrame() {
    setUploadedVideoStartFrame(undefined);
    if (selectedPersona) {
      setVideoStartFrameByPersona((current) => ({ ...current, [selectedPersona.id]: undefined }));
    }
  }

  function clearVideoEndFrame() {
    setUploadedVideoEndFrame(undefined);
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
    const nextResolutions = resolutionsForVideoModel(modelId);
    if (!nextResolutions.includes(videoResolution)) {
      setVideoResolution(nextResolutions.includes("720p") ? "720p" : nextResolutions[0]);
    }
    if (!supportsEndFrame(modelId)) {
      setUploadedVideoEndFrame(undefined);
    }
  }

  async function generateImage(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona) return;
    const referenceAssets = useImageReferences ? selectedReferenceSelection : [];
    const uploadedReferences = useImageReferences ? uploadedImageReferences : [];
    if (imagePrompt.trim().length < 10) return;
    const uploadedReferenceUrls = uploadedReferences.map((image) => image.url).filter((url): url is string => Boolean(url));
    const uploadedReferenceInputs = uploadedReferences
      .filter((image) => image.data)
      .map((image) => ({ name: image.name, mimeType: image.mimeType, data: image.data ?? "" }));
    const referenceImageUrls = [...referenceAssets.map((asset) => asset.url), ...uploadedReferenceUrls];
    setActiveImageGenerations((current) => current + 1);
    setGenerationError("");
    try {
      const requestBody = {
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        prompt: imagePrompt,
        model: imageModel,
        styleNotes: selectedPersona.styleNotes,
        aspectRatio: safeImageAspectRatio,
        imageSize: imageModelSupportsSize ? imageSize : "2K",
        imageQuality: imageModelSupportsQuality ? imageQuality : undefined,
        count: 1,
        ...(referenceImageUrls.length
          ? { referenceImageUrl: referenceImageUrls[0], referenceImageUrls }
          : {}),
        ...(uploadedReferenceInputs.length ? { sourceImages: uploadedReferenceInputs } : {}),
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
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setActiveImageGenerations((current) => Math.max(0, current - 1));
    }
  }

  async function generateVideo(event: FormEvent, mode: "normal" | "motion") {
    event.preventDefault();
    if (!selectedPersona) return;
    const startFrameAsset = mode === "normal" ? selectedVideoStartFrame : undefined;
    const uploadedStartFrameUrl = mode === "normal" && uploadedVideoStartFrame ? uploadedVideoStartFrame.url : undefined;
    const uploadedEndFrameUrl =
      mode === "normal" && normalVideoSupportsEndFrame && uploadedVideoEndFrame
        ? uploadedVideoEndFrame.url
        : undefined;
    const uploadedStartFrameInput =
      mode === "normal" && uploadedVideoStartFrame?.data
        ? { name: uploadedVideoStartFrame.name, mimeType: uploadedVideoStartFrame.mimeType, data: uploadedVideoStartFrame.data }
        : undefined;
    const uploadedEndFrameInput =
      mode === "normal" && normalVideoSupportsEndFrame && uploadedVideoEndFrame?.data
        ? { name: uploadedVideoEndFrame.name, mimeType: uploadedVideoEndFrame.mimeType, data: uploadedVideoEndFrame.data }
        : undefined;
    if (mode === "normal" && normalVideoRequiresStartFrame && !startFrameAsset && !uploadedStartFrameUrl) return;
    const referenceImageUrl =
      mode === "motion" ? motionReferenceImage?.url : uploadedStartFrameUrl ?? startFrameAsset?.url;
    const requestReferenceImageUrl = uploadedStartFrameInput ? undefined : referenceImageUrl;
    if (mode === "motion" && !referenceImageUrl) return;
    setActiveVideoGenerations((current) => current + 1);
    setGenerationError("");
    try {
      const requestBody = {
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        prompt: videoPrompt,
        mode,
        model: mode === "motion" ? motionVideoModel : videoModel,
        durationSeconds: mode === "normal" ? safeVideoDuration : 5,
        aspectRatio: mode === "normal" ? safeVideoAspectRatio : "9:16",
        negativePrompt: mode === "normal"
          ? videoNegativePrompt
          : motionControls.supportsNegativePrompt
            ? motionNegativePrompt
            : "",
        providerMode: mode === "normal" ? providerModeForVideoModel(videoModel, "std") : providerModeForVideoModel(motionVideoModel, "std"),
        cfgScale: mode === "normal" ? videoCfgScale : 0.5,
        generateAudio: mode === "normal" ? videoGenerateAudio : false,
        resolution: mode === "normal" ? safeVideoResolution : "720p",
        returnLastFrame: mode === "normal" ? videoReturnLastFrame : false,
        motionReference: mode === "motion" && motionControls.supportsMotionReference ? motionReference : "",
        motionMode: mode === "motion" && motionControls.supportsMotionMode ? motionMode : "animate",
        characterOrientation: mode === "motion" && motionControls.supportsCharacterOrientation ? motionCharacterOrientation : "video",
        keepOriginalSound: mode === "motion" && motionControls.supportsKeepOriginalSound ? motionKeepOriginalSound : false,
        motionReferenceVideo: mode === "motion" && motionReferenceVideo?.data ? motionReferenceVideo : undefined,
        motionReferenceVideoUrl: mode === "motion" ? motionReferenceVideo?.url : undefined,
        referenceVideo:
          mode === "normal" && isSeedanceVideoModel(videoModel) && seedanceReferenceVideo?.data
            ? seedanceReferenceVideo
            : undefined,
        referenceVideoUrl:
          mode === "normal" && isSeedanceVideoModel(videoModel) ? seedanceReferenceVideo?.url : undefined,
        referenceAudio:
          mode === "normal" && isSeedanceVideoModel(videoModel) && seedanceReferenceAudio?.data
            ? seedanceReferenceAudio
            : undefined,
        referenceAudioUrl:
          mode === "normal" && isSeedanceVideoModel(videoModel) ? seedanceReferenceAudio?.url : undefined,
        ...(requestReferenceImageUrl ? { referenceImageUrl: requestReferenceImageUrl, startFrameImageUrl: requestReferenceImageUrl } : {}),
        ...(uploadedStartFrameInput ? { startFrameImage: uploadedStartFrameInput } : {}),
        ...(mode === "normal" && normalVideoSupportsEndFrame && uploadedEndFrameUrl
          ? { endFrameImageUrl: uploadedEndFrameInput ? undefined : uploadedEndFrameUrl }
          : {}),
        ...(uploadedEndFrameInput ? { endFrameImage: uploadedEndFrameInput } : {}),
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
          ? [uploadedStartFrameUrl ? undefined : startFrameAsset?.id].filter((id): id is string => Boolean(id))
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
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setActiveVideoGenerations((current) => Math.max(0, current - 1));
    }
  }

  async function captureMotionReferenceImage(files: FileList | null) {
    await withUploadState("motionReferenceImage", async () => {
      const [image] = await encodeFiles(files, "image/png");
      setMotionReferenceImage(image);
    });
  }

  async function captureUploadedImageReferences(files: FileList | null) {
    await withUploadState("imageReferences", async () => {
      const images = await encodeFiles(files, "image/png", {
        enabled: supabaseReady,
        bucket: "uploads",
        folder: `image-references/${selectedPersona?.id ?? "unassigned"}`,
      });
      setUploadedImageReferences((current) => [...current, ...images].slice(0, 8));
    });
  }

  function removeUploadedImageReference(index: number) {
    setUploadedImageReferences((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addGeneratedImageReference(asset: Asset) {
    setUploadedImageReferences((current) => {
      if (current.some((image) => image.url === asset.url)) return current;
      return [
        ...current,
        {
          name: "Reference image",
          mimeType: asset.mimeType || "image/png",
          url: asset.url,
        },
      ].slice(0, 8);
    });
  }

  async function captureVideoFrame(files: FileList | null, slot: "start" | "end") {
    await withUploadState(slot === "start" ? "videoStartFrame" : "videoEndFrame", async () => {
      const [image] = await encodeFiles(files, "image/png");
      if (slot === "start") {
        setUploadedVideoStartFrame(image);
        return;
      }

      setUploadedVideoEndFrame(image);
    });
  }

  async function captureMotionReferenceVideo(files: FileList | null) {
    await withUploadState("motionReferenceVideo", async () => {
      const [video] = await encodeFiles(files, "video/mp4");
      setMotionReferenceVideo(
        video ? { name: video.name, mimeType: video.mimeType, data: video.data, url: video.url } : undefined,
      );
    });
  }

  async function captureSeedanceReferenceVideo(files: FileList | null) {
    await withUploadState("seedanceReferenceVideo", async () => {
      const [video] = await encodeFiles(files, "video/mp4");
      setSeedanceReferenceVideo(
        video ? { name: video.name, mimeType: video.mimeType, data: video.data, url: video.url } : undefined,
      );
    });
  }

  async function captureSeedanceReferenceAudio(files: FileList | null) {
    await withUploadState("seedanceReferenceAudio", async () => {
      const [audio] = await encodeFiles(files, "audio/mpeg");
      setSeedanceReferenceAudio(
        audio ? { name: audio.name, mimeType: audio.mimeType, data: audio.data, url: audio.url } : undefined,
      );
    });
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      {previewAsset ? (
        <MediaLightbox
          src={previewAsset.url}
          title={previewAsset.title}
          kind={previewAsset.kind === "video" ? "video" : "image"}
          onClose={() => setPreviewAsset(undefined)}
        />
      ) : null}
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={PanelIcon} title={`${panelTitle} Result`} />

        <div className="mt-4 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-800/20 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              <Loader2 className="size-4 animate-spin" />
              {mode === "images"
                ? activeImageGenerations + persistedImageGenerations
                : activeVideoGenerations + persistedVideoGenerations} generation
              {(mode === "images"
                ? activeImageGenerations + persistedImageGenerations
                : activeVideoGenerations + persistedVideoGenerations) === 1 ? "" : "s"} running.
            </div>
          ) : null}
          {latestAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {latestAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="group overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <div className="relative aspect-[4/5] bg-stone-100">
                    {asset.kind === "video" ? (
                      <DeferredVideo
                        src={asset.url}
                        title={asset.title}
                        className="h-full w-full object-cover"
                        onOpen={() => setPreviewAsset(asset)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewAsset(asset)}
                        className="block h-full w-full"
                        aria-label="Open image fullscreen"
                      >
                        <CardImage src={asset.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition hover:bg-red-700 group-hover:opacity-100"
                      aria-label={`Delete ${asset.kind}`}
                    >
                      <Trash2 size={15} />
                    </button>
                    {asset.kind === "image" ? (
                      <button
                        type="button"
                        onClick={() => addGeneratedImageReference(asset)}
                        className="absolute left-2 top-2 flex h-8 items-center gap-1.5 rounded-md bg-black/50 px-2 text-xs font-semibold text-white opacity-0 transition hover:bg-emerald-800 group-hover:opacity-100"
                        aria-label="Use image as a reference"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                    ) : null}
                  </div>
                  <div className="p-3">
                    {asset.kind !== "image" ? (
                      <p className="line-clamp-1 text-sm font-semibold text-stone-950">{asset.title}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-stone-500">{asset.model}</p>
                    {asset.prompt ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-stone-600">{asset.prompt}</p>
                    ) : null}
                    {mode === "images" ? (
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onGenerateVideoFromImage?.(asset)}
                          className="flex h-8 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
                          aria-label="Generate a video from this image"
                        >
                          <Clapperboard size={13} />
                          Video
                        </button>
                        <button
                          type="button"
                          onClick={() => onGenerateMotionFromImage?.(asset)}
                          className="flex h-8 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
                          aria-label="Generate motion control from this image"
                        >
                          <Film size={13} />
                          Motion
                        </button>
                        <button
                          type="button"
                          onClick={() => onGenerateAvatarFromImage?.(asset)}
                          className="flex h-8 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
                          aria-label="Generate a talking avatar from this image"
                        >
                          <Video size={13} />
                          Avatar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : !isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <PanelIcon className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">Ready when you are</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">{emptyCopy}</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        {mode === "images" ? (
          <form onSubmit={generateImage}>
            <PanelTitle icon={ImageIcon} title="Image Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect label="Model" value={imageModel} options={imageModelOptions} onChange={changeImageModel} />
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <SelectField
                label="Aspect ratio"
                value={safeImageAspectRatio}
                options={imageAspectRatioOptions}
                onChange={setImageAspectRatio}
              />
              {imageModelSupportsSize ? (
                <SelectField label="Resolution" value={imageSize} options={imageSizesForModel(imageModel)} onChange={setImageSize} />
              ) : (
                <div />
              )}
            </div>
            {imageModelSupportsQuality ? (
              <SelectField label="Quality" value={imageQuality} options={chatGptImageQualities} onChange={setImageQuality} />
            ) : null}

            {imageModelSupportsReferences ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-stone-700">References</p>
                  <span className="text-[11px] text-stone-500">
                    {totalReferenceCount > 0
                      ? `${totalReferenceCount} selected`
                      : "none — prompt only"}
                  </span>
                </div>
                <UploadBox
                  accept="image/*"
                  multiple
                  compact
                  icon={Upload}
                  label={uploadedImageReferences.length ? "Add more references" : "Upload references"}
                  loading={Boolean(uploadingInputs.imageReferences)}
                  onChange={(files) => void captureUploadedImageReferences(files)}
                />
                <ImageThumbStrip images={uploadedImageReferences} onRemove={removeUploadedImageReference} />
                {selectedReferenceAssets.length ? (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {selectedReferenceAssets.map((asset) => {
                      const isSelected = selectedReferenceIds.includes(asset.id);
                      return (
                        <button
                          type="button"
                          key={asset.id}
                          onClick={() => toggleReferenceSelection(asset.id)}
                          title="Reference image"
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-md border bg-stone-100 transition",
                            isSelected
                              ? "border-emerald-800 ring-1 ring-emerald-800"
                              : "border-stone-200 opacity-55 hover:opacity-100 hover:border-emerald-800",
                          )}
                        >
                          <CardImage src={asset.url} alt="" className="h-full w-full object-cover" />
                          <span
                            className={cn(
                              "absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border transition",
                              isSelected
                                ? "border-emerald-800 bg-emerald-800 text-white"
                                : "border-white/60 bg-black/30 text-transparent group-hover:border-white/80",
                            )}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {asset.isDefaultReference ? (
                            <span className="absolute bottom-1 left-1 rounded-sm bg-black/55 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                              Default
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
                    No persona references yet. Add references from the persona manager.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                This model is prompt-only, so reference images are not used.
              </p>
            )}

            <TextArea
              label="Image prompt"
              value={imagePrompt}
              onChange={setImagePrompt}
              rows={5}
              action={
                <button
                  type="button"
                  onClick={applyRandomImagePrompt}
                  disabled={!imagePromptSuggestions.length}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-stone-200 px-2 text-[11px] font-semibold text-stone-600 transition hover:border-emerald-800 hover:text-stone-950 disabled:opacity-50"
                >
                  <WandSparkles size={12} />
                  Magic
                </button>
              }
            />
            {generationError ? (
              <p className="mt-2.5 rounded-md bg-red-50 p-2.5 text-xs text-red-700">{generationError}</p>
            ) : null}
            <SubmitButton
              loading={isGeneratingImage}
              icon={ImageIcon}
              label="Generate images"
              costLabel={imageCostLabel}
              disableWhileLoading={false}
              disabled={!selectedPersona || imagePrompt.trim().length < 10 || (imageModelRequiresReferences && totalReferenceCount === 0)}
            />
          </form>
        ) : null}

        {mode === "videos" ? (
          <form onSubmit={(event) => void generateVideo(event, "normal")}>
            <PanelTitle icon={Clapperboard} title="Video Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect label="Model" value={videoModel} options={videoModelOptions} onChange={changeVideoModel} />
            <SourceImageField
              label="Start frame"
              image={startFrameImage}
              onClear={clearVideoStartFrame}
              onUpload={(files) => void captureVideoFrame(files, "start")}
              loading={Boolean(uploadingInputs.videoStartFrame)}
              hint={
                normalVideoRequiresStartFrame
                  ? "Required for this model — pick one from Images or upload."
                  : "Optional first frame — pick one from Images or upload."
              }
            />
            {normalVideoSupportsEndFrame ? (
              <SourceImageField
                label="End frame"
                image={endFrameImage}
                onClear={clearVideoEndFrame}
                onUpload={(files) => void captureVideoFrame(files, "end")}
                loading={Boolean(uploadingInputs.videoEndFrame)}
                hint="Optional last frame."
              />
            ) : null}
            {isSeedanceVideoModel(videoModel) ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <UploadBox
                  accept="video/*"
                  compact
                  icon={Clapperboard}
                  label={seedanceReferenceVideo?.name ?? "Reference video"}
                  detail={seedanceReferenceVideo ? "Ready" : "Optional; up to 15s"}
                  loading={Boolean(uploadingInputs.seedanceReferenceVideo)}
                  onChange={(files) => void captureSeedanceReferenceVideo(files)}
                />
                <UploadBox
                  accept="audio/*"
                  compact
                  icon={AudioLines}
                  label={seedanceReferenceAudio?.name ?? "Reference audio"}
                  detail={seedanceReferenceAudio ? "Ready" : "Optional; up to 15s"}
                  loading={Boolean(uploadingInputs.seedanceReferenceAudio)}
                  onChange={(files) => void captureSeedanceReferenceAudio(files)}
                />
              </div>
            ) : null}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
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
            </div>
            {showsResolutionControl(videoModel) ? (
              <SelectField
                label="Resolution"
                value={safeVideoResolution}
                options={videoResolutionOptionsForModel}
                onChange={(value) => setVideoResolution(value as "480p" | "720p" | "1080p" | "4K")}
              />
            ) : null}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {supportsCfgScale(videoModel) ? (
                <RangeField label="CFG" value={videoCfgScale} min={0} max={1} step={0.05} onChange={setVideoCfgScale} />
              ) : (
                <div />
              )}
              <div className="flex flex-col gap-2">
                {isSeedanceVideoModel(videoModel) ? (
                  <CheckboxField label="Return last frame" checked={videoReturnLastFrame} onChange={setVideoReturnLastFrame} />
                ) : null}
                {supportsGeneratedAudio(videoModel) ? (
                  <CheckboxField label="Generate audio" checked={videoGenerateAudio} onChange={setVideoGenerateAudio} />
                ) : null}
              </div>
            </div>
            <TextArea label="Video prompt" value={videoPrompt} onChange={setVideoPrompt} rows={4} />
            <TextArea label="Negative prompt" value={videoNegativePrompt} onChange={setVideoNegativePrompt} rows={2} />
            {generationError ? (
              <p className="mt-2.5 rounded-md bg-red-50 p-2.5 text-xs text-red-700">{generationError}</p>
            ) : null}
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate video"
              costLabel={normalVideoCostLabel}
              disableWhileLoading={false}
              disabled={!selectedPersona || (normalVideoRequiresStartFrame && !startFrameImage)}
            />
          </form>
        ) : null}

        {mode === "motion" ? (
          <form onSubmit={(event) => void generateVideo(event, "motion")}>
            <PanelTitle icon={Play} title="Motion Options" />
            <PersonaSelect personas={personaOptions} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
            <ModelSelect
              label="Model"
              value={motionVideoModel}
              options={motionModelOptions}
              onChange={setMotionVideoModel}
            />
            <SourceImageField
              label="Character image"
              image={
                motionReferenceImage
                  ? { url: sourceImageToDataUrl(motionReferenceImage), name: motionReferenceImage.name }
                  : undefined
              }
              onClear={() => setMotionReferenceImage(undefined)}
              onUpload={(files) => void captureMotionReferenceImage(files)}
              loading={Boolean(uploadingInputs.motionReferenceImage)}
              hint="The identity to animate — pick one from Images or upload."
            />
            <UploadBox
              accept="video/*"
              compact
              icon={Clapperboard}
              label={motionReferenceVideo ? motionReferenceVideo.name : "Upload motion video to imitate"}
              loading={Boolean(uploadingInputs.motionReferenceVideo)}
              onChange={(files) => void captureMotionReferenceVideo(files)}
            />
            <TextArea label="Video prompt" value={videoPrompt} onChange={setVideoPrompt} rows={4} />
            {motionControls.supportsMotionMode ? (
                <ModeToggle
                  label="Wan mode"
                  value={motionMode}
                  options={[
                    { value: "animate", label: "Animate" },
                    { value: "replace", label: "Replace" },
                  ]}
                  onChange={(value) => setMotionMode(value as "animate" | "replace")}
                />
            ) : null}
            {motionControls.supportsMotionReference ? (
                <TextField label="Motion reference" value={motionReference} onChange={setMotionReference} />
            ) : null}
            {motionControls.supportsCharacterOrientation ? (
                <ModeToggle
                  label="Orientation"
                  value={motionCharacterOrientation}
                  options={[
                    { value: "video", label: "Video" },
                    { value: "image", label: "Image" },
                  ]}
                  onChange={(value) => setMotionCharacterOrientation(value as "image" | "video")}
                />
            ) : null}
            {motionControls.supportsKeepOriginalSound ? (
                <CheckboxField label="Keep original sound" checked={motionKeepOriginalSound} onChange={setMotionKeepOriginalSound} />
            ) : null}
            {motionControls.supportsNegativePrompt ? (
                <TextArea label="Negative prompt" value={motionNegativePrompt} onChange={setMotionNegativePrompt} rows={2} />
            ) : null}
            {generationError ? (
              <p className="mt-2.5 rounded-md bg-red-50 p-2.5 text-xs text-red-700">{generationError}</p>
            ) : null}
            <SubmitButton
              loading={isGeneratingVideo}
              icon={Play}
              label="Generate video"
              costLabel={motionVideoCostLabel}
              disableWhileLoading={false}
              disabled={!selectedPersona || !motionReferenceImage || !motionReferenceVideo}
            />
          </form>
        ) : null}
      </aside>
    </div>
  );
}

function aspectRatiosForVideoModel(modelId: string) {
  if (isKlingVideoModel(modelId)) return klingAspectRatios;
  if (isSeedanceVideoModel(modelId)) return seedanceAspectRatios;
  return wanAspectRatios;
}

function durationBoundsForVideoModel(modelId: string) {
  if (isKling30VideoModel(modelId)) return { min: 3, max: 15, step: 1 };
  if (isKlingVideoModel(modelId)) return { min: 5, max: 10, step: 5 };
  if (isSeedanceVideoModel(modelId)) return { min: 4, max: 15, step: 1 };
  if (modelId === "wan-2.7") return { min: 3, max: 15, step: 1 };
  return { min: 3, max: 15, step: 1 };
}

function isKlingVideoModel(modelId: string) {
  return modelId === "kling" || modelId.startsWith("kling-");
}

function isKling30VideoModel(modelId: string) {
  return modelId === "kling-v3" || modelId === "kling-v3-0" || modelId.startsWith("kling-v3-0");
}

function isSeedanceVideoModel(modelId: string) {
  return modelId === "seedance" || modelId.includes("seedance");
}

function showsResolutionControl(modelId: string) {
  return isSeedanceVideoModel(modelId) || modelId === "wan-2.7" || (isKling30VideoModel(modelId) && !modelId.includes("motion"));
}

function resolutionsForVideoModel(modelId: string): Array<"480p" | "720p" | "1080p" | "4K"> {
  if (modelId.includes("seedance") && modelId.includes("fast")) return ["480p", "720p"];
  if (isSeedanceVideoModel(modelId)) return ["480p", "720p", "1080p"];
  if (modelId === "wan-animate") return ["480p", "720p"];
  if (modelId === "wan-2.7") return ["720p", "1080p"];
  if (isKling30VideoModel(modelId)) return ["720p", "1080p", "4K"];
  return ["720p"];
}

function requiresStartFrame(modelId: string) {
  return isKlingVideoModel(modelId);
}

function supportsEndFrame(modelId: string) {
  return (
    modelId === "kling-v2-6-pro" ||
    modelId === "kling-v3-0-std" ||
    modelId === "kling-v3-0-pro" ||
    modelId === "kling-v3-0-4k" ||
    isSeedanceVideoModel(modelId)
  );
}

function supportsCfgScale(modelId: string) {
  return modelId === "kling-v2-6-pro" || (isKling30VideoModel(modelId) && !modelId.includes("motion"));
}

function supportsGeneratedAudio(modelId: string) {
  return modelId === "kling-v2-6-pro" || (isKling30VideoModel(modelId) && !modelId.includes("motion")) || isSeedanceVideoModel(modelId);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
