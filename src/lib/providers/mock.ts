import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "@/lib/providers/types";

function encodedSvg(label: string, detail: string, palette: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <rect width="1200" height="1500" fill="${palette[0]}"/>
  <circle cx="910" cy="260" r="180" fill="${palette[1]}" opacity=".5"/>
  <rect x="170" y="190" width="860" height="1120" rx="42" fill="${palette[2]}" opacity=".92"/>
  <circle cx="600" cy="540" r="190" fill="${palette[3]}"/>
  <path d="M340 1170c60-240 460-240 520 0" fill="${palette[4]}"/>
  <text x="600" y="100" text-anchor="middle" font-family="Arial" font-size="54" font-weight="700" fill="#1c1c1c">${label}</text>
  <text x="600" y="1370" text-anchor="middle" font-family="Arial" font-size="32" fill="#1c1c1c">${detail}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function mockImageGeneration(
  request: ImageGenerationRequest,
): Promise<ImageGenerationResult> {
  const assets = Array.from({ length: request.count }, (_, index) => ({
    url: encodedSvg(
      request.generationType.includes("avatar") ? "Reference Avatar" : "Generated Image",
      `${request.model} · ${request.aspectRatio} · ${index + 1}`,
      ["#f2efe7", "#75a99a", "#fffaf0", "#b9826b", "#253c35"],
    ),
    mimeType: "image/svg+xml",
    providerAssetId: `demo-image-${Date.now()}-${index}`,
  }));

  return {
    provider: "demo",
    model: request.model,
    assets,
    costEstimateCents: request.generationType.includes("avatar") ? 12 : 18,
    raw: { demo: true, prompt: request.prompt },
  };
}

export async function mockVideoGeneration(
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  return {
    provider: "demo",
    model: request.model,
    status: "succeeded",
    providerJobId: `demo-video-${Date.now()}`,
    asset: {
      url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      mimeType: "video/mp4",
      providerAssetId: `demo-video-asset-${Date.now()}`,
    },
    costEstimateCents: request.mode === "motion" ? 95 : Math.max(50, request.durationSeconds * 14),
    raw: {
      demo: true,
      mode: request.mode,
      prompt: request.prompt,
      startFrameImageUrl: request.startFrameImageUrl,
      endFrameImageUrl: request.endFrameImageUrl,
      durationSeconds: request.durationSeconds,
      aspectRatio: request.aspectRatio,
      motionReferenceVideo: Boolean(request.motionReferenceVideo),
    },
  };
}
