export const NANO_BANANA_PRO_MODEL_ID = "gemini-3-pro-image";
export const CHATGPT_IMAGE_MODEL_ID = "gpt-image-2";

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
export const nanoBananaProImageSizes = ["1K", "2K", "4K"];
export const chatGptImageQualities = ["low", "medium", "high"];

export function isChatGptImageModel(modelId: string) {
  return modelId.startsWith("gpt-");
}

export function aspectRatiosForImageModel(modelId: string) {
  return isChatGptImageModel(modelId) ? chatGptImageAspectRatios : nanoBananaProAspectRatios;
}

export function supportsImageSize(modelId: string) {
  return !isChatGptImageModel(modelId);
}

export function supportsImageQuality(modelId: string) {
  return isChatGptImageModel(modelId);
}
