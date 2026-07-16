# THIS MIGHT BE OUTDATED, ALWAYS RE-CHECK/ASK USER BEFORE MAKING CONCLUSIONS
# Idolborn

Idolborn is a Next.js SaaS MVP for creating AI-influencer personas and generating reference avatars, campaign images, and short videos from those references.

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

- WaveSpeed-hosted image models: Nano Banana Pro, ChatGPT Image 2, Seedream 4.5, and Wan 2.7 Image

Video generation:

- WaveSpeed-hosted video models: Wan, Kling, and Seedance, including motion-control options where supported

ElevenLabs provides speech generation. WaveSpeed provides every image, video, and avatar model listed above; model names do not indicate separate direct integrations. If a required provider key is missing, the adapter returns a clear API-not-configured error instead of a demo asset. The test suite still imports mock providers directly.

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

WHOP_API_KEY=
WHOP_WEBHOOK_SECRET=
WHOP_COMPANY_ID=
WHOP_ENVIRONMENT=sandbox
WHOP_MONTHLY_PLAN_ID=
WHOP_YEARLY_PLAN_ID=
WHOP_TOPUP_PLAN_ID_2=
WHOP_TOPUP_PLAN_ID_5=
WHOP_TOPUP_PLAN_ID_10=
WHOP_TOPUP_PLAN_ID_20=
WHOP_TOPUP_PLAN_ID_50=
WHOP_TOPUP_PLAN_ID_100=

WAVESPEED_API_KEY=
# Public HTTPS endpoint, for example https://app.example.com/api/wavespeed/webhook
WAVESPEED_WEBHOOK_URL=
# Signing secret from the WaveSpeed webhook configuration (whsec_...)
WAVESPEED_WEBHOOK_SECRET=
ELEVENLABS_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

```

Every Whop plan ID must be nonempty and unique. Subscription plans and top-up plans must never share an ID. Sandbox and production require separate keys, company IDs, catalogs, plan IDs, and webhook endpoints. Production billing refuses ambiguous or incomplete catalogs. See `DEPLOYMENT.md` for catalog and rollout checks.

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

Apply all migrations through `021_whop_billing.sql` before deploying this release. Migration 021 preserves balances and ledger history while moving billing identifiers, webhook processing, refunds, disputes, and recovery to Whop.

When Supabase is configured, `/studio` and generation routes require an authenticated user, while active subscription state is enforced by the database when credits are reserved. The Vercel Hobby-compatible schedule runs generation-job recovery once daily. Billing recovery is manual through the protected `/api/internal/billing/reconcile` endpoint; both use `CRON_SECRET` authorization.

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

This is an MVP codebase with a complete frontend workflow, authenticated entry points, validated generation API routes, provider adapters, Supabase-backed workspace persistence, and Whop-backed billing. Production billing still requires the external catalog, webhook, environment values, and smoke tests described in `DEPLOYMENT.md`.
