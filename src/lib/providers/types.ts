import type { GenerationType, JobStatus, ProviderName } from "@/lib/types";

export type ProviderImageInput = {
  mimeType: string;
  data: string;
  name?: string;
};

export type ProviderMediaInput = {
  mimeType: string;
  data: string;
  name?: string;
};

export type ImageGenerationRequest = {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  imageQuality?: "auto" | "low" | "medium" | "high";
  count: number;
  referenceImages?: ProviderImageInput[];
  generationType: GenerationType;
};

export type GeneratedAssetPayload = {
  url: string;
  mimeType: string;
  providerAssetId?: string;
};

export type ImageGenerationResult = {
  provider: ProviderName | "demo";
  model: string;
  assets: GeneratedAssetPayload[];
  status?: JobStatus;
  providerJobId?: string;
  costEstimateCents: number;
  raw: unknown;
};

export type VideoGenerationRequest = {
  prompt: string;
  model: string;
  mode: "normal" | "motion";
  referenceImageUrl?: string;
  startFrameImageUrl?: string;
  startFrameImage?: ProviderImageInput;
  endFrameImageUrl?: string;
  endFrameImage?: ProviderImageInput;
  durationSeconds: number;
  aspectRatio: string;
  negativePrompt?: string;
  providerMode?: "std" | "pro";
  cfgScale?: number;
  generateAudio?: boolean;
  resolution?: "480p" | "720p" | "1080p" | "4K";
  returnLastFrame?: boolean;
  motionReference?: string;
  motionMode?: "animate" | "replace";
  characterOrientation?: "image" | "video";
  keepOriginalSound?: boolean;
  referenceAssetIds?: string[];
  motionReferenceVideo?: ProviderMediaInput;
  motionReferenceVideoUrl?: string;
  referenceVideo?: ProviderMediaInput;
  referenceVideoUrl?: string;
  referenceAudio?: ProviderMediaInput;
  referenceAudioUrl?: string;
};

export type VideoGenerationResult = {
  provider: ProviderName | "demo";
  model: string;
  status: JobStatus;
  providerJobId: string;
  asset?: GeneratedAssetPayload;
  costEstimateCents: number;
  raw: unknown;
};

export type SpeechGenerationRequest = {
  text: string;
  voiceId: string;
  model: "eleven_multilingual_v2";
  outputFormat: "mp3_44100_128" | "mp3_44100_192" | "wav_44100";
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
  seed?: number;
  languageCode?: string;
};

export type SpeechGenerationResult = {
  provider: ProviderName | "demo";
  model: string;
  asset: GeneratedAssetPayload;
  costEstimateCents: number;
  raw: unknown;
};

export type AvatarGenerationRequest = {
  prompt?: string;
  imageUrl?: string;
  image?: ProviderImageInput;
  audioUrl?: string;
  audio?: ProviderMediaInput;
  maskImageUrl?: string;
  resolution: "480p" | "720p";
  seed?: number;
  durationSeconds: number;
  model?: string;
};

export type AvatarGenerationResult = {
  provider: ProviderName | "demo";
  model: string;
  status: JobStatus;
  providerJobId: string;
  asset?: GeneratedAssetPayload;
  costEstimateCents: number;
  raw: unknown;
};

export interface ImageProvider {
  name: ProviderName;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface AsyncImageProvider {
  name: ProviderName;
  submit(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  poll(providerJobId: string): Promise<ImageGenerationResult>;
}

export interface VideoProvider {
  name: ProviderName;
  submit(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
  poll(providerJobId: string): Promise<VideoGenerationResult>;
}

export interface SpeechProvider {
  name: ProviderName;
  generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult>;
}

export interface AvatarProvider {
  name: ProviderName;
  submit(request: AvatarGenerationRequest): Promise<AvatarGenerationResult>;
}
