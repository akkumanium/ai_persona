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
};

export type View = "personas" | "generate" | "images" | "videos" | "motion" | "assets" | "jobs" | "settings";
export type GenerationMode = "images" | "videos" | "motion";
export type AssetFilter = "all" | "avatar" | "upload" | "image" | "video";
export type ReferenceSlotId = "face" | "face-grid" | "body" | "more";
export type FaceGenerationMode = "scratch" | "hybrid";
export type VideoFrameSlot = "start" | "end";
