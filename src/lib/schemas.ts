import { z } from "zod";

export const aspectRatioSchema = z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"]);
export const videoAspectRatioSchema = z.enum(["auto", "1:1", "3:4", "4:3", "4:5", "9:16", "16:9", "21:9"]);
export const imageSizeSchema = z.enum(["1K", "2K", "4K"]);
export const imageQualitySchema = z.enum(["auto", "low", "medium", "high"]);
export const referenceSlotSchema = z.enum(["face", "face-grid", "body", "more"]);

export const providerImageInputSchema = z.object({
  name: z.string().max(200).optional(),
  mimeType: z.string().min(3).max(80),
  data: z.string().min(1),
});

export const providerMediaInputSchema = z.object({
  name: z.string().max(200).optional(),
  mimeType: z.string().min(3).max(120),
  data: z.string().min(1),
});

export const avatarGenerationSchema = z.object({
  personaId: z.string().min(1).optional(),
  mode: z.enum(["prompt", "normalization", "blend"]),
  personaName: z.string().min(2).max(80),
  description: z.string().max(600).default(""),
  model: z.string().min(1).default("gemini-3-pro-image-preview"),
  prompt: z.string().max(2000).optional().default(""),
  additionalPrompt: z.string().max(1000).optional().default(""),
  styleNotes: z.string().max(1000).optional().default(""),
  aspectRatio: aspectRatioSchema.default("4:5"),
  imageSize: imageSizeSchema.default("2K"),
  imageQuality: imageQualitySchema.optional().default("medium"),
  count: z.number().int().min(1).max(4).default(1),
  referenceSlot: referenceSlotSchema.optional().default("face"),
  referenceAssetIds: z.array(z.string().min(1)).min(0).default([]),
  isDefaultReference: z.boolean().optional().default(false),
  titlePrefix: z.string().max(120).optional(),
  sourceImageNames: z.array(z.string()).min(0).default([]),
  sourceImages: z.array(providerImageInputSchema).min(0).default([]),
  sourceImageUrls: z.array(z.string().min(1)).min(0).default([]),
  confirmsRights: z.boolean(),
  confirmsAdultPersona: z.boolean(),
});

export const imageGenerationSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  model: z.string().min(1).default("gemini-3-pro-image-preview"),
  referenceImageUrl: z.string().min(1).optional(),
  referenceImageUrls: z.array(z.string().min(1)).min(0).default([]),
  prompt: z.string().max(2000).optional().default(""),
  additionalPrompt: z.string().max(1000).optional().default(""),
  styleNotes: z.string().max(1000).optional().default(""),
  aspectRatio: aspectRatioSchema.default("4:5"),
  imageSize: imageSizeSchema.default("2K"),
  imageQuality: imageQualitySchema.optional().default("medium"),
  count: z.number().int().min(1).max(4).default(1),
  assetKind: z.enum(["image", "avatar"]).optional().default("image"),
  referenceSlot: referenceSlotSchema.optional(),
  referenceAssetIds: z.array(z.string().min(1)).min(0).default([]),
  isDefaultReference: z.boolean().optional().default(false),
  titlePrefix: z.string().max(120).optional(),
});

export const videoGenerationSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  model: z.string().min(1).default("wan-animate"),
  referenceImageUrl: z.string().min(1).optional(),
  startFrameImageUrl: z.string().min(1).optional(),
  endFrameImageUrl: z.string().min(1).optional(),
  prompt: z.string().min(10).max(2000),
  mode: z.enum(["normal", "motion"]),
  durationSeconds: z.number().int().min(3).max(15).default(5),
  aspectRatio: videoAspectRatioSchema.default("9:16"),
  negativePrompt: z.string().max(1000).optional().default(""),
  providerMode: z.enum(["std", "pro"]).optional().default("std"),
  cfgScale: z.number().min(0).max(1).optional().default(0.5),
  generateAudio: z.boolean().optional().default(false),
  resolution: z.enum(["480p", "720p", "1080p", "4K"]).optional().default("720p"),
  returnLastFrame: z.boolean().optional().default(false),
  motionReference: z.string().max(500).optional().default(""),
  motionReferenceVideo: providerMediaInputSchema.optional(),
});
