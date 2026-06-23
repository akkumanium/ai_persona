export const NANO_BANANA_PRO_MODEL_ID = "gemini-3-pro-image";
export const CHATGPT_IMAGE_MODEL_ID = "gpt-image-2";
export const SEEDREAM_4_5_MODEL_ID = "seedream-v4.5";

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

export const chatGptImageAspectRatios = ["1:1", "2:3", "3:2"];
export const seedream45AspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
export const nanoBananaProImageSizes = ["1K", "2K", "4K"];
export const seedream45ImageSizes = ["2K", "4K"];
export const chatGptImageQualities = ["low", "medium", "high"];

export function isChatGptImageModel(modelId: string) {
  return modelId.startsWith("gpt-");
}

export function isSeedream45ImageModel(modelId: string) {
  return modelId === SEEDREAM_4_5_MODEL_ID;
}

export function aspectRatiosForImageModel(modelId: string) {
  if (isChatGptImageModel(modelId)) return chatGptImageAspectRatios;
  if (isSeedream45ImageModel(modelId)) return seedream45AspectRatios;
  return nanoBananaProAspectRatios;
}

export function supportsImageSize(modelId: string) {
  return !isChatGptImageModel(modelId);
}

export function imageSizesForModel(modelId: string) {
  return isSeedream45ImageModel(modelId) ? seedream45ImageSizes : nanoBananaProImageSizes;
}

export function supportsImageQuality(modelId: string) {
  return isChatGptImageModel(modelId);
}
