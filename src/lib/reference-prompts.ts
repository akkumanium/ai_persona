import type { ReferenceSlotId } from "@/components/studio/types";

export const DEFAULT_PROMPTS = {
  face:
    "Create a hyperrealistic close-up face reference for this persona, clean studio lighting, neutral expression, consistent facial identity, high-resolution, 4K.",
  faceGrid:
    "A 3x3 grid face sheet of the same woman, consistent facial identity, showing multiple different expressions (smiling, neutral, surprised, angry, sad) and looking into different directions. Character model sheet, extremely photorealistic, identical facial features, studio lighting, clean background, no text.",
  hybrid:
    "Make a hybrid of these two faces, merge them into a single, cohesive identity with balanced proportions. Soft, even passport-photo lighting, a plain light gray or off-white background, and true-to-life color. Natural, detailed skin with subtle pores and realistic texture. Realistic, clean, high-resolution, 4K.",
  body:
    "Create a hyperrealistic knee-up portrait of the same woman from the reference photo, using the uploaded face as the sole identity reference. Preserve her facial structure, skin tone, and neutral closed-mouth expression. She is fit and curvy with an athletic, proportional hourglass figure, a narrow waist, rounded hips and thighs, and long legs with a short torso. Increase the size of her bust in a tasteful manner. She is standing front-facing and centered, wearing a fitted gym bra and tight athletic shorts. Use soft, even studio lighting, a clean solid white background, and neutral shadows. Sharp focus, eye-level shot, 35mm lens look, realistic skin texture, natural pores, and lifelike hair strands.",
  chestUp:
    "Create a clean, photorealistic chest-up reference portrait of this persona with consistent facial identity, visible shoulders, natural posture, soft studio lighting, clean background, high-resolution, 4K.",
} as const;

export const referenceSlots: { id: ReferenceSlotId; label: string; prompt: string; aspectRatio: "9:16" }[] = [
  { id: "face", label: "Face", prompt: DEFAULT_PROMPTS.face, aspectRatio: "9:16" },
  { id: "chest-up", label: "Chest-up", prompt: DEFAULT_PROMPTS.chestUp, aspectRatio: "9:16" },
  { id: "body", label: "Body", prompt: DEFAULT_PROMPTS.body, aspectRatio: "9:16" },
  { id: "face-grid", label: "Face Grid", prompt: DEFAULT_PROMPTS.faceGrid, aspectRatio: "9:16" },
];

export function promptForReferenceSlot(slotId: ReferenceSlotId) {
  return referenceSlots.find((slot) => slot.id === slotId)?.prompt ?? DEFAULT_PROMPTS.face;
}
