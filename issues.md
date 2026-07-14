# Billing migration security notes

Last updated: July 14, 2026.

The previous billing security review is superseded by the Whop cutover in migration `021_whop_billing.sql`.

Implemented controls:

- Authenticated, rate-limited server checkout sessions; browser metadata cannot choose the fulfilled product.
- Unique server-only plan catalog and trusted checkout-intent association.
- Official SDK raw-body webhook verification and company-ID validation.
- Privacy-minimized, service-only durable webhook inbox with idempotent retry and provider timestamp ordering.
- Local membership rows as the only access authority; browser checkout completion never grants credits.
- One welcome grant per membership, active-subscription checks at top-up checkout and fulfillment, and idempotent referral rewards.
- Atomic unused-credit refund reservations, proportional reversal/debt tracking, dispute revocation and reversal, and immediate-cancellation outbox work after full refunds.
- Protected manual membership, inbox, and outbox reconciliation that protects newer refund/dispute state; automatic billing reconciliation is intentionally unscheduled on Vercel Hobby.

External acceptance work remains: create and verify both Whop catalogs and webhooks, run all sandbox scenarios, and complete the production subscription/refund and top-up smoke tests in `DEPLOYMENT.md`.
