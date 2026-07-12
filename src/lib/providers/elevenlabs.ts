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

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voiceId)}?output_format=${encodeURIComponent(request.outputFormat)}`, {
      method: "POST",
      headers: { "xi-api-key": env.elevenLabsApiKey, "Content-Type": "application/json", Accept: "audio/*" },
      body: JSON.stringify({
        text: request.text,
        model_id: request.model,
        language_code: request.languageCode,
        seed: request.seed,
        voice_settings: {
          stability: request.stability,
          similarity_boost: request.similarityBoost,
          style: request.style,
          speed: request.speed,
          use_speaker_boost: request.useSpeakerBoost,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`ElevenLabs request failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 25 * 1024 * 1024) throw new Error("ElevenLabs audio response is too large.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("ElevenLabs audio response is too large.");
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
