export type AssetKind = "avatar" | "image" | "video" | "audio" | "upload";
export type GenerationType =
  | "avatar_prompt"
  | "avatar_image_blend"
  | "avatar_normalization"
  | "reference_upload"
  | "image_from_reference"
  | "image_from_prompt"
  | "speech_text"
  | "avatar_talking"
  | "video_normal"
  | "video_motion"
  | "video_prompt";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type ProviderName = "wavespeed" | "elevenlabs";

export type Persona = {
  id: string;
  name: string;
  description: string;
  styleNotes: string;
  status: "draft" | "active" | "archived";
  referenceAssetId?: string;
  createdAt: string;
};

export type Asset = {
  id: string;
  kind: AssetKind;
  url: string;
  storageBucket?: string;
  storagePath?: string;
  title: string;
  prompt: string;
  personaId?: string;
  referenceAssetIds?: string[];
  referenceSlot?: "face" | "chest-up" | "face-grid" | "body" | "more";
  isDefaultReference?: boolean;
  generationType: GenerationType;
  provider: ProviderName | "demo";
  providerJobId?: string;
  providerAssetId?: string;
  model: string;
  mimeType: string;
  createdAt: string;
  expiresAt?: string;
};

export type GenerationJob = {
  id: string;
  status: JobStatus;
  provider: ProviderName | "demo";
  providerJobId?: string;
  model: string;
  generationType: GenerationType;
  prompt: string;
  personaId?: string;
  referenceAssetIds?: string[];
  costEstimateCents: number;
  rawProviderResponse?: unknown;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreditLedgerEntry = {
  id: string;
  jobId: string;
  amountCents: number;
  description: string;
  createdAt: string;
};
