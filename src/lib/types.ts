export type AssetKind = "avatar" | "image" | "video" | "upload";
export type GenerationType =
  | "avatar_prompt"
  | "avatar_image_blend"
  | "avatar_normalization"
  | "reference_upload"
  | "image_from_reference"
  | "image_from_prompt"
  | "video_normal"
  | "video_motion"
  | "video_prompt";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type ProviderName = "nano-banana-pro" | "wan";

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
  title: string;
  prompt: string;
  personaId?: string;
  referenceAssetIds?: string[];
  isDefaultReference?: boolean;
  generationType: GenerationType;
  provider: ProviderName | "demo";
  model: string;
  mimeType: string;
  createdAt: string;
};

export type GenerationJob = {
  id: string;
  status: JobStatus;
  provider: ProviderName | "demo";
  model: string;
  generationType: GenerationType;
  prompt: string;
  personaId?: string;
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
