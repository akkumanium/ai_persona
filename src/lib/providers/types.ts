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
  costEstimateCents: number;
  raw: unknown;
};

export type VideoGenerationRequest = {
  prompt: string;
  model: "wan-2.2" | "wan-animate";
  mode: "normal" | "motion";
  referenceImageUrl?: string;
  durationSeconds: number;
  aspectRatio: string;
  motionReference?: string;
  motionReferenceVideo?: ProviderMediaInput;
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

export interface ImageProvider {
  name: ProviderName;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface VideoProvider {
  name: ProviderName;
  submit(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
  poll(providerJobId: string): Promise<VideoGenerationResult>;
}
