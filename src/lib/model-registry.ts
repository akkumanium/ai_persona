export type ModelCapability =
  | "avatar"
  | "image-reference"
  | "video-normal"
  | "video-motion";

export type ModelRegistryEntry = {
  id: string;
  label: string;
  provider: "nano-banana-pro" | "wan";
  capabilities: ModelCapability[];
  enabled: boolean;
  notes: string;
};

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: "gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    provider: "nano-banana-pro",
    capabilities: ["avatar", "image-reference"],
    enabled: true,
    notes: "Google Gemini image model used for prompt and reference-image generation.",
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
    id: "wan-animate",
    label: "Wan Animate",
    provider: "wan",
    capabilities: ["video-normal", "video-motion"],
    enabled: true,
    notes: "Configurable motion-control adapter for reference-driven animation.",
  },
];

export function modelsForCapability(capability: ModelCapability) {
  return MODEL_REGISTRY.filter((model) => model.enabled && model.capabilities.includes(capability));
}
