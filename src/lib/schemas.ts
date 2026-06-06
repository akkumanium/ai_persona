import { z } from "zod";

export const aspectRatioSchema = z.enum(["1:1", "3:4", "4:5", "9:16", "16:9"]);
export const videoAspectRatioSchema = z.enum(["auto", "1:1", "3:4", "4:3", "4:5", "9:16", "16:9", "21:9"]);
export const imageSizeSchema = z.enum(["1K", "2K", "4K"]);

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
  mode: z.enum(["prompt", "normalization", "blend"]),
  personaName: z.string().min(2).max(80),
  description: z.string().min(10).max(600),
  prompt: z.string().min(10).max(2000),
  styleNotes: z.string().max(1000).optional().default(""),
  aspectRatio: aspectRatioSchema.default("4:5"),
  imageSize: imageSizeSchema.default("2K"),
  count: z.number().int().min(1).max(4).default(1),
  sourceImageNames: z.array(z.string()).min(0).default([]),
  sourceImages: z.array(providerImageInputSchema).min(0).default([]),
  confirmsRights: z.boolean(),
  confirmsAdultPersona: z.boolean(),
});

export const imageGenerationSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  model: z.string().min(1).default("gemini-3-pro-image-preview"),
  referenceImageUrl: z.string().min(1).optional(),
  referenceImageUrls: z.array(z.string().min(1)).min(0).default([]),
  prompt: z.string().min(10).max(2000),
  styleNotes: z.string().max(1000).optional().default(""),
  aspectRatio: aspectRatioSchema.default("4:5"),
  imageSize: imageSizeSchema.default("2K"),
  count: z.number().int().min(1).max(4).default(1),
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
  resolution: z.enum(["480p", "720p", "1080p"]).optional().default("720p"),
  returnLastFrame: z.boolean().optional().default(false),
  motionReference: z.string().max(500).optional().default(""),
  motionReferenceVideo: providerMediaInputSchema.optional(),
});
