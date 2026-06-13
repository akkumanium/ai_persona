import { AudioLines, Clapperboard, Loader2, MessageSquareText, Trash2, Upload, Video } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import type { SourceAudioInput, SourceImageInput } from "@/components/studio/types";
import {
  ModelSelect,
  PanelTitle,
  PersonaSelect,
  RangeField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
  UploadBox,
} from "@/components/studio/ui";
import { estimateAvatarGenerationPricing, estimateSpeechGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { formatTokens } from "@/lib/utils";

const speechModels = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
];
const outputFormats = ["mp3_44100_128", "mp3_44100_192", "wav_44100"];
const avatarResolutions = ["480p", "720p"];

export function SpeechView({
  personas,
  assets,
  selectedPersona,
  onAssetsCreated,
  onSelectPersona,
  onDeleteAsset,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  const [text, setText] = useState("A short reusable voice line for the next avatar clip.");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState<"eleven_multilingual_v2">("eleven_multilingual_v2");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const latestAudio = useMemo(
    () => assets.filter((asset) => asset.personaId === selectedPersona?.id && asset.kind === "audio"),
    [assets, selectedPersona?.id],
  );
  const costLabel = formatTokens(estimateSpeechGenerationPricing({ text }).tokens);

  async function generateSpeech(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !voiceId.trim() || !text.trim()) return;
    setIsGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/generate/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
          text,
          voiceId: voiceId.trim(),
          model,
          outputFormat,
          stability,
          similarityBoost,
          style,
          speed,
          useSpeakerBoost: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Speech generation failed.");
      }
      onAssetsCreated([payload.asset], payload.job);
    } catch (speechError) {
      setError(speechError instanceof Error ? speechError.message : "Speech generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={AudioLines} title="Speech Assets" />
        <div className="mt-5 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-sm text-stone-600">
              <Loader2 className="mb-3 animate-spin text-emerald-800" size={28} />
              Waiting for ElevenLabs audio.
            </div>
          ) : latestAudio.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {latestAudio.slice(0, 9).map((asset) => (
                <article key={asset.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
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
                  <audio src={asset.url} className="mt-4 w-full" controls />
                  {asset.prompt ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-stone-600">{asset.prompt}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <AudioLines className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">Ready for voice IDs</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                Generated speech will appear here as reusable audio assets.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        <form onSubmit={generateSpeech}>
          <PanelTitle icon={MessageSquareText} title="Speech Options" />
          <PersonaSelect personas={personas} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
          <TextField label="Voice ID" value={voiceId} onChange={setVoiceId} />
          <ModelSelect label="Model" value={model} options={speechModels} onChange={(id) => setModel(id as typeof model)} />
          <SelectField label="Output" value={outputFormat} options={outputFormats} onChange={setOutputFormat} />
          <RangeField label="Stability" value={stability} min={0} max={1} step={0.05} onChange={setStability} />
          <RangeField label="Similarity" value={similarityBoost} min={0} max={1} step={0.05} onChange={setSimilarityBoost} />
          <RangeField label="Style" value={style} min={0} max={1} step={0.05} onChange={setStyle} />
          <RangeField label="Speed" value={speed} min={0.7} max={1.2} step={0.05} onChange={setSpeed} />
          <TextArea label="Text" value={text} onChange={setText} rows={7} />
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <SubmitButton
            loading={isGenerating}
            icon={AudioLines}
            label="Generate speech"
            costLabel={costLabel}
            disabled={!selectedPersona || !voiceId.trim() || !text.trim()}
          />
        </form>
      </aside>
    </div>
  );
}

export function AvatarView({
  personas,
  assets,
  selectedPersona,
  onAssetsCreated,
  onSelectPersona,
  onDeleteAsset,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  onAssetsCreated: (assets: Asset[], job: GenerationJob) => void;
  onSelectPersona: (id: string) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  const imageAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.personaId === selectedPersona?.id &&
          (asset.kind === "avatar" || asset.kind === "upload" || asset.kind === "image"),
      ),
    [assets, selectedPersona?.id],
  );
  const audioAssets = useMemo(
    () => assets.filter((asset) => asset.personaId === selectedPersona?.id && asset.kind === "audio"),
    [assets, selectedPersona?.id],
  );
  const avatarAssets = useMemo(
    () => assets.filter((asset) => asset.personaId === selectedPersona?.id && asset.generationType === "avatar_talking"),
    [assets, selectedPersona?.id],
  );
  const [imageAssetId, setImageAssetId] = useState("");
  const [uploadedImage, setUploadedImage] = useState<SourceImageInput | undefined>();
  const [audioAssetId, setAudioAssetId] = useState("");
  const [uploadedAudio, setUploadedAudio] = useState<SourceAudioInput | undefined>();
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | undefined>();
  const [isReadingDuration, setIsReadingDuration] = useState(false);
  const [prompt, setPrompt] = useState("Natural talking head, subtle expression, steady camera.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const selectedImage = imageAssets.find((asset) => asset.id === imageAssetId) ?? imageAssets[0];
  const selectedAudio = audioAssets.find((asset) => asset.id === audioAssetId) ?? audioAssets[0];
  const selectedImageUrl = uploadedImage ? sourceImageToDataUrl(uploadedImage) : selectedImage?.url;
  const selectedAudioSource = uploadedAudio?.url ?? (uploadedAudio?.data ? `data:${uploadedAudio.mimeType};base64,${uploadedAudio.data}` : selectedAudio?.url);
  const effectiveDurationSeconds = audioDurationSeconds ? Math.max(1, Math.ceil(audioDurationSeconds)) : 0;
  const costLabel = audioDurationSeconds
    ? formatTokens(estimateAvatarGenerationPricing({ resolution, durationSeconds: effectiveDurationSeconds }).tokens)
    : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!selectedAudioSource) {
      setTimeout(() => {
        if (!cancelled) {
          setAudioDurationSeconds(undefined);
          setIsReadingDuration(false);
        }
      }, 0);
      return;
    }

    Promise.resolve()
      .then(() => {
        if (!cancelled) setIsReadingDuration(true);
        return getMediaDurationFromUrl(selectedAudioSource);
      })
      .then((duration) => {
        if (!cancelled) setAudioDurationSeconds(duration);
      })
      .catch(() => {
        if (!cancelled) setAudioDurationSeconds(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsReadingDuration(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAudioSource]);

  async function captureImage(files: FileList | null) {
    const [image] = await encodeFiles(files, "image/png");
    setUploadedImage(image);
  }

  async function captureAudio(files: FileList | null) {
    const [audio] = await encodeFiles(files, "audio/mpeg");
    setUploadedAudio(audio ? { name: audio.name, mimeType: audio.mimeType, data: audio.data, url: audio.url } : undefined);
    setAudioAssetId("");
  }

  async function generateAvatar(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !selectedImageUrl || !selectedAudioSource || !effectiveDurationSeconds) return;
    setIsGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/generate/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
          imageAssetUrl: selectedImageUrl,
          imageAssetId: uploadedImage ? undefined : selectedImage?.id,
          audioAssetUrl: uploadedAudio ? undefined : selectedAudio?.url,
          audioAssetId: uploadedAudio ? undefined : selectedAudio?.id,
          uploadedAudio,
          prompt,
          resolution,
          durationSeconds: effectiveDurationSeconds,
          seed: -1,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Avatar generation failed.");
      }
      onAssetsCreated(payload.asset ? [payload.asset] : [], payload.job);
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Video} title="Avatar Results" />
        <div className="mt-5 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-sm text-stone-600">
              <Loader2 className="mb-3 animate-spin text-emerald-800" size={28} />
              Waiting for InfiniteTalk video.
            </div>
          ) : avatarAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {avatarAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <video src={asset.url} className="aspect-[4/5] w-full bg-stone-100 object-cover" controls />
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
              <Video className="text-emerald-800" size={34} />
              <p className="mt-3 text-base font-semibold text-stone-950">Ready for a talking avatar</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                InfiniteTalk outputs will appear here as reusable video assets.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        <form onSubmit={generateAvatar}>
          <PanelTitle icon={Clapperboard} title="Avatar Options" />
          <PersonaSelect personas={personas} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
          <AssetSelect
            label="Generated image"
            assets={imageAssets}
            value={uploadedImage ? "" : selectedImage?.id ?? ""}
            onChange={(id) => {
              setUploadedImage(undefined);
              setImageAssetId(id);
            }}
          />
          <UploadBox
            accept="image/*"
            icon={Upload}
            label={uploadedImage ? uploadedImage.name : "Upload image"}
            detail={uploadedImage ? "Uploaded image will be used instead of a generated image." : ""}
            onChange={(files) => void captureImage(files)}
          />
          <AssetSelect
            label="Saved audio"
            assets={audioAssets}
            value={uploadedAudio ? "" : selectedAudio?.id ?? ""}
            onChange={(id) => {
              setUploadedAudio(undefined);
              setAudioAssetId(id);
            }}
          />
          <UploadBox
            accept="audio/*"
            icon={Upload}
            label={uploadedAudio ? uploadedAudio.name : "Upload audio"}
            detail={uploadedAudio ? "Uploaded audio will be used instead of saved audio." : ""}
            onChange={(files) => void captureAudio(files)}
          />
          <SelectField label="Resolution" value={resolution} options={avatarResolutions} onChange={(value) => setResolution(value as typeof resolution)} />
          <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
            {selectedAudioSource
              ? isReadingDuration
                ? "Reading audio length..."
                : audioDurationSeconds
                  ? `Duration: ${formatDuration(audioDurationSeconds)}. The avatar video will match the audio length.`
                  : "The selected audio length could not be read yet."
              : "Choose or upload audio before generating an avatar."}
          </div>
          <TextArea label="Prompt" value={prompt} onChange={setPrompt} rows={4} />
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <SubmitButton
            loading={isGenerating}
            icon={Video}
            label="Generate avatar"
            costLabel={costLabel}
            disabled={!selectedPersona || !selectedImageUrl || !selectedAudioSource || !effectiveDurationSeconds}
          />
        </form>
      </aside>
    </div>
  );
}

function AssetSelect({
  label,
  assets,
  value,
  onChange,
}: {
  label: string;
  assets: Asset[];
  value: string;
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
        {assets.length ? null : <option value="">No assets available</option>}
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function getMediaDurationFromUrl(url: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      audio.removeAttribute("src");
      audio.load();
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration);
        return;
      }
      reject(new Error("Invalid duration"));
    };
    audio.onerror = () => reject(new Error("Could not read audio duration"));
    audio.src = url;
  });
}

function formatDuration(durationSeconds: number) {
  const totalSeconds = Math.max(1, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
