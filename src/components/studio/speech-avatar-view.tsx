import { AudioLines, Clapperboard, Loader2, MessageSquareText, Trash2, Upload, Video } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { encodeFiles, sourceImageToDataUrl } from "@/components/studio/media";
import { useStudioTokenBalance } from "@/components/studio/token-balance-context";
import type { SourceAudioInput, SourceImageInput } from "@/components/studio/types";
import {
  DeferredAudio,
  DeferredVideo,
  ModelSelect,
  ModeToggle,
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
import { SPEECH_VOICE_PRESETS } from "@/data/speech-voices";
import { avatarMaximumDurationSeconds, estimateAvatarGenerationPricing, estimateSpeechGenerationPricing } from "@/lib/pricing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { formatTokens } from "@/lib/utils";

const speechModels = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
];
const talkingAvatarModels = [
  { id: "wavespeed-ai/longcat-avatar", label: "Longcat Avatar" },
  { id: "wavespeed-ai/infinitetalk", label: "InfiniteTalk" },
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
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceMode, setVoiceMode] = useState<"preset" | "custom">(
    SPEECH_VOICE_PRESETS.length ? "preset" : "custom",
  );
  const [presetVoiceId, setPresetVoiceId] = useState(SPEECH_VOICE_PRESETS[0]?.id ?? "");
  const [model, setModel] = useState<"eleven_multilingual_v2">("eleven_multilingual_v2");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const { balanceTokens, tryReserveTokens, reconcileTokenBalance } = useStudioTokenBalance();
  const latestAudio = useMemo(
    () => assets.filter((asset) => asset.personaId === selectedPersona?.id && asset.kind === "audio"),
    [assets, selectedPersona?.id],
  );
  const costTokens = estimateSpeechGenerationPricing({ text }).tokens;
  const costLabel = formatTokens(costTokens);
  const effectiveVoiceId = voiceMode === "preset" ? presetVoiceId : voiceId.trim();

  async function generateSpeech(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !effectiveVoiceId || !text.trim()) return;
    if (!tryReserveTokens(costTokens)) {
      setError(`Insufficient token balance. This generation costs ${costTokens} tokens, but your balance is ${balanceTokens}.`);
      return;
    }
    setIsGenerating(true);
    setError("");
    let balanceReconciled = false;
    try {
      const response = await fetch("/api/generate/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
          text,
          voiceId: effectiveVoiceId,
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
      if (typeof payload.balanceTokens === "number") {
        reconcileTokenBalance(payload.balanceTokens);
        balanceReconciled = true;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Speech generation failed.");
      }
      onAssetsCreated([payload.asset], payload.job);
    } catch (speechError) {
      setError(speechError instanceof Error ? speechError.message : "Speech generation failed.");
    } finally {
      if (!balanceReconciled) reconcileTokenBalance();
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                  <DeferredAudio src={asset.url} title={asset.title} className="mt-4 w-full" />
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
          {SPEECH_VOICE_PRESETS.length ? (
            <>
              <ModeToggle
                label="Voice source"
                value={voiceMode}
                options={[
                  { value: "preset", label: "Preset voices" },
                  { value: "custom", label: "Voice ID" },
                ]}
                onChange={(value) => setVoiceMode(value as "preset" | "custom")}
              />
              {voiceMode === "preset" ? (
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-stone-700">Voice</span>
                  <select
                    value={presetVoiceId}
                    onChange={(event) => setPresetVoiceId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
                  >
                    {SPEECH_VOICE_PRESETS.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  {SPEECH_VOICE_PRESETS.find((voice) => voice.id === presetVoiceId)?.description ? (
                    <span className="mt-2 block text-xs leading-5 text-stone-500">
                      {SPEECH_VOICE_PRESETS.find((voice) => voice.id === presetVoiceId)?.description}
                    </span>
                  ) : null}
                </label>
              ) : (
                <TextField label="Voice ID" value={voiceId} onChange={setVoiceId} />
              )}
            </>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                No preset voices have been added yet. Add them in src/data/speech-voices.ts.
              </div>
              <TextField label="Voice ID" value={voiceId} onChange={setVoiceId} />
            </>
          )}
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
            disabled={!selectedPersona || !effectiveVoiceId || !text.trim()}
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
  initialImage,
  onAssetsCreated,
  onSelectPersona,
  onDeleteAsset,
}: {
  personas: Persona[];
  assets: Asset[];
  selectedPersona?: Persona;
  initialImage?: { id: string; nonce: number };
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
  const [model, setModel] = useState("wavespeed-ai/longcat-avatar");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | undefined>();
  const [isReadingDuration, setIsReadingDuration] = useState(false);
  const [prompt, setPrompt] = useState("Natural talking head, subtle expression, steady camera.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingInputs, setUploadingInputs] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const { balanceTokens, tryReserveTokens, reconcileTokenBalance } = useStudioTokenBalance();
  const selectedImage = imageAssets.find((asset) => asset.id === imageAssetId);
  const selectedAudio = audioAssets.find((asset) => asset.id === audioAssetId) ?? audioAssets[0];
  const selectedImageUrl = uploadedImage ? sourceImageToDataUrl(uploadedImage) : selectedImage?.url;
  const avatarImageField = uploadedImage
    ? { url: sourceImageToDataUrl(uploadedImage), name: uploadedImage.name }
    : selectedImage
      ? { url: selectedImage.url, name: selectedImage.title }
      : undefined;
  const selectedAudioSource = uploadedAudio?.url ?? (uploadedAudio?.data ? `data:${uploadedAudio.mimeType};base64,${uploadedAudio.data}` : selectedAudio?.url);
  const effectiveDurationSeconds = audioDurationSeconds ? Math.max(1, Math.ceil(audioDurationSeconds)) : 0;
  const maximumDurationSeconds = avatarMaximumDurationSeconds(model);
  const audioExceedsModelLimit = effectiveDurationSeconds > maximumDurationSeconds;
  const costTokens = audioDurationSeconds && !audioExceedsModelLimit
    ? estimateAvatarGenerationPricing({ model, resolution, durationSeconds: effectiveDurationSeconds }).tokens
    : undefined;
  const costLabel = costTokens === undefined ? undefined : formatTokens(costTokens);

  const [appliedInitialImageNonce, setAppliedInitialImageNonce] = useState<number | undefined>();
  if (initialImage && initialImage.nonce !== appliedInitialImageNonce) {
    setAppliedInitialImageNonce(initialImage.nonce);
    setUploadedImage(undefined);
    setImageAssetId(initialImage.id);
  }

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
        const wavDuration =
          uploadedAudio?.data && uploadedAudio.mimeType.toLowerCase().includes("wav")
            ? getWavDurationFromBase64(uploadedAudio.data)
            : undefined;
        if (!cancelled) setAudioDurationSeconds(wavDuration);
      })
      .finally(() => {
        if (!cancelled) setIsReadingDuration(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAudioSource, uploadedAudio]);

  async function captureImage(files: FileList | null) {
    setUploadingInputs((current) => ({ ...current, image: true }));
    setError("");
    try {
      const [image] = await encodeFiles(files, "image/png");
      setUploadedImage(image);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploadingInputs((current) => ({ ...current, image: false }));
    }
  }

  async function captureAudio(files: FileList | null) {
    setUploadingInputs((current) => ({ ...current, audio: true }));
    setError("");
    try {
      const [audio] = await encodeFiles(files, "audio/mpeg");
      setUploadedAudio(audio ? { name: audio.name, mimeType: audio.mimeType, data: audio.data, url: audio.url } : undefined);
      setAudioAssetId("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Audio upload failed.");
    } finally {
      setUploadingInputs((current) => ({ ...current, audio: false }));
    }
  }

  async function generateAvatar(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersona || !selectedImageUrl || !selectedAudioSource || !effectiveDurationSeconds || audioExceedsModelLimit) return;
    if (costTokens === undefined || !tryReserveTokens(costTokens)) {
      if (costTokens !== undefined) {
        setError(`Insufficient token balance. This generation costs ${costTokens} tokens, but your balance is ${balanceTokens}.`);
      }
      return;
    }
    setIsGenerating(true);
    setError("");
    let balanceReconciled = false;
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
          model,
          prompt,
          resolution,
          durationSeconds: effectiveDurationSeconds,
          seed: -1,
        }),
      });
      const payload = await response.json();
      if (typeof payload.balanceTokens === "number") {
        reconcileTokenBalance(payload.balanceTokens);
        balanceReconciled = true;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Avatar generation failed.");
      }
      onAssetsCreated(payload.asset ? [payload.asset] : [], payload.job);
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar generation failed.");
    } finally {
      if (!balanceReconciled) reconcileTokenBalance();
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-h-[calc(100vh-9.5rem)] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Video} title="Avatar Results" />
        <div className="mt-5 min-h-[26rem] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
          {isGenerating ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-sm text-stone-600">
              <Loader2 className="mb-3 animate-spin text-emerald-800" size={28} />
              Waiting for {model === "wavespeed-ai/longcat-avatar" ? "Longcat Avatar" : "InfiniteTalk"} video.
            </div>
          ) : avatarAssets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {avatarAssets.slice(0, 6).map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <DeferredVideo src={asset.url} title={asset.title} className="aspect-[4/5] w-full bg-stone-100 object-cover" />
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
                Talking avatar outputs will appear here as reusable video assets.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-9.5rem)] xl:self-start xl:overflow-y-auto">
        <form onSubmit={generateAvatar}>
          <PanelTitle icon={Clapperboard} title="Avatar Options" />
          <PersonaSelect personas={personas} value={selectedPersona?.id ?? ""} onChange={onSelectPersona} />
          <SourceImageField
            label="Portrait image"
            image={avatarImageField}
            onClear={() => {
              setUploadedImage(undefined);
              setImageAssetId("");
            }}
            onUpload={(files) => void captureImage(files)}
            loading={Boolean(uploadingInputs.image)}
            hint="Pick a portrait from Images or upload."
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
            loading={Boolean(uploadingInputs.audio)}
            onChange={(files) => void captureAudio(files)}
          />
          <ModelSelect label="Model" value={model} options={talkingAvatarModels} onChange={setModel} />
          <SelectField label="Resolution" value={resolution} options={avatarResolutions} onChange={(value) => setResolution(value as typeof resolution)} />
          <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
            {selectedAudioSource
              ? isReadingDuration
                ? "Reading audio length..."
                : audioDurationSeconds
                  ? audioExceedsModelLimit
                    ? `${model === "wavespeed-ai/longcat-avatar" ? "Longcat Avatar" : "InfiniteTalk"} supports up to ${formatDuration(maximumDurationSeconds)}. Choose shorter audio${model === "wavespeed-ai/longcat-avatar" ? " or switch to InfiniteTalk" : ""}.`
                    : `Duration: ${formatDuration(audioDurationSeconds)}. The avatar video will match the audio length.`
                  : "The selected audio length could not be read. Try another WAV or MP3 file."
              : "Choose or upload audio before generating an avatar."}
          </div>
          <TextArea label="Prompt" value={prompt} onChange={setPrompt} rows={4} />
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <SubmitButton
            loading={isGenerating}
            icon={Video}
            label="Generate avatar"
            costLabel={costLabel}
            disabled={!selectedPersona || !selectedImageUrl || !selectedAudioSource || !effectiveDurationSeconds || audioExceedsModelLimit}
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

function getWavDurationFromBase64(base64: string) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const view = new DataView(bytes.buffer);
    if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") return undefined;

    let offset = 12;
    let byteRate = 0;
    let dataSize = 0;
    while (offset + 8 <= bytes.length) {
      const chunkId = readAscii(bytes, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkDataOffset = offset + 8;
      if (chunkId === "fmt " && chunkDataOffset + 16 <= bytes.length) {
        byteRate = view.getUint32(chunkDataOffset + 8, true);
      }
      if (chunkId === "data") {
        dataSize = chunkSize;
        break;
      }
      offset = chunkDataOffset + chunkSize + (chunkSize % 2);
    }

    const duration = byteRate > 0 && dataSize > 0 ? dataSize / byteRate : 0;
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
  } catch {
    return undefined;
  }
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return Array.from(bytes.slice(offset, offset + length))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function formatDuration(durationSeconds: number) {
  const totalSeconds = Math.max(1, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
