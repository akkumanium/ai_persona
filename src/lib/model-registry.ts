export type ModelCapability =
  | "avatar"
  | "image-reference"
  | "video-normal"
  | "video-motion";

export type ModelRegistryEntry = {
  id: string;
  label: string;
  provider: "nano-banana-pro" | "openai" | "wan" | "kling" | "seedance";
  capabilities: ModelCapability[];
  enabled: boolean;
  notes: string;
};

import { CHATGPT_IMAGE_MODEL_ID, NANO_BANANA_PRO_MODEL_ID } from "@/lib/image-model-options";

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: NANO_BANANA_PRO_MODEL_ID,
    label: "Nano Banana Pro",
    provider: "nano-banana-pro",
    capabilities: ["avatar", "image-reference"],
    enabled: true,
    notes: "Google Gemini 3 Pro Image model with reference-image generation, aspect ratio, and 1K/2K/4K size controls.",
  },
  {
    id: CHATGPT_IMAGE_MODEL_ID,
    label: "ChatGPT Image 2",
    provider: "openai",
    capabilities: ["avatar", "image-reference"],
    enabled: true,
    notes: "OpenAI image model with generation, edit/reference inputs, quality, and fixed output size controls.",
  },
  {
    id: "wan-2.2",
    label: "Wan 2.2",
    provider: "wan",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Configurable video adapter. Set WAN_API_BASE_URL and WAN_API_KEY for real calls.",
  },
  {
    id: "wan-2.7",
    label: "Wan 2.7",
    provider: "wan",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "PoYo Wan 2.7 text-to-video, image-to-video, and reference-to-video at 720p/1080p.",
  },
  {
    id: "wan-animate",
    label: "Wan Animate",
    provider: "wan",
    capabilities: ["video-normal", "video-motion"],
    enabled: true,
    notes: "Configurable motion-control adapter for reference-driven animation.",
  },
  {
    id: "kling-v2-6",
    label: "Kling 2.6",
    provider: "kling",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling image-to-video with start frame, optional pro end frame, 5s/10s duration, sound, negative prompt, and CFG controls.",
  },
  {
    id: "kling-v3-0",
    label: "Kling 3.0",
    provider: "kling",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Kling 3.0 standard, pro, audio, and 4K video generation pricing paths.",
  },
  {
    id: "dreamina-seedance-2-0-260128",
    label: "Seedance 2.0",
    provider: "seedance",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "BytePlus ModelArk Seedance 2.0 with text, start/end frame image-to-video, 4-15s duration, resolution, audio, and last-frame return.",
  },
  {
    id: "dreamina-seedance-2-0-fast-260128",
    label: "Seedance 2.0 Fast",
    provider: "seedance",
    capabilities: ["video-normal"],
    enabled: true,
    notes: "Lower-cost Seedance 2.0 Fast option for image-to-video workflows up to 720p.",
  },
];

export function modelsForCapability(capability: ModelCapability) {
  return MODEL_REGISTRY.filter((model) => model.enabled && model.capabilities.includes(capability));
}
