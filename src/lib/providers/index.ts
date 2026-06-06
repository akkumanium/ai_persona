import { NanoBananaProvider } from "@/lib/providers/nano-banana";
import { OpenAIImageProvider } from "@/lib/providers/openai-image";
import { KlingVideoProvider } from "@/lib/providers/kling";
import { SeedanceVideoProvider } from "@/lib/providers/seedance";
import { WanVideoProvider } from "@/lib/providers/wan";
import type { ImageProvider, VideoProvider } from "@/lib/providers/types";

const nanoBananaProvider = new NanoBananaProvider();
const openAIImageProvider = new OpenAIImageProvider();
const wanVideoProvider = new WanVideoProvider();
const klingVideoProvider = new KlingVideoProvider();
const seedanceVideoProvider = new SeedanceVideoProvider();

export const imageProvider: ImageProvider = {
	name: "nano-banana-pro",
	async generate(request) {
		if (request.model.startsWith("gpt-")) {
			return openAIImageProvider.generate(request);
		}

		return nanoBananaProvider.generate(request);
	},
};

export const videoProvider: VideoProvider = {
  name: "wan",
  async submit(request) {
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

    if (providerJobId.startsWith("cgt-")) {
      return seedanceVideoProvider.poll(providerJobId);
    }

    if (providerJobId.startsWith("kling-")) {
      return klingVideoProvider.poll(providerJobId);
    }

    return wanVideoProvider.poll(providerJobId);
  },
};
