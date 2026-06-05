import { NanoBananaProvider } from "@/lib/providers/nano-banana";
import { OpenAIImageProvider } from "@/lib/providers/openai-image";
import { WanVideoProvider } from "@/lib/providers/wan";
import type { ImageProvider } from "@/lib/providers/types";

const nanoBananaProvider = new NanoBananaProvider();
const openAIImageProvider = new OpenAIImageProvider();

export const imageProvider: ImageProvider = {
	name: "nano-banana-pro",
	async generate(request) {
		if (request.model.startsWith("gpt-")) {
			return openAIImageProvider.generate(request);
		}

		return nanoBananaProvider.generate(request);
	},
};
export const videoProvider = new WanVideoProvider();
