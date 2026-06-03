# AI-Influencer Creation Site Plan

## Summary
Persona Studio is a production-oriented SaaS MVP for creating AI-influencer personas. Users can generate a reference avatar from a prompt or blended source images, generate still images from that reference, and generate normal or motion-control video from the same persona.

The repo includes shared instructions for Codex, Copilot, and future agents:
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `docs/AI_INFLUENCER_SITE_PLAN.md`

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, and RLS
- Provider adapters for images and video

## Providers
- Image generation: Nano Banana Pro through Google Gemini image generation.
- Default image model: `gemini-3-pro-image-preview`.
- Video generation: Wan-compatible adapter.
- Video models: `wan-2.2` for normal video and `wan-animate` for motion-control video.
- Kling is not part of this implementation.

Provider references:
- Google Gemini image generation: https://ai.google.dev/gemini-api/docs/image-generation
- Google Cloud Gemini 3 Pro Image model: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image

## Core Data Model
- `personas`: user-owned creator identities with immutable reference avatar links.
- `assets`: uploaded, generated image, generated video, and reference-avatar files.
- `generation_jobs`: normalized queue state plus raw provider responses.
- `provider_configs`: encrypted provider key references and enabled models.
- `credit_ledger`: usage accounting for future billing.

## Product Behavior
- The workspace is the first screen.
- Users can create personas in prompt mode or image-blend mode.
- Avatar creation requires rights confirmation and adult-persona confirmation.
- Persona image generation uses the selected reference avatar.
- Video generation uses the selected reference avatar and either normal or motion-control mode.
- Missing API keys trigger demo-mode output instead of breaking the UI.

## Implementation Notes
- Keep provider code in `src/lib/providers`.
- Keep model capability definitions in `src/lib/model-registry.ts`.
- Route handlers validate input with Zod before calling providers.
- Connect Supabase persistence by replacing demo-mode state with queries against the schema in `supabase/migrations`.
