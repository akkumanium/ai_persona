# Legal Data Inventory

Status: factual repository inventory only. Do not treat this as a privacy policy, terms, legal advice, or a compliance conclusion.

Scope reviewed:
- Next.js app routes, API routes, React components, provider adapters, env configuration, package dependencies, Supabase migrations, and storage helpers.
- Evidence files include `src/app/**`, `src/components/**`, `src/lib/**`, `supabase/migrations/**`, `package.json`, `next.config.ts`, and `.env.local` variable names only.

## High-Level Findings

- The website uses Supabase for authentication, session cookies, Postgres data, and private Storage buckets.
- The website uses Whop for checkout, billing webhooks, membership management links, and refund requests when configured.
- Generation workflows may send prompts, uploaded images, uploaded audio, uploaded video, generated/selected media URLs, model settings, and job IDs to external AI/media providers.
- WaveSpeed is the sole provider for image, video, and avatar generation. ElevenLabs is the sole provider for speech generation.
- Models such as Nano Banana, ChatGPT Image, Wan, Kling, and Seedance are accessed through WaveSpeed; they are not direct integrations.
- No analytics SDK, advertising pixel, behavioral tracker, or error-monitoring SDK was found in dependencies or source.
- No custom `localStorage`, `sessionStorage`, or `document.cookie` use was found. Cookies are managed through Supabase SSR helpers.
- A `ContactForm` component and `/api/contact` endpoint exist, but the current `/contact` page does not render that form; it links to email and Telegram instead.
- No code or config reviewed states that user data is sold or used for AI-provider training.

## Runtime Configuration Observed

Code supports these env vars: Supabase, Whop, WaveSpeed, ElevenLabs, and contact email.

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

Evidence: `src/components/billing-plans.tsx`, `src/components/studio-paywall.tsx`, `src/components/studio/assets-jobs-settings.tsx`, `src/app/api/whop/webhook/route.ts`, `src/app/api/billing/*`, `src/lib/server/whop-billing-events.ts`, `supabase/migrations/021_whop_billing.sql`

Collected or sent:
- Signed-in user ID.
- Whop plan ID.
- Checkout metadata: `app_user_id`, `checkout_intent_id`, `option_id`, and `return_path`.
- Whop checkout session ID and checkout return status in the browser.
- Whop webhook event ID, type, entity ID, company ID, timestamp, and event payload. Supported payment, membership, refund, and dispute events are normalized before processing.
- Refund request transaction ID and amount.

Sent to:
- Whop checkout configuration/API, which returns a hosted checkout session.
- Whop API for membership-management links and payment refunds.
- Supabase tables and functions for billing state.

Purpose:
- Subscriptions, token top-ups, billing status, billing portal access, refunds, referral rewards.

Stored:
- `account_profiles.provider_customer_id`, `credit_balance_cents`, and `account_metadata` (the migration removes the legacy `paddle` metadata key).
- `billing_checkout_intents.user_id`, `option_id`, `provider`, `provider_plan_id`, `provider_checkout_session_id`, `return_path`, expiry/status/failure fields.
- `billing_subscriptions.subscription_id`, `user_id`, `provider_user_id`, `provider_member_id`, `provider`, `status`, `plan_id`, `provider_plan_id`, management URL, and billing-period timestamps.
- `billing_webhook_events.event_id`, `event_type`, `user_id`, `provider`, `provider_entity_id`, `occurred_at`, `payload`, processing/retry fields, error message, and `processed_at`.
- `billing_payments` and `billing_adjustments` retain payment, membership, provider-plan, refund/dispute, amount, and event-payload records used for credits and reversals.
- `credit_ledger.user_id`, `job_id`, `amount_cents`, `description`, `created_at`.
- `billing_refund_requests.user_id`, `transaction_id`, `amount_cents`, `status`, `provider_refund_id`, `failure_message`, timestamps.

Retention behavior visible in code:
- Most billing rows referencing `user_id` cascade on auth user deletion.
- `billing_webhook_events.user_id references auth.users(id) on delete set null`, so webhook records can remain after user deletion with `user_id` nulled.
- No automatic deletion schedule found.
- Raw Whop webhook payloads are stored as JSONB without field-level minimization in this repo.

Uncertainty:
- Whop production vs sandbox mode in production.
- Whop account retention, tax/invoice data, payment-method handling, and cookie behavior.
- Whether raw webhook payload includes buyer address, tax, invoice, or payment details for the enabled Whop event types.

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

Evidence: `src/components/studio/generate-persona-view.tsx`, `src/components/studio/generation-view.tsx`, `src/app/api/generate/image/route.ts`, `src/app/api/generate/avatar/route.ts`, `src/lib/providers/wavespeed.ts`

Collected:
- Persona ID/name/description/style notes.
- Prompt and additional prompt.
- Uploaded/reference image files, names, MIME types, storage URLs or base64.
- Model, aspect ratio, image size, quality, count, reference slot.
- Rights confirmation and adult-persona confirmation for avatar reference generation.

Sent to:
- WaveSpeed client upload and `client.run`.
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
- Provider-side retention and training/reuse practices for WaveSpeed are not specified in this repo.
- Whether rights/adult confirmations are persisted. The code requires them for the request but does not appear to store the boolean values.

### Video generation and motion-control generation

Evidence: `src/components/studio/generation-view.tsx`, `src/components/studio/trend-video-view.tsx`, `src/app/api/generate/video/route.ts`, `src/lib/providers/wavespeed.ts`

Collected:
- Persona ID/name.
- Video prompt, negative prompt, motion reference text.
- Start/end/reference image URLs or uploaded image bytes.
- Motion reference video file/URL.
- Seedance reference video/audio file or URL.
- Model, duration, aspect ratio, provider mode, CFG scale, generated audio flag, resolution, return-last-frame flag, motion mode, character orientation, keep-original-sound flag.

Sent to:
- WaveSpeed.
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
- Whether Whop checkout sets cookies or local storage; this is external to the repo.

## Analytics, Advertising, and Error Monitoring

Evidence: `package.json`, package/source search.

Analytics:
- No Google Analytics, GTM, Vercel Analytics, Plausible, PostHog, Mixpanel, or similar analytics integration was found.

Advertising:
- No Meta/Facebook pixel, Google Ads/DoubleClick, TikTok pixel, or other ad tracker was found.

Error monitoring:
- No Sentry, LogRocket, Datadog RUM, Bugsnag, or similar error-monitoring SDK was found.
- `console.error` is used for Whop webhook processing errors.

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

### Whop

Data involved:
- App user ID, plan/top-up ID, checkout-intent metadata, checkout session ID, Whop user/membership/payment IDs, management link, raw webhook payload, and refund requests.

Purpose:
- Hosted checkout, membership management, subscription/top-up confirmation, refunds, and dispute handling.

Retention visible:
- App stores raw webhook payloads with no deletion schedule. Whop retention is not specified in this repository.

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
- `provider_customer_id`: payment-provider customer/user ID.
- `account_metadata`: account/billing metadata; the current Whop migration removes the legacy Paddle metadata key.
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
- `subscription_id`, `user_id`, `provider`, `provider_user_id`, `provider_member_id`, `status`, `plan_id`, `provider_plan_id`, `manage_url`, cancellation flag, provider-update and period timestamps, created/updated timestamps.

### `billing_checkout_intents`

Fields:
- `user_id`, `option_id`, `provider`, `provider_plan_id`, `provider_checkout_session_id`, `return_path`, `expires_at`, `status`, `failure_message`, `consumed_at`, timestamps.

### `billing_webhook_events`

Fields:
- `event_id`, `event_type`, `user_id`, `provider`, `provider_entity_id`, `occurred_at`, `processing_status`, retry/attempt fields, `processed_at`, `payload`, `error_message`.

Notes:
- `payload` stores the full Whop event.
- `user_id` is set null on user deletion, so some billing event data can remain detached from the auth user.

### `contact_messages`

Fields:
- `name`, `email`, `message`, `user_agent`, `page_url`, `created_at`.

### `referral_rewards`

Fields:
- `referrer_user_id`, `referred_user_id`, `referral_code`, `status`, `reward_amount_cents`, `rewarded_subscription_id`, `rewarded_event_id`, `created_at`, `rewarded_at`.

### `billing_refund_requests`

Fields:
- `user_id`, `transaction_id`, `amount_cents`, `status`, `provider_refund_id`, `failure_message`, timestamps.

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
5. Which third-party providers are enabled in production: Supabase, Whop, WaveSpeed, ElevenLabs, and Telegram?
6. Is Whop in sandbox or production for the live website?
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
18. Does Whop checkout set cookies or similar storage requiring a cookie notice in your target jurisdictions?

## Owner Answers for Idolborn Terms and Privacy Policy - 14.07.26

1. **Operator and contact information**

Idolborn is operated by **[FULL LEGAL NAME]**, an individual software creator based in Kazakhstan, trading under the name “Idolborn.” Idolborn is not currently operated through an incorporated company.

Contact email: **[idolborn.support@gmail.com](mailto:idolborn.support@gmail.com)**

Mailing or business address: **[ADD A VALID MAILING OR BUSINESS ADDRESS BEFORE PUBLISHING]**

2. **Targeted and excluded jurisdictions**

Idolborn is an online service that may be accessed internationally. It is not specifically marketed toward one particular country or jurisdiction.

The service is unavailable where its use would be prohibited by applicable law or where the payment provider, Whop, does not support accounts, payments, or subscriptions. Whop currently maintains a list of sanctioned and restricted countries, which may change over time.

The policies should not claim that Idolborn complies with every law worldwide. They should instead state that users are responsible for complying with laws applicable to them and that Idolborn may restrict availability in particular locations.

3. **Minimum age**

Recommended policy decision: Idolborn should be restricted to users who are **at least 18 years old**.

Users under 18 should not be permitted to create an account, purchase a subscription, upload media, or use the generation features. If Idolborn learns that an account belongs to a minor, the account may be suspended or deleted and associated personal data should be removed where reasonably possible, subject to legal, security, billing, and backup-retention requirements.

This restriction is recommended even though Idolborn is a SFW service because allowing minors would create additional consent, age-verification, privacy, and contractual requirements.

4. **Adult content and generated persons**

Idolborn is a **strictly SFW service**. It is not intended for pornography, sexually explicit content, sexual services, or adult-content creator workflows.

Any realistic person, persona, voice, or character generated through Idolborn must represent an adult aged 18 or older.

Users may not create, upload, request, or distribute content that sexualizes minors, depicts minors in inappropriate situations, exploits children, or attempts to make an adult appear to be a minor for sexual or exploitative purposes.

5. **Production service providers**

The third-party providers currently used in production are:

* Supabase, for authentication, database, and storage infrastructure;
* WaveSpeedAI, for AI media-generation processing;
* ElevenLabs, for audio or voice-generation functionality; and
* Whop, for subscriptions, checkout, billing, and payment-related services.

Paddle is no longer used.

Idolborn does not directly integrate with OpenAI, Google/Gemini, Telegram, Kling, Wan, Seedance, or BytePlus unless one of those technologies is made available indirectly through WaveSpeedAI or another listed provider. The policies should distinguish direct providers from underlying models or subprocessors used by those providers.

6. **Payment environment**

Paddle is not used on the live website.

Whop is the active payment and subscription provider. The live website uses Whop’s production payment environment. Any development or test environment, if maintained, must be kept separate from production.

7. **Supabase authentication settings**

Supabase Auth is used for user authentication.

The following details still need to be verified in the production Supabase dashboard before the policies are finalized:

* enabled login methods and OAuth providers;
* whether authentication data is stored in browser local storage, cookies, or server-side cookies;
* access-token expiry;
* session inactivity timeout;
* maximum session lifetime; and
* whether multiple simultaneous sessions are permitted.

Unless they have been changed, Supabase sessions are active until the user signs out or another configured termination event occurs, and Supabase permits configurable session limits.

The privacy policy may generally state that essential authentication tokens or cookies are used, but it should not name Google or another OAuth provider unless that provider is actually enabled.

8. **Hosting, analytics, and operational logs**

No separate analytics, advertising analytics, WAF, or custom logging system is intentionally used unless it is discovered in the hosting or production configuration.

However, infrastructure providers such as the website host, Supabase, Whop, WaveSpeedAI, and ElevenLabs may automatically create operational, security, authentication, fraud-prevention, request, IP-address, device, and billing logs.

The hosting provider and its log-retention settings still need to be identified. The privacy policy should not state that no logs exist.

9. **Backups, storage lifecycle, and provider retention**

Idolborn deletes temporary user media from its active application storage after seven days.

It has not yet been confirmed whether the Supabase project has:

* daily backups;
* Point-in-Time Recovery;
* backup snapshots;
* custom Storage lifecycle rules;
* audit-log retention settings; or
* copies retained by the hosting provider.

These settings must be checked in the Supabase and hosting dashboards. Supabase offers database backups and optional Point-in-Time Recovery, and restored or backup copies may exist separately from active application data.

The privacy policy should explain that deletion from active storage may not immediately delete information from security logs or backup systems, and that backup copies may remain until they expire or are overwritten.

10. **Temporary media deletion**

Yes. Temporary uploaded and generated media stored by Idolborn should be automatically deleted after **seven days**.

This period should apply to active temporary storage controlled by Idolborn. Users should be informed that they must download any asset they want to retain.

Deletion schedules operated by third-party providers may differ. WaveSpeedAI currently states that generated content is retained for seven days, while account information and billing logs use different retention periods.

11. **Contact form**

Idolborn does not currently intend to collect contact submissions through the unused contact form or API.

The unused contact form and endpoint should be removed or disabled. The privacy policy should only describe email support through **[idolborn.support@gmail.com](mailto:idolborn.support@gmail.com)**, unless the contact form is later activated.

12. **Privacy requests**

Users may request access, export, correction, or deletion of their Idolborn account and associated data by emailing:

**[idolborn.support@gmail.com](mailto:idolborn.support@gmail.com)**

Idolborn may request reasonable information to verify that the requester owns the relevant account.

Requests may cover account details, personas, stored media, generation records, and other data controlled directly by Idolborn.

Billing and payment data controlled by Whop may need to be requested from Whop directly. Certain billing, fraud-prevention, dispute, tax, security, and legal records may be retained where required or permitted by law. Whop states that it may retain information to comply with legal obligations, resolve disputes, maintain business records, and enforce agreements.

13. **AI training and provider retention**

Idolborn itself does not use user prompts, uploads, generated media, or voices to train its own AI models.

However, the policy must not promise that every third-party provider is contractually prohibited from training on data unless the relevant provider setting or agreement has been verified.

For WaveSpeedAI, its published documentation states that outputs are not used for AI training and generated content is deleted after seven days.

For ElevenLabs, the account’s **“Improve the models for everyone”** data-use setting must be disabled before Idolborn claims that newly submitted data is opted out of model improvement. ElevenLabs indicates that this opt-out is available in its account settings.

ElevenLabs zero-retention mode should not be claimed unless Idolborn has an eligible Enterprise account and has enabled the required setting for each API request.

There should not be a general statement that all data is deleted after seven weeks. Retention should be explained separately for temporary media, accounts, generation metadata, billing records, provider logs, and backups.

14. **Uploading other people’s media**

Users may upload an image, video, or audio recording of another adult only when they have all necessary permission, consent, licenses, and legal rights to do so.

Idolborn does not require users to upload proof of consent with every generation. However, users must represent and warrant that they have valid consent and authority, and Idolborn should reserve the right to request evidence when a complaint, dispute, or safety concern arises.

Users may not use another person’s likeness or voice for:

* impersonation or identity fraud;
* deceptive endorsements;
* harassment, threats, humiliation, or defamation;
* non-consensual intimate or sexual content;
* blackmail or extortion;
* misleading political or commercial communications;
* violating privacy or publicity rights; or
* making a real person appear to have said or done something harmful or unlawful.

15. **Visibility and sharing of assets**

Generated assets are accessible to the signed-in user and are not intentionally published in a public Idolborn gallery by default.

Users may download, export, or share their generated assets themselves, subject to the Terms, applicable law, third-party rights, and any model-specific restrictions.

A user’s decision to share an asset outside Idolborn does not make Idolborn responsible for the user’s publication or distribution of it.

16. **Notice before AI processing**

Yes. A concise just-in-time notice should be shown **before the user’s first upload or first generation request**, not only during signup.

The notice should explain that prompts, uploaded media, and related generation instructions will be sent to third-party AI providers such as WaveSpeedAI or ElevenLabs to perform the requested generation.

The notice can include a link to the full Privacy Policy and should require a clear affirmative action such as “Continue” or “I understand.”

17. **Acceptance of Terms and Privacy Policy**

Users should be required to affirmatively accept the Terms of Service and acknowledge the Privacy Policy during signup.

Acceptance should be recorded with the policy version and timestamp.

The checkout flow should also link clearly to the Terms, Privacy Policy, subscription conditions, refund rules, and Whop’s applicable payment terms. If a user can reach generation functionality without completing signup, acceptance should instead be required before the first generation.

18. **Cookies and similar storage**

Supabase authentication may use essential browser storage or authentication cookies. These are necessary for account login and session management.

Whop states that its services use cookies, pixels, JavaScript, and similar technologies for functionality, security, analytics, and activity tracking.

Whether Whop technology places cookies directly on the Idolborn domain depends on the checkout implementation:

* A redirect to a Whop-hosted page may primarily place cookies on Whop’s domain.
* An embedded Whop checkout may create third-party cookies or similar storage while the user remains on Idolborn.

This must be tested on the production website using browser developer tools or a cookie scanner.

The privacy or cookie notice should disclose essential authentication and payment technologies. In jurisdictions that require consent for non-essential analytics or advertising cookies, those technologies should not load until consent is obtained. Strictly necessary authentication and technical cookies are generally treated differently from optional tracking cookies, although they should still be disclosed.

