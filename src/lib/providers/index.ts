import { NanoBananaProvider } from "@/lib/providers/nano-banana";
import { OpenAIImageProvider } from "@/lib/providers/openai-image";
import { KlingVideoProvider } from "@/lib/providers/kling";
import { ElevenLabsSpeechProvider } from "@/lib/providers/elevenlabs";
import { SeedanceVideoProvider } from "@/lib/providers/seedance";
import { WanVideoProvider } from "@/lib/providers/wan";
import { WavespeedAvatarProvider, WavespeedMediaProvider } from "@/lib/providers/wavespeed";
import type { AvatarProvider, ImageProvider, SpeechProvider, VideoProvider } from "@/lib/providers/types";

const nanoBananaProvider = new NanoBananaProvider();
const openAIImageProvider = new OpenAIImageProvider();
const wanVideoProvider = new WanVideoProvider();
const klingVideoProvider = new KlingVideoProvider();
const seedanceVideoProvider = new SeedanceVideoProvider();
const wavespeedMediaProvider = new WavespeedMediaProvider();
const elevenLabsSpeechProvider = new ElevenLabsSpeechProvider();
const wavespeedAvatarProvider = new WavespeedAvatarProvider();

export const imageProvider: ImageProvider = {
	name: "wavespeed",
	async generate(request) {
    if (process.env.USE_LEGACY_IMAGE_PROVIDERS === "true") {
      if (request.model.startsWith("gpt-")) {
        return openAIImageProvider.generate(request);
      }

      return nanoBananaProvider.generate(request);
    }

		return wavespeedMediaProvider.generate(request);
	},
};

export const videoProvider: VideoProvider = {
  name: "wavespeed",
  async submit(request) {
    if (process.env.USE_LEGACY_VIDEO_PROVIDERS !== "true") {
      return wavespeedMediaProvider.submit(request);
    }

    if (request.model === "kling" || request.model.startsWith("kling-")) {
      return klingVideoProvider.submit(request);
    }

    if (request.model === "seedance" || request.model.includes("seedance")) {
      return seedanceVideoProvider.submit(request);
    }

    return wanVideoProvider.submit(request);
  },
  async poll(providerJobId) {
    const [provider, taskId] = providerJobId.includes(":")
      ? providerJobId.split(":", 2)
      : ["", providerJobId];

    if (provider === "seedance") {
      return seedanceVideoProvider.poll(taskId);
    }

    if (provider === "kling") {
      return klingVideoProvider.poll(taskId);
    }

    if (provider === "wan") {
      return wanVideoProvider.poll(taskId);
    }

    if (provider === "wavespeed" || process.env.USE_LEGACY_VIDEO_PROVIDERS !== "true") {
      return wavespeedMediaProvider.poll(taskId);
    }

    if (providerJobId.startsWith("cgt-")) {
      return seedanceVideoProvider.poll(providerJobId);
    }

    if (providerJobId.startsWith("kling-")) {
      return klingVideoProvider.poll(providerJobId);
    }

    return wanVideoProvider.poll(providerJobId);
  },
};

export const speechProvider: SpeechProvider = elevenLabsSpeechProvider;
export const avatarProvider: AvatarProvider = wavespeedAvatarProvider;
