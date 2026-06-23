# Persona Studio

Persona Studio is a Next.js SaaS MVP for creating AI-influencer personas and generating reference avatars, campaign images, and short videos from those references.

The app currently has a polished home page at `/`, Supabase Auth entry points, and the working creation workspace at `/studio`.

## What It Does

- Create and manage creator personas.
- Build reference sets for face, face-grid, body, and extra identity shots.
- Generate avatars from prompts or by blending uploaded face references.
- Generate persona-consistent still images from one or more references.
- Generate normal and motion-control videos from selected images or reference media.
- Track generation jobs, assets, and estimated token usage in the UI.
- Sign up and log in with Supabase Auth using Google or email and password.
- Require provider API keys for runtime generation instead of silently returning demo output.

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Zod validation
- Supabase schema for Auth, Postgres, Storage, and RLS
- Vitest provider/model tests

## Provider Support

Image generation:

- Nano Banana Pro / Gemini image generation, default model `gemini-3-pro-image-preview`
- OpenAI image generation, default model `gpt-image-2`

Video generation:

- Wan adapter, including `wan-2.7` and `wan-animate`
- Kling image-to-video, including `kling-v2-6` and `kling-v3-0`
- Seedance 2.0, including standard and fast model options

If the relevant provider key is missing, the adapter returns a clear API-not-configured error instead of a demo asset. The test suite still imports mock providers directly.

## Project Structure

```text
src/app/                 App Router pages and API routes
src/components/          Home page and studio UI components
src/components/studio/   Persona, reference, generation, asset, job, and settings views
src/lib/providers/       Image and video provider adapters plus demo fallback providers
src/lib/model-registry.ts Model capability registry used by the UI
src/lib/schemas.ts       Zod request validation for generation endpoints
supabase/migrations/     Initial database, storage bucket, and RLS schema
docs/                    Product and implementation planning notes
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` for the home page or `http://localhost:3000/studio` for the workspace.

## Environment Variables

Add provider keys before running real generations:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET_KEY=
NEXT_PUBLIC_PADDLE_PRICE_ID_5=
NEXT_PUBLIC_PADDLE_PRICE_ID_10=

GEMINI_API_KEY=
NANO_BANANA_MODEL=gemini-3-pro-image-preview

OPENAI_API_KEY=

WAN_API_BASE_URL=
WAN_API_KEY=

KLING_API_BASE_URL=https://api-singapore.klingai.com
KLING_API_KEY=
KLING_MODEL=kling-v2-6

SEEDANCE_API_BASE_URL=https://ark.ap-southeast.bytepluses.com
SEEDANCE_API_KEY=
SEEDANCE_MODEL=dreamina-seedance-2-0-260128
```

## Supabase

The initial schema is in `supabase/migrations/001_initial_schema.sql`. It defines:

- `personas`
- `assets`
- `generation_jobs`
- `provider_configs`
- `credit_ledger`
- private storage buckets for uploads and generated media
- row-level security policies for user-owned data

`supabase/migrations/002_auth_account_security.sql` adds account profiles, token balances stored in the existing balance column, auth user profile creation, stronger storage path policies, and asset metadata needed for persisted references.

When Supabase is configured, `/studio` and the generation API routes require an authenticated user. The current workspace still keeps personas, assets, jobs, and usage in local UI state until the persistence layer is connected to Supabase queries and storage writes.

### Supabase Auth Setup

1. Create a Supabase project.
2. Run the SQL migrations in `supabase/migrations` in order.
3. Add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. In Supabase Auth URL Configuration, set the site URL to your app URL, for example `http://localhost:3000` locally.
5. Add redirect URLs for local and production auth callbacks:

```text
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

6. Enable the Email provider in Supabase Auth.
7. Enable the Google provider in Supabase Auth and add the Google OAuth credentials from Google Cloud Console.

## Scripts

```bash
npm run dev     # start the local Next.js dev server
npm run build   # build for production
npm run start   # run the production build
npm run lint    # run ESLint
npm run test    # run Vitest
```

## Current Status

This is an MVP codebase with a complete frontend workflow, authenticated entry points, validated generation API routes, provider adapters, and database schema. Supabase-backed workspace persistence and production billing are planned follow-up work rather than fully wired runtime behavior.
