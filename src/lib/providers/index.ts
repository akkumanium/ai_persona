import { NanoBananaProvider } from "@/lib/providers/nano-banana";
import { WanVideoProvider } from "@/lib/providers/wan";

export const imageProvider = new NanoBananaProvider();
export const videoProvider = new WanVideoProvider();
