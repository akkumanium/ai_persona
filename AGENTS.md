# Persona Studio Agent Guide

This repo is a Next.js + TypeScript + Supabase SaaS MVP for creating AI-influencer personas, reference avatars, still images, and videos.

## Current Product Defaults
- First screen is the authenticated creator workspace, not a marketing page.
- Minimal product-level safety: require rights confirmation and adult-persona confirmation for avatar creation; rely on provider moderation beyond that.
- Image provider: Nano Banana Pro through Google Gemini, default model `gemini-3-pro-image-preview`.
- Video provider: Wan, Kling, Seedance

## Architecture
- `src/components/studio-workspace.tsx` owns the client workspace UI and demo-mode state.
- `src/app/api/generate/*` contains generation route handlers.
- `src/lib/providers/*` contains provider interfaces, Nano Banana Pro image adapter, Wan video adapter, and demo fallbacks.
- `src/lib/model-registry.ts` is the model/capability source of truth.
- `supabase/migrations/001_initial_schema.sql` defines the production schema and RLS policies.

## Environment
Use `.env.example` as the source for local env names.

Required for production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `WAN_API_BASE_URL`
- `WAN_API_KEY`

Without provider keys the app stays usable in demo mode and returns generated placeholder assets.

## Commands
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`

## Implementation Notes
- Keep provider-specific details behind `ImageProvider` and `VideoProvider`.
- Store raw provider responses on jobs when persistence is connected.
- When adding billing, reuse `credit_ledger`; do not wire checkout into generation routes directly.
