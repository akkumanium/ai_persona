# Legal Data Inventory

Status: factual repository inventory only. Do not treat this as a privacy policy, terms, legal advice, or a compliance conclusion.

Scope reviewed:
- Next.js app routes, API routes, React components, provider adapters, env configuration, package dependencies, Supabase migrations, and storage helpers.
- Evidence files include `src/app/**`, `src/components/**`, `src/lib/**`, `supabase/migrations/**`, `package.json`, `next.config.ts`, and `.env.local` variable names only.

## High-Level Findings

- The website uses Supabase for authentication, session cookies, Postgres data, and private Storage buckets.
- The website uses Paddle for checkout, billing webhooks, billing portal sessions, and refund requests when configured.
- Generation workflows may send prompts, uploaded images, uploaded audio, uploaded video, generated/selected media URLs, model settings, and job IDs to external AI/media providers.
- The current default provider router sends image, video, and avatar generation through WaveSpeed unless legacy provider env flags are set. ElevenLabs is used for speech generation.
- Legacy or optional adapters exist for OpenAI image generation, Google Gemini/Nano Banana, Wan, Kling, and Seedance/BytePlus.
- No analytics SDK, advertising pixel, behavioral tracker, or error-monitoring SDK was found in dependencies or source.
- No custom `localStorage`, `sessionStorage`, or `document.cookie` use was found. Cookies are managed through Supabase SSR helpers.
- A `ContactForm` component and `/api/contact` endpoint exist, but the current `/contact` page does not render that form; it links to email and Telegram instead.
- No code or config reviewed states that user data is sold or used for AI-provider training.

## Runtime Configuration Observed

Code supports these env vars: Supabase, Paddle, Gemini, OpenAI, Wan, Kling, Seedance/BytePlus, WaveSpeed, ElevenLabs, and contact email.

The local `.env.local` file contains only variable names for:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`

Do not infer production configuration from `.env.local`.

## Forms and User Input

### Authentication dialog

Evidence: `src/components/auth/auth-button.tsx`, `src/app/auth/signin/page.tsx`, `src/app/auth/callback/route.ts`, `supabase/migrations/002_auth_account_security.sql`, `supabase/migrations/008_referrals.sql`

Collected:
- Email address.
- Password.
- Google OAuth login data when "Continue with Google" is used.
- Referral code in URL/query or signup metadata when present.

Sent to:
- Supabase Auth for email/password sign in and signup.
- Google through Supabase OAuth when Google login is selected.
- Supabase Postgres function `claim_referral` when referral code is present.

Purpose:
- Account creation, login, session management, associating workspace/billing data to a user, referral attribution.

Stored:
- Supabase Auth stores auth user data outside the public migrations.
- `account_profiles.user_id`, `display_name`, `avatar_url`, `credit_balance_cents`, `default_currency`, `billing_customer_id`, `account_metadata`, `referral_code`, `referred_by_user_id`, timestamps.
- `display_name` is initialized from `full_name`, `name`, or email. `avatar_url` is initialized from OAuth metadata if present.

Retention behavior visible in code:
- `account_profiles.user_id` references `auth.users(id) on delete cascade`.
- No age-based auth/account deletion schedule was found.
- Supabase auth cookie/session retention is controlled by Supabase settings, not specified in this repo.

Uncertainty:
- Which Supabase Auth providers are enabled in production.
- Supabase Auth email/password rules, email confirmation settings, MFA settings, and session duration.
- Whether Google OAuth is enabled in production.

### Contact message API and unused contact form component

Evidence: `src/components/contact-form.tsx`, `src/app/api/contact/route.ts`, `supabase/migrations/005_contact_messages.sql`, `src/app/contact/page.tsx`

Collected by component/API:
- Name.
- Optional email.
- Message.
- Honeypot `company`.
- Request `user-agent`.
- Request `referer` as `page_url`.

Sent to:
- Supabase table `contact_messages`.

Purpose:
- Receiving support/contact messages and spam filtering through honeypot field.

Stored:
- `contact_messages.name`, `email`, `message`, `user_agent`, `page_url`, `created_at`.

Retention behavior visible in code:
- No deletion schedule found.
- Public insert is allowed; service role has select/update/delete.

Current route/UI status:
- `/api/contact` is live in code.
- `ContactForm` is exported but no import or render usage was found. Current `/contact` page displays mailto and Telegram links instead.

Uncertainty:
- Whether the contact form is intended to be re-enabled.
- How contact messages are reviewed/deleted operationally.

### Persona creation and editing

Evidence: `src/components/studio/personas-view.tsx`, `src/components/studio-workspace.tsx`, `supabase/migrations/001_initial_schema.sql`

Collected:
- Persona name.
- Persona description.
- Persona style notes when edited elsewhere or included in generation requests.
- Persona status.

Sent to:
- Supabase table `personas`.
- Included in prompts sent to generation providers when creating references/images/videos.

Purpose:
- Saving user-created persona profiles and generating persona-consistent media.

Stored:
- `personas.user_id`, `name`, `description`, `style_notes`, `status`, `reference_asset_id`, timestamps.

Retention behavior visible in code:
- `personas.user_id references auth.users(id) on delete cascade`.
- Manual deletion exists in UI and deletes persona record.
- Existing assets are intentionally left untouched when persona is removed, per UI notice.
- No automatic deletion schedule found.

Uncertainty:
- Whether persona descriptions can contain real-person data in actual use.

### Guide admin forms

Evidence: `src/app/guides/admin/page.tsx`, `src/app/guides/admin/actions.ts`, `supabase/migrations/010_guide_articles.sql`

Collected:
- Article title, slug, eyebrow, summary, body, published status.
- Admin user ID as `author_user_id`.
- Admin access checks compare Supabase user ID or email against hardcoded admin values.

Sent to:
- Supabase table `guide_articles`.

Purpose:
- Admin content management for public guide articles.

Stored:
- `guide_articles.author_user_id` references `auth.users(id) on delete set null`.
- Article content and timestamps.

Retention behavior visible in code:
- No deletion UI or schedule found in reviewed files.
- If author account is deleted, `author_user_id` is set null.

Uncertainty:
- Whether guide body content may include personal data.

### Billing checkout and top-up controls

Evidence: `src/components/billing-plans.tsx`, `src/components/studio-paywall.tsx`, `src/components/studio/assets-jobs-settings.tsx`, `src/app/api/paddle/webhook/route.ts`, `src/app/api/billing/*`

Collected or sent:
- Signed-in user ID.
- Signed-in user email, sent to Paddle checkout as `customer.email` when available.
- Paddle price ID.
- `customData`: `app_user_id`, `plan_id`, and `source`.
- Paddle checkout event status in browser callback.
- Paddle webhook event ID, type, entity/transaction/subscription/customer IDs, status, full raw webhook payload.
- Refund request transaction ID and amount.

Sent to:
- Browser loads `https://cdn.paddle.com/paddle/v2/paddle.js`.
- Paddle checkout overlay.
- Paddle API for portal sessions and refund adjustments.
- Supabase tables and functions for billing state.

Purpose:
- Subscriptions, token top-ups, billing status, billing portal access, refunds, referral rewards.

Stored:
- `account_profiles.billing_customer_id`, `credit_balance_cents`, `account_metadata.paddle`.
- `billing_subscriptions.subscription_id`, `user_id`, `paddle_customer_id`, `status`, `plan_id`, `price_id`, billing period timestamps.
- `billing_webhook_events.event_id`, `event_type`, `user_id`, `paddle_entity_id`, `payload`, `error_message`, `processed_at`.
- `credit_ledger.user_id`, `job_id`, `amount_cents`, `description`, `created_at`.
- `billing_refund_requests.user_id`, `transaction_id`, `amount_cents`, `status`, `paddle_adjustment_id`, `failure_message`, timestamps.

Retention behavior visible in code:
- Most billing rows referencing `user_id` cascade on auth user deletion.
- `billing_webhook_events.user_id references auth.users(id) on delete set null`, so webhook records can remain after user deletion with `user_id` nulled.
- No automatic deletion schedule found.
- Raw Paddle webhook payloads are stored as JSONB without field-level minimization in this repo.

Uncertainty:
- Paddle production vs sandbox mode in production.
- Paddle account retention, tax/invoice data, payment-method handling, and cookie behavior.
- Whether raw webhook payload includes buyer address, tax, invoice, or payment details depending on Paddle event configuration.

### Referral features

Evidence: `src/app/api/referrals/claim/route.ts`, `src/app/api/referrals/me/route.ts`, `src/components/studio/assets-jobs-settings.tsx`, `supabase/migrations/008_referrals.sql`

Collected:
- Referral code from URL/query or form body.
- Referrer and referred user IDs.
- Referral reward status and amount.

Sent to:
- Supabase RPC `claim_referral`.
- Supabase tables `account_profiles` and `referral_rewards`.

Purpose:
- Attribute referred accounts and credit referral rewards after subscription.

Stored:
- `account_profiles.referral_code`, `referred_by_user_id`.
- `referral_rewards.referrer_user_id`, `referred_user_id`, `referral_code`, status, reward amount, rewarded subscription/event IDs, timestamps.

Retention behavior visible in code:
- `referral_rewards` participant IDs reference `auth.users(id) on delete cascade`.
- `referred_by_user_id` is `on delete set null`.
- No automatic deletion schedule found.

Uncertainty:
- Whether referral links are shared publicly or privately.

## Uploads and Generated Content

### General upload helper

Evidence: `src/components/studio/media.ts`, `src/app/api/media/upload/route.ts`, `src/lib/server/temp-media.ts`, `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/006_speech_avatar_wavespeed.sql`

Collected:
- Uploaded file bytes.
- Original file name.
- MIME type.
- User ID when authenticated.

Storage paths:
- If Supabase is enabled and a user exists: private Supabase Storage bucket with path `{userId}/{folder}/{uuid}-{safeFileName}`.
- If Supabase upload is not used or fails: server temp directory `os.tmpdir()/persona-studio-media`, returning `/api/media/temp/{tempKey}`.
- If temp upload fails in browser helper: file is converted to base64 and included directly in generation request.

Purpose:
- Reference images, source images, video frames, reference videos, reference audio, trend videos, avatar input media.

Retention behavior visible in code:
- Supabase storage buckets are private and user-scoped by RLS policies.
- Temp media files have no cleanup job or expiry in the repo. Route responses cache privately for one hour, but that is HTTP cache, not file deletion.
- Storage objects can be removed when an asset is deleted through the studio UI.

Uncertainty:
- Whether server/container temp directories are periodically cleaned by hosting infrastructure.
- Supabase Storage lifecycle rules, if any.

### Reference uploads

Evidence: `src/components/studio/personas-view.tsx`

Collected:
- User-uploaded reference images for slots such as face, face-grid, body, and other reference slots.
- Asset title and reference slot.

Sent to:
- Supabase Storage `uploads` bucket when enabled.
- Supabase table `assets`.
- Later generation providers when used as references.

Purpose:
- Save reusable persona reference assets.

Stored:
- `assets.kind = upload`, `storage_bucket`, `storage_path`, `public_url` proxy URL, title, prompt "Uploaded local reference.", persona ID, reference slot, model `local-upload`, MIME type.

Retention behavior visible in code:
- Asset records cascade on auth user deletion.
- Storage removal is attempted when an asset is deleted.
- No automatic deletion schedule found.

### Image/reference generation

Evidence: `src/components/studio/generate-persona-view.tsx`, `src/components/studio/generation-view.tsx`, `src/app/api/generate/image/route.ts`, `src/app/api/generate/avatar/route.ts`, `src/lib/providers/wavespeed.ts`, `src/lib/providers/openai-image.ts`, `src/lib/providers/nano-banana.ts`

Collected:
- Persona ID/name/description/style notes.
- Prompt and additional prompt.
- Uploaded/reference image files, names, MIME types, storage URLs or base64.
- Model, aspect ratio, image size, quality, count, reference slot.
- Rights confirmation and adult-persona confirmation for avatar reference generation.

Sent to:
- Default current route: WaveSpeed client upload and `client.run`.
- If legacy provider flags are set: OpenAI Images API or Google Gemini/Nano Banana API.
- Supabase Storage and tables for generated media and job records.

Purpose:
- Generate avatar/reference images and persona images.

Stored:
- `generation_jobs.input_params` stores prompt/settings, and for avatar generation stores source image count rather than raw image data.
- `generation_jobs.raw_provider_response` stores sanitized provider response.
- `assets` stores generated media metadata, prompt, provider, model, storage path, provider asset/job IDs.
- Generated images are materialized into Supabase `generated-images` when configured; otherwise temp media.

Retention behavior visible in code:
- Jobs/assets cascade on auth user deletion.
- No automatic deletion schedule found.
- `sanitizeProviderPayload` omits long data URLs/base64-like payloads from raw provider response.

Uncertainty:
- Provider-side retention and training/reuse practices for WaveSpeed/OpenAI/Gemini are not specified in this repo.
- Whether rights/adult confirmations are persisted. The code requires them for the request but does not appear to store the boolean values.

### Video generation and motion-control generation

Evidence: `src/components/studio/generation-view.tsx`, `src/components/studio/trend-video-view.tsx`, `src/app/api/generate/video/route.ts`, `src/lib/providers/wavespeed.ts`, `src/lib/providers/wan.ts`, `src/lib/providers/kling.ts`, `src/lib/providers/seedance.ts`

Collected:
- Persona ID/name.
- Video prompt, negative prompt, motion reference text.
- Start/end/reference image URLs or uploaded image bytes.
- Motion reference video file/URL.
- Seedance reference video/audio file or URL.
- Model, duration, aspect ratio, provider mode, CFG scale, generated audio flag, resolution, return-last-frame flag, motion mode, character orientation, keep-original-sound flag.

Sent to:
- Default current route: WaveSpeed.
- If legacy provider flags are set: Wan API, Kling API, or Seedance/BytePlus API.
- Supabase Storage/tables for generated video and job records.

Purpose:
- Generate normal videos, prompt videos, motion-control videos, and trend-video outputs.

Stored:
- Full `input_params: input` for `/api/generate/video`, which can include prompts, settings, media URLs, and potentially uploaded media metadata/base64 if the client sends inline `ProviderMediaInput`.
- `assets` records generated video metadata and storage paths.
- `generation_jobs.raw_provider_response` sanitized.
- Generated videos are materialized into Supabase `generated-videos` when configured; otherwise temp media.

Retention behavior visible in code:
- Jobs/assets cascade on auth user deletion.
- No automatic deletion schedule found.
- Storage removal is attempted when an asset is deleted.

Uncertainty:
- Provider-side retention/training/use of prompts and media.
- Whether production uses default WaveSpeed routing or legacy direct provider routing.

### Speech generation

Evidence: `src/components/studio/speech-avatar-view.tsx`, `src/app/api/generate/speech/route.ts`, `src/lib/providers/elevenlabs.ts`

Collected:
- Persona ID/name.
- Text to synthesize.
- Voice ID or preset voice ID.
- Speech model, output format, stability, similarity boost, style, speed, speaker boost, language code, seed.

Sent to:
- ElevenLabs text-to-speech API.
- Supabase Storage/table records for generated audio.

Purpose:
- Generate reusable speech audio assets.

Stored:
- `assets.prompt` stores the speech text.
- `generation_jobs.input_params` stores the input and explicitly includes `text` and `textLength`.
- `generated-audio` storage bucket stores generated audio when configured.

Retention behavior visible in code:
- Jobs/assets cascade on auth user deletion.
- No automatic deletion schedule found.

Uncertainty:
- ElevenLabs provider-side retention/training/use of text and generated audio.
- Whether custom voice IDs are user-owned or third-party voices.

### Talking avatar generation

Evidence: `src/components/studio/speech-avatar-view.tsx`, `src/app/api/generate/avatar/route.ts`, `src/lib/providers/wavespeed.ts`

Collected:
- Persona ID/name.
- Selected or uploaded image.
- Selected or uploaded audio.
- Uploaded audio name, MIME type, URL or base64 data.
- Prompt, model, resolution, duration, seed.

Sent to:
- WaveSpeed avatar models.
- Supabase Storage/table records for generated video.

Purpose:
- Create talking avatar videos from image and audio.

Stored:
- `generation_jobs.input_params` stores most input fields, but replaces `uploadedAudio` with name and MIME type only.
- Selected image/audio asset IDs are stored as `reference_asset_ids` when present.
- Generated video asset in `assets` and `generated-videos`.

Retention behavior visible in code:
- Jobs/assets cascade on auth user deletion.
- No automatic deletion schedule found.

Uncertainty:
- WaveSpeed provider-side retention/training/use of image/audio/prompt.

### Trend-video upload

Evidence: `src/components/studio/trend-video-view.tsx`, `src/app/api/media/upload/route.ts`

Collected:
- Uploaded trend video files.
- Uploaded video bytes, original/imported name, MIME type, size.
- First frame captured in browser as base64 JPEG for face generation.

Sent to:
- Supabase Storage `uploads` or server temp media.
- Later generation providers when used for face swap/motion generation.

Purpose:
- Import a source/trend video, capture first frame, create face candidates, and generate motion video using the source as motion reference.

Retention behavior visible in code:
- Imported URL videos saved through temp media unless uploaded through the file path with Supabase enabled.
- Trend video library itself is React state only; persisted asset/job records are created when generated face/video assets are saved.
- No temp cleanup job found.

Uncertainty:
- Remote video source terms and whether imported videos may contain third-party personal data.
- Hosting temp retention.

## Cookies and Client Storage

Evidence: `src/proxy.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, source search for storage/cookies.

Cookies:
- Supabase SSR helpers read and set auth/session cookies via `cookies.getAll()` and `setAll()`.
- Cookie names and lifetimes are determined by Supabase SSR/Auth libraries and project settings, not hardcoded in this repo.

Client storage:
- No direct `localStorage`, `sessionStorage`, or `document.cookie` use was found.

Purpose:
- Authentication/session refresh and user identity on server/client.

Retention behavior visible in code:
- Not specified by repo. Supabase Auth settings/library defaults control expiry/refresh.

Uncertainty:
- Exact cookie names, max-age, SameSite/Secure attributes in production.
- Whether Paddle.js sets cookies or local storage during checkout; this is external to the repo.

## Analytics, Advertising, and Error Monitoring

Evidence: `package.json`, package/source search.

Analytics:
- No Google Analytics, GTM, Vercel Analytics, Plausible, PostHog, Mixpanel, or similar analytics integration was found.

Advertising:
- No Meta/Facebook pixel, Google Ads/DoubleClick, TikTok pixel, or other ad tracker was found.

Error monitoring:
- No Sentry, LogRocket, Datadog RUM, Bugsnag, or similar error-monitoring SDK was found.
- `console.error` is used for Paddle webhook processing errors.

Uncertainty:
- Hosting platform logs and infrastructure analytics are not visible in this repo.

## External APIs and Third Parties

### Supabase

Data involved:
- Auth users, email/password/OAuth metadata, session cookies, public application tables, private storage buckets, RPC calls.

Purpose:
- Authentication, database, storage, RLS, billing/account records, guide admin, referrals, contact messages.

Retention visible:
- Database foreign keys define cascade/set-null behavior, but no timed retention schedule.

### Paddle

Data involved:
- User email, app user ID, plan/top-up ID, checkout events, customer/subscription/transaction IDs, raw webhook payload, refund requests.

Purpose:
- Payments, billing portal, subscription/top-up confirmation, refunds.

Retention visible:
- App stores raw webhook payloads with no deletion schedule. Paddle retention not specified.

### WaveSpeed

Data involved:
- Prompts, uploaded reference images/audio/video uploaded to WaveSpeed, model settings, provider task IDs, output URLs.

Purpose:
- Default image, video, and talking-avatar generation.

Retention visible:
- Provider retention not specified in repo.

### ElevenLabs

Data involved:
- Speech text, voice ID, voice settings, generated audio.

Purpose:
- Text-to-speech generation.

Retention visible:
- Provider retention not specified in repo.

### OpenAI Images API

Status:
- Optional legacy image provider when `USE_LEGACY_IMAGE_PROVIDERS === "true"` and model starts with `gpt-`.

Data involved:
- Prompt, image references for edits, model/quality/size/count.

Purpose:
- Image generation/editing.

Retention visible:
- Provider retention/training not specified in repo.

### Google Gemini / Nano Banana

Status:
- Optional legacy image provider when `USE_LEGACY_IMAGE_PROVIDERS === "true"` and non-OpenAI image model.

Data involved:
- Prompt and inline reference image data.

Purpose:
- Image generation.

Retention visible:
- Provider retention/training not specified in repo.

### Wan API

Status:
- Optional legacy video provider via `WAN_API_BASE_URL` and `WAN_API_KEY`.

Data involved:
- Prompts, image URLs, motion reference text/video, video settings.

Purpose:
- Video generation.

Retention visible:
- Provider retention/training not specified in repo.

### Kling API

Status:
- Optional legacy video provider for Kling models.

Data involved:
- Prompt, negative prompt, start/end image URL, duration, aspect ratio, mode, resolution, audio flag.

Purpose:
- Image-to-video generation and polling.

Retention visible:
- Provider retention/training not specified in repo.

### Seedance / BytePlus API

Status:
- Optional legacy video provider for Seedance models.

Data involved:
- Prompt, start/end image URLs, duration, ratio, resolution, audio flag.

Purpose:
- Video generation and polling.

Retention visible:
- Provider retention/training not specified in repo.

### Remote video/image URLs

Data involved:
- User-provided remote URLs and media fetched by server.
- Server request headers include a hardcoded browser-like User-Agent for video import.

Purpose:
- Importing trend videos or resolving media content for generation.

Retention visible:
- Remote host logging is outside this repo.

### Telegram and mailto contact links

Evidence: `src/app/contact/page.tsx`, `src/components/public-header.tsx`

Data involved:
- Clicking Telegram links or mailto links sends the user to external services. The app does not collect the message through these links.

Purpose:
- Support/contact.

Retention visible:
- External service behavior not specified in repo.

## Database Fields That May Involve Personal Data

### Supabase Auth

Not defined in migrations, but used by code:
- User ID.
- Email.
- Password auth data.
- OAuth metadata: `full_name`, `name`, `avatar_url`, `referral_code`.
- Auth session tokens/cookies.

### `account_profiles`

Fields:
- `user_id`: account identifier.
- `display_name`: initialized from OAuth name/full name or email.
- `avatar_url`: initialized from OAuth metadata.
- `credit_balance_cents`: account balance.
- `default_currency`: billing/account preference.
- `billing_customer_id`: Paddle customer ID.
- `account_metadata`: Paddle customer/subscription/status/event metadata.
- `referral_code`: user referral code.
- `referred_by_user_id`: referrer relationship.
- `created_at`, `updated_at`.

### `personas`

Fields:
- `user_id`, `name`, `description`, `style_notes`, `status`, `reference_asset_id`, timestamps.

### `assets`

Fields:
- `user_id`, `persona_id`, `kind`, `storage_bucket`, `storage_path`, `public_url`, `title`, `prompt`, `generation_type`, `provider`, `model`, `mime_type`, `provider_asset_id`, `provider_metadata`, `is_default_reference`, `reference_slot`, `reference_asset_ids`, `provider_job_id`, `created_at`.

Notes:
- `public_url` is generally an app proxy URL for private storage or temp media, not necessarily a publicly accessible third-party URL.
- `storage_path` includes user ID and may include sanitized original filename for uploads.

### `generation_jobs`

Fields:
- `user_id`, `persona_id`, `status`, `provider`, `provider_job_id`, `model`, `generation_type`, `input_params`, `output_asset_ids`, `cost_estimate_cents`, `raw_provider_response`, `error_message`, timestamps.

Notes:
- `input_params` may contain prompts, text for speech, media URLs, uploaded media names/MIME types, and sometimes inline media data depending on route and client fallback path.
- `raw_provider_response` is sanitized for long data URLs/base64-like payloads, but may still include provider IDs, URLs, statuses, and other metadata.

### `provider_configs`

Fields:
- `user_id`, `provider`, `encrypted_key_reference`, `enabled_models`, timestamps.

Notes:
- No reviewed UI currently writes user provider keys, but the table exists.

### `credit_ledger`

Fields:
- `user_id`, `job_id`, `amount_cents`, `description`, `created_at`.

### `billing_subscriptions`

Fields:
- `subscription_id`, `user_id`, `paddle_customer_id`, `status`, `plan_id`, `price_id`, period timestamps, created/updated timestamps.

### `billing_webhook_events`

Fields:
- `event_id`, `event_type`, `user_id`, `paddle_entity_id`, `processed_at`, `payload`, `error_message`.

Notes:
- `payload` stores the full Paddle event.
- `user_id` is set null on user deletion, so some billing event data can remain detached from the auth user.

### `contact_messages`

Fields:
- `name`, `email`, `message`, `user_agent`, `page_url`, `created_at`.

### `referral_rewards`

Fields:
- `referrer_user_id`, `referred_user_id`, `referral_code`, `status`, `reward_amount_cents`, `rewarded_subscription_id`, `rewarded_event_id`, `created_at`, `rewarded_at`.

### `billing_refund_requests`

Fields:
- `user_id`, `transaction_id`, `amount_cents`, `status`, `paddle_adjustment_id`, `failure_message`, timestamps.

### `guide_articles`

Fields:
- `slug`, `title`, `eyebrow`, `summary`, `body`, `published`, `author_user_id`, timestamps.

## Retention Summary Visible in Code

- User-owned app tables mostly use `references auth.users(id) on delete cascade`.
- Some relationship fields use `on delete set null`, including `guide_articles.author_user_id`, `personas.reference_asset_id`, `assets.persona_id`, `generation_jobs.persona_id`, `billing_webhook_events.user_id`, and `account_profiles.referred_by_user_id`.
- Private Supabase Storage buckets are user-scoped by path/RLS: `uploads`, `generated-images`, `generated-videos`, `generated-audio`, `provider-temp`.
- Asset deletion attempts to delete the corresponding storage object when `storageBucket` and `storagePath` are present.
- Temporary media files are written to server temp directories with no cleanup job found.
- No cron, scheduled deletion, or data export/deletion account UI was found.
- Provider-side retention is not specified in the repository.

## Uncertainties Requiring Owner Answers

1. What legal/business entity operates Idolborn, and what contact email/address should policies use?
2. Which jurisdictions are targeted or excluded?
3. Are minors prohibited, and what minimum age applies?
4. Is the product intended for adult-content creator workflows, and should generated personas/content be restricted to adults?
5. Which third-party providers are enabled in production: Supabase, Paddle, WaveSpeed, ElevenLabs, OpenAI, Google/Gemini, Wan, Kling, Seedance/BytePlus, Telegram?
6. Is Paddle in sandbox or production for the live website?
7. What are Supabase Auth session/cookie settings and enabled OAuth providers in production?
8. Do you have hosting/CDN logs, server logs, WAF logs, or platform analytics outside this repo?
9. Are there any Supabase Storage lifecycle rules, backups, database PITR/backups, or log retention policies outside this repo?
10. Should temp media be cleaned up, and on what schedule?
11. Are contact messages actually intended to be collected through the unused contact form/API?
12. How should users request deletion/export/correction of account, billing, persona, and media data?
13. Do provider contracts or settings opt data out of training or limit retention? The repo does not show this.
14. Are users allowed to upload images/audio/video of other people, and what proof/consent requirements apply?
15. Are generated assets public, shareable, or only private to the signed-in user?
16. Should a just-in-time notice be shown before sending prompts/uploads to AI providers?
17. Should terms acceptance be required at signup, checkout, or before first generation?
18. Does Paddle.js set cookies or similar storage requiring a cookie notice in your target jurisdictions?
