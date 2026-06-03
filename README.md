# Persona Studio

Persona Studio is a Next.js + Supabase SaaS MVP for creating AI-influencer personas, reference avatars, images, and Wan-powered videos.

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The app runs in demo mode without API keys. Copy `.env.example` to `.env.local` and fill provider values to use real services.

## Providers

- Images: Nano Banana Pro via Gemini, default model `gemini-3-pro-image-preview`
- Videos: Wan-compatible adapter, models `wan-2.2` and `wan-animate`
- Kling is intentionally not included.

## Useful Commands

```bash
npm run lint
npm test
npm run build
```

## Agent Docs

Agents should read `AGENTS.md` first. Copilot-specific instructions live in `.github/copilot-instructions.md`, and the broader implementation plan is in `docs/AI_INFLUENCER_SITE_PLAN.md`.
