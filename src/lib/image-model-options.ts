export const NANO_BANANA_PRO_MODEL_ID = "gemini-3-pro-image";
export const CHATGPT_IMAGE_MODEL_ID = "gpt-image-2";
export const SEEDREAM_4_5_MODEL_ID = "seedream-v4.5";
export const WAN_2_7_IMAGE_MODEL_ID = "wan-2.7-image";
export const WAN_2_7_IMAGE_EDIT_MODEL_ID = "wan-2.7-image-edit";

export const nanoBananaProAspectRatios = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];

export const chatGptImageAspectRatios = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
export const seedream45AspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
export const wan27ImageAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
export const nanoBananaProImageSizes = ["1K", "2K", "4K"];
export const chatGptImageSizes = ["1K", "2K", "4K"];
export const seedream45ImageSizes = ["2K", "4K"];
export const wan27ImageSizes = ["1K", "2K"];
export const chatGptImageQualities = ["low", "medium", "high"];

export function isChatGptImageModel(modelId: string) {
  return modelId.startsWith("gpt-");
}

export function isSeedream45ImageModel(modelId: string) {
  return modelId === SEEDREAM_4_5_MODEL_ID;
}

export function isWan27ImageModel(modelId: string) {
  return modelId === WAN_2_7_IMAGE_MODEL_ID;
}

export function isWan27ImageEditModel(modelId: string) {
  return modelId === WAN_2_7_IMAGE_EDIT_MODEL_ID;
}

export function isWan27ImageFamilyModel(modelId: string) {
  return isWan27ImageModel(modelId) || isWan27ImageEditModel(modelId);
}

export function aspectRatiosForImageModel(modelId: string) {
  if (isChatGptImageModel(modelId)) return chatGptImageAspectRatios;
  if (isSeedream45ImageModel(modelId)) return seedream45AspectRatios;
  if (isWan27ImageFamilyModel(modelId)) return wan27ImageAspectRatios;
  return nanoBananaProAspectRatios;
}

export function supportsImageSize(modelId: string) {
  return true;
}

export function imageSizesForModel(modelId: string) {
  if (isChatGptImageModel(modelId)) return chatGptImageSizes;
  if (isWan27ImageFamilyModel(modelId)) return wan27ImageSizes;
  return isSeedream45ImageModel(modelId) ? seedream45ImageSizes : nanoBananaProImageSizes;
}

export function supportsImageQuality(modelId: string) {
  return isChatGptImageModel(modelId);
}

export function supportsImageReferences(modelId: string) {
  return true;
}

export function requiresImageReferences(modelId: string) {
  return isWan27ImageEditModel(modelId);
}
