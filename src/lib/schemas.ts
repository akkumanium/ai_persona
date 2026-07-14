import { z } from "zod";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_INLINE_IMAGE_BYTES,
  MAX_INLINE_MEDIA_BYTES,
  estimateBase64DecodedBytes,
  formatBytes,
  isAllowedMimeType,
} from "@/lib/media-limits";
import { IMAGE_MODEL_IDS, TALKING_AVATAR_MODEL_IDS, VIDEO_MODEL_IDS } from "@/lib/model-registry";

export const aspectRatioSchema = z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
export const videoAspectRatioSchema = z.enum(["auto", "1:1", "3:4", "4:3", "4:5", "9:16", "16:9", "21:9"]);
export const imageSizeSchema = z.enum(["1K", "2K", "4K"]);
export const imageQualitySchema = z.enum(["auto", "low", "medium", "high"]);
export const referenceSlotSchema = z.enum(["face", "chest-up", "face-grid", "body"]);

export const providerImageInputSchema = z.object({
  name: z.string().max(200).optional(),
  mimeType: z.string().min(3).max(80).refine(
    (mimeType) => isAllowedMimeType(mimeType, ALLOWED_IMAGE_MIME_TYPES),
    "Unsupported image type.",
  ),
  data: z.string().min(1).refine(
    (data) => isStrictBase64(data) && estimateBase64DecodedBytes(data) <= MAX_INLINE_IMAGE_BYTES,
    `Image uploads must be ${formatBytes(MAX_INLINE_IMAGE_BYTES)} or smaller.`,
  ),
}).superRefine((input, context) => {
  if (!base64MatchesMimeType(input.data, input.mimeType)) context.addIssue({ code: "custom", path: ["data"], message: "Image contents do not match the declared type." });
});

export const providerMediaInputSchema = z.object({
  name: z.string().max(200).optional(),
  mimeType: z.string().min(3).max(120).refine(
    (mimeType) => isAllowedMimeType(mimeType, ALLOWED_MEDIA_MIME_TYPES),
    "Unsupported media type.",
  ),
  data: z.string().min(1).refine(
    (data) => isStrictBase64(data) && estimateBase64DecodedBytes(data) <= MAX_INLINE_MEDIA_BYTES,
    `Media uploads must be ${formatBytes(MAX_INLINE_MEDIA_BYTES)} or smaller.`,
  ),
}).superRefine((input, context) => {
  if (!base64MatchesMimeType(input.data, input.mimeType)) context.addIssue({ code: "custom", path: ["data"], message: "Media contents do not match the declared type." });
});

export const avatarGenerationSchema = z.object({
  personaId: z.string().min(1).optional(),
  mode: z.enum(["prompt", "normalization", "blend"]),
  personaName: z.string().min(2).max(80),
  description: z.string().max(600).default(""),
  model: z.enum(IMAGE_MODEL_IDS).default("gemini-3-pro-image"),
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
  model: z.enum(IMAGE_MODEL_IDS).default("gemini-3-pro-image"),
  referenceImageUrl: z.string().min(1).optional(),
  referenceImageUrls: z.array(z.string().min(1)).min(0).default([]),
  sourceImages: z.array(providerImageInputSchema).min(0).default([]),
  sourceImageUrls: z.array(z.string().min(1)).min(0).default([]),
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
  model: z.enum(VIDEO_MODEL_IDS).default("wan-animate"),
  referenceImageUrl: z.string().min(1).optional(),
  startFrameImageUrl: z.string().min(1).optional(),
  startFrameImage: providerImageInputSchema.optional(),
  endFrameImageUrl: z.string().min(1).optional(),
  endFrameImage: providerImageInputSchema.optional(),
  prompt: z.string().max(2000).optional().default(""),
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
  motionMode: z.enum(["animate", "replace"]).optional().default("animate"),
  characterOrientation: z.enum(["image", "video"]).optional().default("video"),
  keepOriginalSound: z.boolean().optional().default(true),
  referenceAssetIds: z.array(z.string().min(1)).min(0).default([]),
  motionReferenceVideo: providerMediaInputSchema.optional(),
  motionReferenceVideoUrl: z.string().min(1).optional(),
  referenceVideo: providerMediaInputSchema.optional(),
  referenceVideoUrl: z.string().min(1).optional(),
  referenceAudio: providerMediaInputSchema.optional(),
  referenceAudioUrl: z.string().min(1).optional(),
}).superRefine((input, context) => {
  const isMotionModel = input.model === "wan-animate" || input.model.includes("motion");
  if ((input.mode === "motion") !== isMotionModel) {
    context.addIssue({
      code: "custom",
      path: ["model"],
      message: `Model ${input.model} is not authorized for ${input.mode} video generation.`,
    });
  }
  if (input.mode === "normal" && input.prompt.length < 10) {
    context.addIssue({
      code: "too_small",
      minimum: 10,
      inclusive: true,
      origin: "string",
      path: ["prompt"],
      message: "Too small: expected string to have >=10 characters",
    });
  }
  const allowedResolutions = input.model.includes("fast")
    ? ["480p", "720p"]
    : input.model.includes("seedance")
      ? ["480p", "720p", "1080p"]
      : input.model === "wan-animate"
        ? ["480p", "720p"]
        : input.model === "wan-2.7"
          ? ["720p", "1080p"]
          : input.model === "kling-v3-0-4k"
            ? ["4K"]
            : input.model.startsWith("kling-v3-0")
              ? ["720p", "1080p"]
              : ["720p"];
  if (!allowedResolutions.includes(input.resolution)) {
    context.addIssue({ code: "custom", path: ["resolution"], message: "Resolution is not supported by this model." });
  }
  if (input.model.startsWith("kling-v2-6") && ![5, 10].includes(input.durationSeconds)) {
    context.addIssue({ code: "custom", path: ["durationSeconds"], message: "Kling 2.6 supports only 5 or 10 seconds." });
  }
  if (input.model.includes("seedance") && input.durationSeconds < 4) {
    context.addIssue({ code: "custom", path: ["durationSeconds"], message: "Seedance requires at least 4 seconds." });
  }
  if (input.model.startsWith("kling-") && !input.startFrameImage && !input.startFrameImageUrl && !input.referenceImageUrl) {
    context.addIssue({ code: "custom", path: ["startFrameImageUrl"], message: "Kling requires a start frame." });
  }
});

export const speechGenerationSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(120),
  model: z.enum(["eleven_multilingual_v2"]).default("eleven_multilingual_v2"),
  outputFormat: z.enum(["mp3_44100_128", "mp3_44100_192", "wav_44100"]).default("mp3_44100_128"),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  useSpeakerBoost: z.boolean().optional().default(true),
  seed: z.number().int().min(0).max(4294967295).optional(),
  languageCode: z.string().min(2).max(8).optional(),
});

export const talkingAvatarGenerationSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1),
  imageAssetUrl: z.string().min(1).optional(),
  imageAssetId: z.string().min(1).optional(),
  audioAssetUrl: z.string().min(1).optional(),
  audioAssetId: z.string().min(1).optional(),
  uploadedAudio: z.object({
    name: z.string().max(200).optional(),
    mimeType: z.string().min(3).max(120).refine(
      (mimeType) => isAllowedMimeType(mimeType, ALLOWED_AUDIO_MIME_TYPES),
      "Unsupported audio type.",
    ),
    data: z.string().min(1).refine(
      (data) => estimateBase64DecodedBytes(data) <= MAX_INLINE_MEDIA_BYTES,
      `Audio uploads must be ${formatBytes(MAX_INLINE_MEDIA_BYTES)} or smaller.`,
    ).optional(),
    url: z.string().min(1).optional(),
  }).optional(),
  model: z.enum(TALKING_AVATAR_MODEL_IDS).default("wavespeed-ai/longcat-avatar"),
  prompt: z.string().max(1000).optional().default(""),
  resolution: z.enum(["480p", "720p"]).default("480p"),
  durationSeconds: z.number().int().min(1).max(600).default(5),
  seed: z.number().int().min(-1).max(2147483647).optional().default(-1),
});

function isStrictBase64(data: string) {
  return data.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data);
}

function base64MatchesMimeType(data: string, mimeType: string) {
  if (!isStrictBase64(data)) return false;
  const bytes = Buffer.from(data.slice(0, 32), "base64");
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const type = mimeType.toLowerCase();
  if (type.includes("png")) return starts(0x89, 0x50, 0x4e, 0x47);
  if (type.includes("jpeg") || type.includes("jpg")) return starts(0xff, 0xd8, 0xff);
  if (type.includes("gif")) return starts(0x47, 0x49, 0x46, 0x38);
  if (type.includes("webp")) return starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString() === "WEBP";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("quicktime")) return bytes.subarray(4, 8).toString() === "ftyp";
  if (type.includes("webm")) return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (type.includes("wav")) return starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString() === "WAVE";
  if (type.includes("mpeg") || type.includes("mp3")) return starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (type.includes("ogg") || type.includes("opus")) return starts(0x4f, 0x67, 0x67, 0x53);
  if (type.includes("flac")) return starts(0x66, 0x4c, 0x61, 0x43);
  if (type.includes("aac")) return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
  return false;
}
