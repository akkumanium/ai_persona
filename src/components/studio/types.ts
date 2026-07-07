export type SourceImageInput = {
  name: string;
  mimeType: string;
  data?: string;
  url?: string;
  storageBucket?: string;
  storagePath?: string;
};

export type SourceVideoInput = {
  name: string;
  mimeType: string;
  data?: string;
  url?: string;
  storageBucket?: string;
  storagePath?: string;
};

export type SourceAudioInput = {
  name: string;
  mimeType: string;
  data?: string;
  url?: string;
};

export type View =
  | "personas"
  | "generate"
  | "images"
  | "videos"
  | "trends"
  | "motion"
  | "speech"
  | "avatar"
  | "assets"
  | "jobs"
  | "settings"
  | "community";
export type GenerationMode = "images" | "videos" | "motion";
export type AssetFilter = "all" | "avatar" | "upload" | "image" | "video" | "audio";
export type ReferenceSlotId = "face" | "chest-up" | "body" | "face-grid";
export type FaceGenerationMode = "scratch" | "hybrid";
export type VideoFrameSlot = "start" | "end";
