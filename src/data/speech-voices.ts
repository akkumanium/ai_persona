export type SpeechVoicePreset = {
  id: string;
  label: string;
  description?: string;
};

export const SPEECH_VOICE_PRESETS: SpeechVoicePreset[] = [
  // Add developer-approved ElevenLabs voice IDs here, for example:
  // { id: "EXAMPLE_VOICE_ID", label: "Warm editorial narrator", description: "Soft, polished, commercial." },
];
