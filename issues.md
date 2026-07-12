# Pre-launch audit report

Audit date: 11 July 2026  
Verdict: **Not ready for production launch**

I found multiple paths that could grant excessive paid access, generate unbounded third-party costs, expose infrastructure to SSRF/storage abuse, or leave billing and credit state irrecoverably inconsistent.

The repository was inspected read-only. Existing user changes remain the only Git changes.

## A. Executive summary

The most serious confirmed risks are:

2. **Paddle price spoofing**: webhook fulfillment trusts client-controlled `custom_data.plan_id` ahead of Paddle’s actual purchased price. A customer can pay for a cheap item while receiving an expensive plan or top-up.
3. **Arbitrary WaveSpeed models**: generation schemas accept any model name, and strings containing `/` are sent directly to WaveSpeed. Attackers can invoke expensive models while paying the low fallback token estimate.
4. **Refund exploitation**: a customer can request a refund, spend the credits while approval is pending, and retain active subscription access after the refund.
5. **Incomplete Paddle state handling**: out-of-order events can reactivate canceled accounts; dashboard refunds, partial refunds, chargebacks, disputes, scheduled cancellations, and missing events are not reconciled safely.
6. **Synchronous provider execution**: WaveSpeed calls may wait up to ten hours inside a serverless request. Vercel can terminate the function after credits are charged but before a provider job ID or result is saved.
7. **SSRF bypass**: remote media validation does not revalidate redirects and is vulnerable to DNS rebinding.
8. **Unrestricted authenticated storage**: any free authenticated account can upload directly to private Supabase buckets without a subscription, server-enforced size quota, MIME constraint, or per-account capacity limit.
9. **Non-atomic credit/result persistence**: several failure points can produce successful jobs with missing assets, orphan storage, incorrect refunds, or paid provider work that cannot be recovered.
10. **Rate limits are not production-effective**: they are per-process, reset across serverless instances, trust forwarded IP headers, and retain unbounded bucket keys.

### Positive findings

The implementation already has several sound controls:

- Paddle signatures use the raw body, HMAC-SHA256, multiple `h1` support, and constant-time comparison.
- Main Paddle event processing deduplicates by `event_id` and uses a database RPC transaction.
- Generation endpoints authenticate with `supabase.auth.getUser()`, not only cookie contents.
- Core user-owned tables and storage paths have RLS ownership policies.
- Credit consumption uses an atomic conditional database update.
- Request schemas and body-size limits exist for generation routes.
- Remote URLs reject direct private IP addresses and embedded credentials.
- Auth callback redirects are normalized against external/open redirects.
- Guide content is rendered as React text rather than unsafe HTML.
- Tests, lint, TypeScript, and the production build complete successfully.

### What could not be verified

The repository does not reveal the deployed Vercel/Supabase/Paddle configuration. I could not verify:

- Whether every migration has actually been applied to production.
- Actual deployed RLS policies or database drift.
- Vercel environment variables, regions, function time limits, WAF, or spend controls.
- Supabase Auth email verification, CAPTCHA, password policy, MFA, SMTP, redirect allowlist, leaked-password protection, or account-abuse settings.
- Supabase backups/PITR, storage lifecycle policies, quotas, alerts, or database query plans.
- Paddle notification subscriptions, production catalog contents, approved domains, tax configuration, or live/sandbox separation.
- Production logs, alerting, incident response, or reconciliation jobs.

The checked-out `.env.local` contains no Paddle configuration. The audited local configuration would therefore launch with billing unavailable, though production may use separate Vercel variables.

---

# B. Findings

## F-02 — Paddle fulfillment trusts attacker-controlled plan metadata

- **Severity:** Critical
- **Confidence:** High
- **Affected:** [webhook route:198](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:198>), [billing checkout:168](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/billing-plans.tsx:168>), [top-up checkout:445](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/billing-plans.tsx:445>)
- **Description:** `getBillingEventDetails()` resolves `custom_data.plan_id` before the actual Paddle price ID. `customData` is constructed in the browser and is therefore untrusted.
- **Why it matters:** A valid Paddle signature proves Paddle sent the payload; it does not prove the client-supplied metadata matches the purchased item.
- **Scenario:** A user opens a checkout for a $2 price while setting `plan_id=topup_100`. The webhook grants 10,000 tokens. A similar modification can turn a cheap subscription into Agency entitlement.
- **Fix:** Resolve the product exclusively from `data.items[].price.id`; require an exact server-catalog match; validate quantity and currency; associate the transaction with a server-created checkout intent or signed nonce. Treat custom data only as an association hint.

```ts
const actualPriceId = findPriceId(data);
const option = getBillingOptionByPriceId(actualPriceId);
if (!option || getCustomDataValue(data, "plan_id") !== option.id) {
  throw new Error("Paddle item and checkout intent do not match");
}
```

- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-03 — Arbitrary third-party models can be invoked at fallback prices

- **Severity:** Critical
- **Confidence:** High
- **Affected:** [schemas.ts:42](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/schemas.ts:42>), [schemas.ts:66](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/schemas.ts:66>), [schemas.ts:88](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/schemas.ts:88>), [wavespeed.ts:270](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/providers/wavespeed.ts:270>), [wavespeed.ts:293](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/providers/wavespeed.ts:293>), [pricing.ts:116](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/pricing.ts:116>)
- **Description:** Model fields accept any non-empty string. WaveSpeed passes IDs containing `/` directly to the provider, while unknown video models use a generic $0.06/second estimate.
- **Why it matters:** The UI model list is not an authorization boundary.
- **Scenario:** An authenticated customer submits an expensive `vendor/model` identifier not shown in the UI, pays the fallback token charge, and consumes substantially more provider credit.
- **Fix:** Use server-side model enums, capability tables, duration/resolution constraints, and prices. Reject rather than fall back when a model is unknown. Add provider-level daily/account spend ceilings.
- **Effort:** Small–medium
- **Blocks launch:** **Yes**

## F-04 — Refunds can be combined with credit consumption and continued access

- **Severity:** Critical
- **Confidence:** High
- **Affected:** [refund route:20](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/billing/refund/route.ts:20>), [refund route:79](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/billing/refund/route.ts:79>), [webhook route:144](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:144>), [billing-access.ts:6](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/billing-access.ts:6>)
- **Description:** Eligibility is checked only when the refund is requested. Credits remain spendable while Paddle approval is pending. Approval subtracts whatever balance remains, clamps it to zero, and does not cancel or revoke the subscription.
- **Why it matters:** Refunded customers can consume provider services and retain guides, persona capacity, and top-up eligibility.
- **Scenario:** A customer requests a full refund with 300 unused tokens, immediately spends those tokens, then receives the refund. The handler reduces an already-low balance to zero but still records a full reversal; the subscription remains active.
- **Fix:** Atomically reserve/freeze refundable credits before calling Paddle; tie every grant and reversal to a transaction ID; recheck under a row lock; on approved full subscription refunds, cancel or explicitly revoke entitlement according to policy. Use adjustment totals rather than the original grant amount.
- **Effort:** Medium–large
- **Blocks launch:** **Yes**

## F-05 — Subscription state is vulnerable to out-of-order webhooks

- **Severity:** High
- **Confidence:** High
- **Affected:** [webhook route:11](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:11>), [webhook route:215](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:215>), [migration 015:28](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/015_subscription_required_for_topups.sql:28>), [migration 015:127](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/015_subscription_required_for_topups.sql:127>)
- **Description:** The handler does not read, store, or compare `occurred_at`. Every new event ID overwrites subscription status even if the event describes an older state.
- **Why it matters:** Paddle guarantees at-least-once delivery but not ordering and explicitly says to order by `occurred_at`. [Paddle webhook ordering](https://developer.paddle.com/webhooks/about/how-webhooks-work/)
- **Scenario:** `subscription.canceled` is delivered first, followed by an older `subscription.updated` or `transaction.completed`; the account becomes active again.
- **Fix:** Store `last_event_occurred_at` per subscription and apply state only when newer. Keep event ingestion immutable, acknowledge quickly, and process through a durable queue. Add periodic Paddle reconciliation. Paddle recommends this architecture. [Paddle provisioning guidance](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)
- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-06 — Refund, partial-refund, chargeback, and dispute processing is incomplete and non-atomic

- **Severity:** High
- **Confidence:** High
- **Affected:** [webhook route:95](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:95>), [webhook route:111](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:111>), [webhook route:123](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:123>), [webhook route:150](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/paddle/webhook/route.ts:150>)
- **Description:**
  - Adjustment events not matching an app-created request are recorded and ignored.
  - `action`, `type`, `transaction_id`, items, and actual adjustment totals are ignored.
  - Chargebacks and reversals are treated like generic adjustments.
  - The event is inserted before side effects. A retry sees the duplicate event and exits, so a midway failure cannot recover.
  - Parallel update errors are not checked.
- **Why it matters:** Dashboard refunds, partial refunds, disputes, or a transient database error can permanently desynchronize Paddle, credits, and access.
- **Scenario:** The event row is inserted, then the balance update fails. Paddle retries, but duplicate detection returns without finishing the balance reversal.
- **Fix:** Process adjustments in one database RPC transaction; deduplicate after or as part of the atomic state transition; key reversals by adjustment ID; calculate proportional credit reversal from actual adjusted items; handle `refund`, `credit`, `chargeback`, `chargeback_reverse`, and warning states explicitly. Paddle documents that adjustments may be partial and include chargebacks. [Paddle adjustment lifecycle](https://developer.paddle.com/webhooks/adjustments/adjustment-created/)
- **Effort:** Large
- **Blocks launch:** **Yes**

## F-07 — WaveSpeed jobs are executed synchronously with a ten-hour timeout

- **Severity:** High
- **Confidence:** High
- **Affected:** [wavespeed.ts:63](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/providers/wavespeed.ts:63>), [wavespeed.ts:162](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/providers/wavespeed.ts:162>), [video route:53](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/generate/video/route.ts:53>), [video route:71](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/generate/video/route.ts:71>)
- **Description:** WaveSpeed’s `timeout` option is measured in seconds. The code uses `36000`, causing `client.run()` to wait for up to ten hours inside a Vercel function.
- **Why it matters:** Vercel can terminate the request after credits are consumed but before a provider job ID is persisted.
- **Scenario:** A video takes several minutes. Vercel kills the function; the database has a charged queued job with no provider ID. The provider may finish and bill the account, but the output is unrecoverable.
- **Fix:** Use submit-only provider APIs; persist provider job ID immediately; return `202`; poll from a durable worker/cron/webhook. Set hard connect/read timeouts of tens of seconds, not hours.
- **Effort:** Large
- **Blocks launch:** **Yes**

## F-08 — Existing Supabase media URLs are invalid for external video providers

- **Severity:** High
- **Confidence:** High
- **Affected:** [generation-view.tsx:440](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/studio/generation-view.tsx:440>), [video route:45](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/generate/video/route.ts:45>), [wavespeed.ts:110](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/providers/wavespeed.ts:110>), [media-urls.ts:1](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/media-urls.ts:1>)
- **Description:** Persisted assets use relative `/api/media/object?...` URLs. Image and avatar routes resolve these server-side; the video route generally passes start/end/reference URLs directly to WaveSpeed.
- **Why it matters:** An external provider cannot fetch a relative URL on the Idolborn origin.
- **Scenario:** “Generate video from image” works in the UI up to submission, then the provider rejects the relative start-frame URL.
- **Fix:** Resolve and validate every media field consistently. Prefer short-lived signed Supabase URLs if the provider accepts URL inputs, otherwise upload validated bytes once. Fail if resolution fails instead of silently dropping media.
- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-09 — Authenticated users can abuse Supabase Storage without a plan or quota

- **Severity:** High
- **Confidence:** High
- **Affected:** [migration 006:18](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/006_speech_avatar_wavespeed.sql:18>), [migration 006:25](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/006_speech_avatar_wavespeed.sql:25>), [media.ts:49](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/studio/media.ts:49>), [studio-workspace.tsx:626](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/studio-workspace.tsx:626>)
- **Description:** Storage policies permit any authenticated user to upload into every application bucket under their UUID. Subscription state, byte quota, file count, MIME type, and bucket purpose are not enforced server-side.
- **Why it matters:** The “preview mode” banner says use is disabled, but free accounts can still upload directly to Supabase and bypass client-side 100 MB checks.
- **Scenario:** Automated free accounts repeatedly upload large files or arbitrary content, creating storage and egress costs.
- **Fix:** Configure bucket `file_size_limit` and `allowed_mime_types`; restrict generated buckets to service role; require an active entitlement for uploads; issue signed upload grants from a rate-limited server endpoint; track per-user storage quotas and cleanup.
- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-10 — Remote media SSRF defenses can be bypassed

- **Severity:** High
- **Confidence:** High
- **Affected:** [media-storage.ts:149](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/media-storage.ts:149>), [media-storage.ts:154](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/media-storage.ts:154>), [media-storage.ts:209](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/media-storage.ts:209>)
- **Description:** The initial hostname is resolved and checked, but `fetch()` follows redirects automatically without revalidation. DNS is also resolved a second time by `fetch`, allowing DNS rebinding.
- **Why it matters:** An authenticated caller can potentially make Vercel request internal services or cloud metadata endpoints.
- **Scenario:** A public URL passes validation and responds with a redirect to a private IP. `fetch` follows it and returns internal data as media bytes.
- **Fix:** Use `redirect: "manual"` and validate every hop; cap redirects; bind the connection to the validated IP or use a hardened media proxy; block all reserved IPv4/IPv6 ranges; add an abort timeout.
- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-11 — Generation, asset persistence, and refunds are not atomic

- **Severity:** High
- **Confidence:** High
- **Affected:** [studio-persistence.ts:74](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/studio-persistence.ts:74>), [studio-persistence.ts:98](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/studio-persistence.ts:98>), [image route:180](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/generate/image/route.ts:180>), [token-billing.ts:53](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/token-billing.ts:53>)
- **Description:** A job is marked succeeded before assets are inserted. If asset insertion fails, the catch refunds credits, but `markPendingGenerationJobFailed()` refuses to change an already-succeeded row.
- **Why it matters:** The resulting job can say “succeeded,” reference absent asset IDs, leave orphan files, and refund the user despite provider spend.
- **Scenario:** A transient asset constraint failure occurs after generated files are uploaded. The user receives a 500 and refund while the database retains a succeeded job with missing outputs.
- **Fix:** Move job finalization and asset inserts into one RPC transaction; use an outbox for storage/provider work; add idempotency keys for consume and refund ledger entries; use explicit states such as `reserved`, `submitted`, `materializing`, and `persisted`.
- **Effort:** Large
- **Blocks launch:** **Yes**

## F-12 — Rate limiting and account-abuse controls are ineffective on Vercel

- **Severity:** High
- **Confidence:** High
- **Affected:** [request-security.ts:10](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/request-security.ts:10>), [request-security.ts:77](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/request-security.ts:77>), [request-security.ts:104](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/server/request-security.ts:104>)
- **Description:** Limits are stored in an in-memory `Map`, isolated per process, reset on cold starts, and never globally cleaned. The key uses request forwarding headers.
- **Why it matters:** Limits can be bypassed across concurrent instances and do not prevent storage, contact, referral, provider, or serverless invocation abuse.
- **Scenario:** A bot distributes requests across Vercel instances or creates new accounts, bypassing the nominal 12–20 generation requests/minute limits.
- **Fix:** Use a durable atomic limiter keyed by user ID plus verified platform IP; configure WAF/bot protection; add signup CAPTCHA and per-account/day provider budgets; delete expired limiter keys.
- **Effort:** Medium
- **Blocks launch:** **Yes**, because provider and storage costs are directly exposed.

## F-13 — Referral RPC permits acting on behalf of another user

- **Severity:** High
- **Confidence:** High
- **Affected:** [migration 008:40](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/008_referrals.sql:40>), [migration 008:66](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/008_referrals.sql:66>), [migration 009:4](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/009_billing_management_and_referral_grants.sql:4>)
- **Description:** `claim_referral()` is `security definer`, executable by authenticated users, and accepts an arbitrary `p_referred_user_id` without requiring it to equal `auth.uid()`.
- **Why it matters:** A caller who knows another user UUID can assign that victim to an attacker-controlled referral and capture a reward when the victim subscribes.
- **Scenario:** The attacker calls the RPC with their referral code and a target UUID before the target claims a legitimate referral.
- **Fix:** Remove the user ID parameter or enforce `p_referred_user_id = auth.uid()` for authenticated calls. Use a separate service-only function for administrative workflows.

```sql
if auth.uid() is null or auth.uid() <> p_referred_user_id then
  raise exception 'not authorized';
end if;
```

- **Effort:** Small
- **Blocks launch:** **Yes** if referrals launch with the product.

## F-14 — Duplicate subscriptions and ambiguous price configuration

- **Severity:** High
- **Confidence:** High
- **Affected:** [env.ts:27](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/env.ts:27>), [billing.ts:153](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/lib/billing.ts:153>), [pricing page:73](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/pricing/page.tsx:73>), [README.md:81](</C:/Users/Наргиз/Desktop/Persona/ai_persona/README.md:81>)
- **Description:** Subscription and top-up IDs fall back to the same generic `$10/$50/$100` variables. Lookup returns the first matching option, normally a subscription. The pricing page allows already-subscribed users to open another subscription checkout, and the database permits multiple active subscriptions per user.
- **Why it matters:** Top-ups can be misclassified, duplicate subscriptions can bill simultaneously, and downgrade resolution can retain a higher plan from another active row.
- **Scenario:** Following the README configuration makes a `$10` top-up share a price ID with the Solo subscription; the webhook grants the wrong amount/type.
- **Fix:** Require distinct, nonempty subscription and one-time price IDs at startup; reject duplicates; remove fallback aliases; create server-side checkout endpoints; block incompatible active subscriptions or route changes through Paddle’s subscription update API.
- **Effort:** Medium
- **Blocks launch:** **Yes**

## F-15 — Client-mutability of jobs creates a provider-job IDOR surface

- **Severity:** Medium
- **Confidence:** Medium–high
- **Affected:** [migration 001:111](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/001_initial_schema.sql:111>), [migration 007:5](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/007_table_grants_and_security_hardening.sql:5>), [poll route:28](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/api/jobs/poll/route.ts:28>)
- **Description:** Authenticated users can insert/update/delete their own generation jobs. The poll route trusts the user-modifiable provider job ID and a separately supplied provider name.
- **Why it matters:** Anyone who learns another provider task ID may poll or materialize its output into their account.
- **Scenario:** A user modifies one of their job rows to a leaked WaveSpeed/Kling task ID and calls the poll endpoint.
- **Fix:** Revoke client write access to server-controlled job fields; persist jobs only through service-role APIs; check the stored provider, immutable provider ID, and internal job state; add uniqueness on `(provider, provider_job_id)`.
- **Effort:** Medium
- **Blocks launch:** Recommended before launch; mandatory if provider IDs can appear in logs or URLs.

## F-16 — Database integrity and concurrency controls are incomplete

- **Severity:** Medium
- **Confidence:** High
- **Affected:** [migration 013:21](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/013_subscription_persona_limits_and_welcome_credits.sql:21>), [migration 001:53](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/001_initial_schema.sql:53>), [migration 003:1](</C:/Users/Наргиз/Desktop/Persona/ai_persona/supabase/migrations/003_paddle_billing.sql:1>)
- **Description:**
  - Persona limits use `count(*)` without locking, so concurrent inserts can exceed the plan limit.
  - No unique active-subscription constraint or policy.
  - Subscription status and plan IDs are unconstrained text.
  - Billing period columns are never populated.
  - `output_asset_ids` and `reference_asset_ids` arrays lack foreign keys.
  - No uniqueness for default references or provider job IDs.
  - Credit/refund ledger effects lack idempotency constraints.
- **Scenario:** Two concurrent Solo persona inserts both observe zero personas and both succeed.
- **Fix:** Serialize persona creation with an advisory/user-row lock; normalize array relationships into join tables; add status/plan checks and indexes; store event timestamps and periods; add unique idempotency keys.
- **Effort:** Medium–large
- **Blocks launch:** Persona race and financial idempotency should be addressed before launch.

## F-17 — Studio data loading is unbounded and over-fetches sensitive/heavy columns

- **Severity:** Medium
- **Confidence:** High
- **Affected:** [studio page:51](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/studio/page.tsx:51>), [studio-workspace.tsx:107](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/studio-workspace.tsx:107>), [assets-jobs-settings.tsx:23](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/studio/assets-jobs-settings.tsx:23>)
- **Description:** Every Studio request selects `*` from all personas, assets, jobs, and ledger entries without pagination. Active jobs are refetched on every view change. All assets and jobs are rendered.
- **Why it matters:** Historical job JSON, provider payloads, prompts, storage metadata, and ledger history will make SSR payloads and hydration increasingly expensive.
- **Scenario:** A user with thousands of generations causes large Supabase egress, slow SSR, high memory usage, and hundreds of media redirects.
- **Fix:** Select explicit columns; omit raw provider payloads from Studio; paginate jobs/assets/ledger; fetch only current persona and recent history; deduplicate and cache stable queries.
- **Effort:** Medium
- **Blocks launch:** No, but should be fixed before meaningful usage growth.

## F-18 — Deployment, observability, and failure UX are incomplete

- **Severity:** Medium
- **Confidence:** High
- **Affected:** [next.config.ts:3](</C:/Users/Наргиз/Desktop/Persona/ai_persona/next.config.ts:3>), [proxy.ts:41](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/proxy.ts:41>), [studio page:59](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/app/studio/page.tsx:59>)
- **Description:** There is no environment validation, health/readiness endpoint, CSP/security-header configuration, structured logging, tracing, alerting, timeout policy, error boundary, or dependency-specific fallback. Only one explicit `console.error` exists.
- **Why it matters:** A missing key or provider outage becomes a user-visible 500, while webhook drift and cost spikes may go undetected.
- **Scenario:** Supabase temporarily fails during Studio SSR; the page throws a generic production error and no structured alert identifies the account or operation.
- **Fix:** Add startup/env validation; structured redacted logs with correlation IDs; Sentry/OpenTelemetry; billing/provider alerts; health checks; route-level timeouts; `loading.tsx`/`error.tsx`; reconciliation dashboards. Add CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and frame restrictions compatible with Paddle.
- **Effort:** Medium
- **Blocks launch:** Minimum observability, env validation, and payment alerts should block launch.

## F-19 — Dependency advisories include production-reachable packages

- **Severity:** Medium
- **Confidence:** High
- **Affected:** [package.json:12](</C:/Users/Наргиз/Desktop/Persona/ai_persona/package.json:12>), [package-lock.json](</C:/Users/Наргиз/Desktop/Persona/ai_persona/package-lock.json>)
- **Description:** `npm audit` reports 7 advisories: 3 high, 3 moderate, and 1 low. High advisories include `ws`, `protobufjs`, and Vite. `ws` is brought by production SDKs; `@google/genai` appears unused but brings `protobufjs`; Vite is test-only.
- **Why it matters:** The production SDK dependency tree contains a memory-exhaustion advisory.
- **Fix:** Remove unused `@google/genai`; update ElevenLabs/Google SDKs and lockfile; update Next; rerun audit and regression tests. Vite/Babel/js-yaml findings are primarily development exposure.
- **Effort:** Small
- **Blocks launch:** Production-reachable high advisories should be resolved or documented as unreachable.

## F-20 — User-facing and operational gaps

- **Severity:** Low–Medium
- **Confidence:** High
- **Affected:** [home-page.tsx:619](</C:/Users/Наргиз/Desktop/Persona/ai_persona/src/components/home-page.tsx:619>), [to-do.txt:10](</C:/Users/Наргиз/Desktop/Persona/ai_persona/to-do.txt:10>), [to-do.txt:16](</C:/Users/Наргиз/Desktop/Persona/ai_persona/to-do.txt:16>)
- **Description:**
  - Home links to `/demo`, but no route exists.
  - Terms and privacy pages are explicitly unfinished.
  - Mobile optimization, FAQ completion, OAuth/email fixes, cancellation/refund verification, upgrades, and generation errors remain listed as unresolved.
  - No sitemap, robots metadata, canonical URLs, or OpenGraph configuration.
  - Fixed-width job grids and extensive raw `<img>/<video>` rendering risk poor mobile behavior.
  - There is no account deletion/export flow or storage cleanup on account deletion.
- **Scenario:** A launch visitor follows the demo CTA to a 404; a paying user cannot find clear refund/cancellation terms or delete retained media.
- **Fix:** Remove/fix `/demo`; publish reviewed legal pages and link them during checkout; test mobile/browser flows; add data export/deletion and storage cleanup; add SEO metadata where public discovery matters.
- **Effort:** Medium
- **Blocks launch:** Legal/payment promises and broken primary links should be fixed before launch.

---

# C. Highest-priority launch blockers

2. Fulfill Paddle purchases exclusively from verified actual price IDs and server checkout intents.
3. Allowlist provider models and reject unknown pricing combinations.
4. Make refunds freeze credits and revoke/cancel entitlement according to policy.
5. Add `occurred_at` ordering, adjustment/chargeback handling, and Paddle reconciliation.
6. Replace synchronous WaveSpeed runs with durable asynchronous jobs.
7. Fix relative media URLs for video workflows.
8. Close SSRF redirect/DNS-rebinding paths.
9. Enforce server-side Supabase Storage entitlement, MIME, size, and quota controls.
10. Make generation finalization and refund handling transactional/idempotent.
11. Replace in-memory rate limiting and add account/provider spend controls.
12. Fix referral RPC authorization.
13. Require unique Paddle price configuration and prevent duplicate subscriptions.
14. Add production environment validation, payment/provider alerts, and basic failure monitoring.

---

# D. Performance and infrastructure-cost findings

| Category | Data and transfer | Inefficiency / likely impact | Safest fix | Security or consistency effect |
|---|---|---|---|---|
| Vercel middleware | Cookies and an Auth request: browser → Vercel → Supabase, for nearly every route including public pages and Paddle webhooks | Runs `getUser()` on all matched requests; moderate latency/cost and consumes Paddle’s five-second acknowledgment window | Limit proxy matching to session-dependent routes or only refresh when a Supabase cookie exists | Narrowing requires keeping auth checks inside protected routes; those already exist |
| Public SSR | Auth lookup: Vercel → Supabase on home/pricing/contact/FAQ | Forces otherwise static public pages to be dynamic; moderate invocation and latency impact | Render public content statically; resolve account controls client-side or in a small cached island | Avoid caching personalized email into shared HTML |
| Studio bootstrap | All table history: Supabase → Vercel → browser | Unbounded `select("*")`; high long-term egress, SSR memory, and hydration cost | Explicit columns, cursor pagination, recent-window queries, aggregate balance server-side | Preserve RLS and consistent pagination snapshots |
| Active-job refresh | Job rows: browser → Supabase on mount, visibility, and every Studio view change | Duplicate requests; low now, moderate with usage | Remove `view` dependency; use request deduplication and a single active-jobs store | No security change |
| Job polling | Browser → Vercel → provider → Vercel every 5 seconds per active job | One serverless invocation per job per interval; potentially high function and provider API cost | Durable background poller with exponential backoff, or provider webhooks | Improves consistency by centralizing job ownership and idempotency |
| Media display | Browser → Vercel `/api/media/object` → 307 → Supabase Storage | One Vercel invocation per asset just to create a signed URL; moderate/high with large libraries | Batch-create signed URLs during paginated loading, or use authenticated Supabase Storage APIs directly | Keep short TTL and user-scoped RLS; never expose public buckets |
| Reference generation | Supabase Storage → Vercel memory/base64/temp disk → WaveSpeed | Each reference is fully downloaded, base64-expanded, written, then uploaded again; high transfer and memory cost | Give the already-authorized provider a short-lived signed URL when supported, or stream once | Signed URLs disclose the same media to the provider already processing it; keep TTL narrow |
| Generated media | Provider → Vercel memory → Supabase Storage | Up to 100 MB buffered in memory; high function memory and origin transfer | Stream provider output directly to storage/background worker; enforce provider host allowlists | Validate content type and size during streaming |
| Temporary uploads | Browser → Vercel ephemeral disk → later Vercel instance | Files may disappear across instances; 100 MB conflicts with common serverless body limits; high failure risk | Use direct/resumable Supabase uploads and remove local temp storage in production | Improves durability; enforce signed entitlement and quota |
| Homepage assets | Static origin/optimizer → browser | Four active source images total roughly 15 MB; an unused image is ~8.5 MB | Precompress AVIF/WebP, remove unused asset, retain responsive `next/image` sizing | No consistency change |
| Provider/API calls | Long blocking WaveSpeed/Paddle/provider fetches | Missing abort timeouts and ten-hour provider wait; high function duration and cold-start exposure | Abort signals, bounded timeouts, asynchronous job/outbox | Must distinguish timeout from authoritative provider failure before refunding |
| Supabase storage | Free authenticated users → Storage | No server-enforced quota or subscription check; potentially high storage/egress abuse | Bucket constraints, entitlement-aware upload grants, quotas, cleanup | Strengthens security; account for upload grant vs later subscription cancellation |

---

# E. Paddle lifecycle review

## Current authoritative flow

1. Browser opens Paddle Checkout with a public client token, price ID, user UUID, and plan ID.
2. Browser treats `checkout.completed` only as a signal to poll billing status.
3. Paddle sends `transaction.completed`.
4. The webhook verifies the signature and calls `apply_paddle_billing_event`.
5. The RPC inserts the event, grants configured credits, updates subscription/profile state, and rewards referrals.
6. Studio access reads local `billing_subscriptions`; Paddle is not queried during normal access checks.

The browser does not directly grant access, which is good. The database cache should remain the fast authorization source, but Paddle must be the external authority and a reconciliation job must repair the cache.

## Recommended source of truth

| State/data | Authoritative source | Local representation |
|---|---|---|
| Purchased product/price | Actual Paddle transaction line-item price ID | Immutable transaction/entitlement record |
| User association | Server-created checkout intent or signed nonce | Checkout-intent table linked to Supabase user |
| Payment success | `transaction.completed` | Immutable payment row keyed by transaction ID |
| Subscription status/plan | Paddle subscription object | Cache keyed by subscription ID plus `occurred_at` |
| Scheduled cancel/pause/resume | Paddle `scheduled_change` | Explicit effective timestamp and pending state |
| Credits granted | Server catalog after verified price/payment | Ledger entry keyed by transaction/grant type |
| Refund/chargeback amount | Paddle adjustment items/totals | Reversal ledger keyed by adjustment ID |
| Application access | Local entitlement derived from latest reconciled Paddle state | Read-only authorization view/RPC |

## State-transition analysis

| From | Event | Expected target | Current behavior |
|---|---|---|---|
| Free | Paid subscription checkout | Active or Trialing | Usually Active; exploitable plan mapping |
| Free | Trial subscription created | Trialing | Supported if status/custom data are present |
| Trialing | Successful charge | Active | Generic update; ordering unsafe |
| Trialing | Trial ends without payment | Past due/Canceled | Depends on webhook and custom data; not tested |
| Active | Renewal succeeds | Active | Welcome credits intentionally not repeated |
| Active | Renewal fails | Past due | Works only if subscription event arrives and is mapped |
| Past due | Retry succeeds | Active | Generic update; no explicit recovery tests |
| Active | Pause now | Paused | Status stored; access removed |
| Active | Pause at period end | Cancelling/Pausing | **Not modeled; `scheduled_change` ignored** |
| Paused | Resume | Active/Past due | Generic status update; no billing-period handling |
| Active | Cancel at period end | Cancelling | **Not modeled; remains indistinguishable from ordinary Active** |
| Active | Cancel immediately | Canceled | Stored if event is processed in order |
| Canceled | Reactivate | Active | May work, but no explicit reactivation logic/tests |
| Active | Upgrade/downgrade | Active, new plan | Custom metadata may override actual new price |
| Active | Duplicate checkout | Second Active subscription | **Allowed; highest plan wins locally** |
| Active | Full refund | Refunded/Cancelled or policy-specific | Credits reversed, subscription remains Active |
| Active | Partial refund | Partially refunded | **Ignored unless it matches app request; full grant logic used** |
| Active | Chargeback/dispute | Disputed/Restricted | **Ignored** |
| Disputed | Chargeback reversed | Restored if appropriate | **Ignored** |
| Any | Subscription expired | Expired/Canceled | **No explicit application state** |
| Any | Older event delivered late | No regression | **Can overwrite newer state** |
| Any | Missing webhook | Reconciled from Paddle | **No reconciliation path** |
| Any | Dashboard/manual change | Reflected by webhook/reconciliation | Custom-data dependency may cause it to be ignored |

Paddle recommends `subscription.created` and `subscription.updated` for access state, with `transaction.completed` for one-off fulfillment, plus `occurred_at` ordering and reconciliation. [Official provisioning guide](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)

---

# F. Missing tests

Only 13 tests currently exist, covering provider pricing/options and basic schemas. The following should be added.

## Unit tests

- Reject every non-allowlisted image, video, speech, and avatar model.
- Verify every model/duration/resolution combination maps to one exact provider SKU and charge.
- Reject price/custom-data mismatches.
- Reject duplicate/ambiguous Paddle price IDs at startup.
- Test all subscription statuses and scheduled changes.
- Test IPv4/IPv6 private ranges, redirects, redirect loops, DNS rebinding, oversized streaming bodies, and timeout behavior.
- Test strict base64 validity and actual file signatures.

## Database/integration tests

- RLS tests for every table and storage bucket as anon, user A, user B, and service role.
- Confirm free users cannot upload after entitlement controls are added.
- Confirm users cannot write provider job IDs, billing state, or ledger entries.
- Concurrent Solo persona inserts: exactly one succeeds.
- Concurrent credit consumption: balance never goes negative.
- Duplicate consume/refund calls for one job: only one ledger effect occurs.
- Job finalization and asset insertion roll back together.
- Adjustment reversal and request state update roll back together.
- Referral RPC cannot act for another user.
- User deletion removes database records and storage objects.

## Paddle webhook tests

Use signed fixtures and the Paddle webhook simulator:

- Duplicate `transaction.completed` event.
- Same transaction with two distinct event IDs.
- Cancellation delivered before an older activation/update.
- Upgrade/downgrade with stale custom data.
- Delayed `subscription.updated`.
- Missing `subscription.created`, then reconciliation.
- Duplicate subscription checkout.
- Trial start, conversion, failure, and expiration.
- Renewal success, payment failure, retries, and recovery.
- Pause now, pause at period end, resume.
- Cancel now and cancel at period end.
- Full refund before and after token use.
- Spend credits while refund approval is pending.
- Partial refund.
- Dashboard-created refund.
- Chargeback, chargeback warning, dispute, and chargeback reversal.
- Adjustment failure after event ingestion, followed by retry.
- Database outage during webhook processing.
- Manual Paddle dashboard plan/status change.
- Replay after several days.
- Invalid/missing signature, malformed `h1`, multiple signatures, stale timestamp, malformed JSON.

## End-to-end tests

- Email signup, confirmation, login, logout, expired session.
- Google OAuth callback and referral claim.
- Close checkout before payment; no access granted.
- Successful subscription; access appears only after webhook.
- Duplicate checkout prevention.
- Existing generated image → video.
- Uploaded start/end frame → video.
- Speech → talking avatar.
- Provider timeout after credit reservation.
- Provider accepts work but response is lost.
- Storage upload succeeds but database insert fails.
- Mobile Studio navigation, upload, modal, checkout, and billing portal.
- `/demo` and every header/footer link.
- Supabase/Paddle/provider outage loading and retry states.

---

# G. Remediation plan

## 1. Must fix before launch

2. Disable or firewall production Paddle fulfillment until price validation is fixed.
3. Enforce server-side model allowlists and provider spend ceilings.
4. Redesign refund processing to freeze credits and update entitlement atomically.
5. Store and compare Paddle `occurred_at`; add full adjustment/dispute handling.
6. Add a Paddle reconciliation job and operations dashboard.
7. Convert provider execution to durable asynchronous jobs.
8. Fix video media URL resolution.
9. Close SSRF redirect and DNS-rebinding paths.
10. Restrict Supabase Storage by entitlement, bucket purpose, MIME, size, and quota.
11. Make generation/job/asset/ledger transitions atomic and idempotent.
12. Replace in-memory rate limiting and add bot/signup controls.
13. Fix referral RPC authorization.
14. Require distinct Paddle price IDs and prevent duplicate subscriptions.
15. Add env validation, structured payment/provider logging, alerts, and timeouts.
16. Publish accurate cancellation/refund terms and fix `/demo`.

## 2. Should fix shortly after launch

1. Paginate Studio assets, jobs, and ledger.
2. Remove `select("*")` and raw provider payloads from normal Studio loading.
3. Narrow middleware and statically render public pages.
4. Batch signed media URLs and reduce per-asset Vercel invocations.
5. Add database uniqueness, status constraints, periods, and normalized relationships.
6. Add account export/deletion and storage lifecycle cleanup.
7. Upgrade vulnerable dependencies and remove unused packages.
8. Add route-level loading, empty, retry, and error states.
9. Optimize large homepage media and mobile layouts.
10. Add sitemap, robots, canonical, and OpenGraph metadata.

## 3. Longer-term improvements

1. Durable queue/outbox for provider work and webhooks.
2. Usage/cost dashboards by user, provider, model, and route.
3. Automated Paddle-to-database reconciliation and drift alerts.
4. Storage lifecycle/retention tiers and per-account quotas.
5. Provider failover and circuit breakers.
6. Database query telemetry and slow-query monitoring.
7. Full browser/device accessibility test matrix.
