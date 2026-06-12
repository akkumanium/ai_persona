import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/lib/env";
import { estimateSpeechGenerationPricing } from "@/lib/pricing";
import type {
  SpeechGenerationRequest,
  SpeechGenerationResult,
  SpeechProvider,
} from "@/lib/providers/types";

export class ElevenLabsSpeechProvider implements SpeechProvider {
  name = "elevenlabs" as const;

  async generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult> {
    if (!env.elevenLabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured. ElevenLabs speech generation is not connected.");
    }

    const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });
    const audioStream = await client.textToSpeech.convert(request.voiceId, {
      text: request.text,
      modelId: request.model,
      outputFormat: request.outputFormat,
      languageCode: request.languageCode,
      seed: request.seed,
      voiceSettings: {
        stability: request.stability,
        similarityBoost: request.similarityBoost,
        style: request.style,
        speed: request.speed,
        useSpeakerBoost: request.useSpeakerBoost,
      },
    });
    const bytes = await readableStreamToUint8Array(audioStream);
    const mimeType = request.outputFormat.startsWith("wav") ? "audio/wav" : "audio/mpeg";

    return {
      provider: this.name,
      model: request.model,
      asset: {
        url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
        mimeType,
        providerAssetId: `elevenlabs-${request.voiceId}-${Date.now()}`,
      },
      costEstimateCents: estimateSpeechGenerationPricing(request).tokens,
      raw: {
        voiceId: request.voiceId,
        model: request.model,
        outputFormat: request.outputFormat,
        characterCount: request.text.length,
      },
    };
  }
}

async function readableStreamToUint8Array(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    totalLength += value.length;
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}
