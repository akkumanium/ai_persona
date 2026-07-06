export type ModelCapability =
  | "avatar"
  | "image-prompt"
  | "image-reference"
  | "video-normal"
  | "video-motion";

export type ModelRegistryEntry = {
  id: string;
  label: string;
  provider: "nano-banana-pro" | "openai" | "wan" | "kling" | "seedance" | "wavespeed" | "elevenlabs";
  capabilities: ModelCapability[];
  enabled: boolean;
  notes: string;
};

import {
  CHATGPT_IMAGE_MODEL_ID,
  NANO_BANANA_PRO_MODEL_ID,
  SEEDREAM_4_5_MODEL_ID,
  WAN_2_7_IMAGE_EDIT_MODEL_ID,
  WAN_2_7_IMAGE_MODEL_ID,
} from "@/lib/image-model-options";

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: NANO_BANANA_PRO_MODEL_ID,
    label: "Nano Banana Pro",
    provider: "wavespeed",
    capabilities: ["avatar", "image-prompt", "image-reference"],
    enabled: true,
    notes: "Google Gemini 3 Pro Image model with reference-image generation, aspect ratio, and 1K/2K/4K size controls.",
  },
  {
    id: CHATGPT_IMAGE_MODEL_ID,
    label: "ChatGPT Image 2",
    provider: "wavespeed",
    capabilities: ["avatar", "image-prompt", "image-reference"],
    enabled: true,
    notes: "OpenAI image model with generation, edit/reference inputs, quality, and fixed output size controls.",
  },
  {
    id: SEEDREAM_4_5_MODEL_ID,
    label: "Seedream 4.5",
    provider: "wavespeed",
    capabilities: ["avatar", "image-prompt", "image-reference"],
    enabled: true,
    notes: "ByteDance Seedream 4.5 with text-to-image, up to 10 reference images, custom output dimensions, and strong typography.",
  },
  {
    id: WAN_2_7_IMAGE_MODEL_ID,
    label: "Wan 2.7 Image",
    provider: "wavespeed",
    capabilities: ["image-prompt"],
    enabled: true,
    notes: "WaveSpeed Wan 2.7 text-to-image at common social aspect ratios. Prompt-only; reference images are not sent to this endpoint.",
  },
  {
    id: WAN_2_7_IMAGE_EDIT_MODEL_ID,
    label: "Wan 2.7 Image Edit",
    provider: "wavespeed",
    capabilities: ["avatar", "image-prompt", "image-reference"],
    enabled: true,
    notes: "WaveSpeed Wan 2.7 prompt-driven image editing with one or more image references.",
  },
  {
    id: "wan-2.7",
    label: "Wan 2.7",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "PoYo Wan 2.7 text-to-video, image-to-video, and reference-to-video at 720p/1080p.",
  },
  {
    id: "wan-animate",
    label: "Wan Animate",
    provider: "wavespeed",
    capabilities: ["video-motion"],
    enabled: true,
    notes: "Wan Animate motion-transfer model with image, driving video, animate/replace mode, and 480p/720p output.",
  },
  {
    id: "kling-v2-6-std",
    label: "Kling 2.6 Standard",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 2.6 Standard image-to-video with start frame, negative prompt, and 5s/10s duration. No end frame or audio controls.",
  },
  {
    id: "kling-v2-6-pro",
    label: "Kling 2.6 Pro",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 2.6 Pro image-to-video with optional end frame, CFG, sound, negative prompt, and 5s/10s duration.",
  },
  {
    id: "kling-v3-0-std",
    label: "Kling 3.0 Standard",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 3.0 Standard image-to-video with optional end frame, CFG, sound, negative prompt, and 3-15s duration.",
  },
  {
    id: "kling-v3-0-pro",
    label: "Kling 3.0 Pro",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 3.0 Pro image-to-video with optional end frame, CFG, sound, negative prompt, and 3-15s duration.",
  },
  {
    id: "kling-v3-0-4k",
    label: "Kling 3.0 4K",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 3.0 4K image-to-video with optional end frame, CFG, sound, negative prompt, and 3-15s duration.",
  },
  {
    id: "kling-v3-0-motion-std",
    label: "Kling 3.0 Motion Standard",
    provider: "wavespeed",
    capabilities: ["video-motion"],
    enabled: true,
    notes: "Kling 3.0 Standard motion control with character image, driving video, orientation, negative prompt, and original-audio toggle.",
  },
  {
    id: "kling-v3-0-motion-pro",
    label: "Kling 3.0 Motion Pro",
    provider: "wavespeed",
    capabilities: ["video-motion"],
    enabled: true,
    notes: "Kling 3.0 Pro motion control with character image, driving video, orientation, negative prompt, and original-audio toggle.",
  },
  {
    id: "dreamina-seedance-2-0-260128",
    label: "Seedance 2.0",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "WaveSpeed Seedance 2.0 with text, start/end frames, video and audio references, 4-15s duration, resolution, native audio, and last-frame return.",
  },
  {
    id: "dreamina-seedance-2-0-fast-260128",
    label: "Seedance 2.0 Fast",
    provider: "wavespeed",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Lower-cost Seedance 2.0 Fast option for image-to-video workflows up to 720p.",
  },
];

export function modelsForCapability(capability: ModelCapability) {
  return MODEL_REGISTRY.filter((model) => model.enabled && model.capabilities.includes(capability));
}
