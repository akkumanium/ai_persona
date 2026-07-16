import { ElevenLabsSpeechProvider } from "@/lib/providers/elevenlabs";
import { WavespeedAvatarProvider, WavespeedMediaProvider } from "@/lib/providers/wavespeed";
import type { AsyncImageProvider, AvatarProvider, SpeechProvider, VideoProvider } from "@/lib/providers/types";

const wavespeedMediaProvider = new WavespeedMediaProvider();
const elevenLabsSpeechProvider = new ElevenLabsSpeechProvider();
const wavespeedAvatarProvider = new WavespeedAvatarProvider();

export const imageProvider: AsyncImageProvider = {
	name: "wavespeed",
	async submit(request) {
		return wavespeedMediaProvider.submitImage(request);
	},
  async poll(providerJobId) {
    return wavespeedMediaProvider.pollImage(providerJobId);
	},
};

export const videoProvider: VideoProvider = {
  name: "wavespeed",
  async submit(request) {
    return wavespeedMediaProvider.submit(request);
  },
  async poll(providerJobId) {
    return wavespeedMediaProvider.poll(providerJobId);
  },
};

export const speechProvider: SpeechProvider = elevenLabsSpeechProvider;
export const avatarProvider: AvatarProvider = wavespeedAvatarProvider;
