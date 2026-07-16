# Whop billing deployment

Billing uses separate Whop sandbox and production data. Never reuse a key, company ID, plan ID, or webhook between environments.

## Catalog

Create a Studio product with two recurring plans, both with limitless personas: Monthly at $12 every 30 days and Yearly at $80 every 365 days. Create a Tokens product with six hidden one-time plans: $2, $5, $10, $20, $50, and $100. Use USD, unlimited stock, no trial, no promo codes, and no adaptive pricing.

Configure the matching `WHOP_*` values listed in `README.md`. All eight plan IDs must be unique and belong to the configured company and environment. The API key needs checkout-configuration creation, membership read/cancel, payment read/refund, and webhook verification access.

## Webhook

Create a webhook pointing to `https://YOUR_DOMAIN/api/whop/webhook` and subscribe to:

- `payment.succeeded`, `payment.failed`, `payment.pending`
- `membership.activated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`
- `refund.created`, `refund.updated`
- `dispute.created`, `dispute.updated`

Set the endpoint secret as `WHOP_WEBHOOK_SECRET`. Billing reconciliation is not scheduled on the Vercel Hobby plan. The protected `/api/internal/billing/reconcile` endpoint remains available for manual recovery using `Authorization: Bearer CRON_SECRET` after a missed webhook or provider/database incident.

## Release order

1. Apply every Supabase migration through `023_subscription_plans.sql`.
2. Deploy with sandbox values and verify success, decline, 3DS, all eight plans, portal access, cancellation, refund, duplicate delivery, and a manual reconciliation run after a deliberately missed webhook.
3. Create the separate production catalog and webhook, then replace every Whop environment value together.
4. Run `npm test`, `npm run lint`, and `npm run build`.
5. In production, buy and refund one subscription and buy one top-up. Match each Whop resource to the Supabase payment, membership, credit-ledger, and portal records.
6. Disable legacy billing credentials and webhooks only after these smoke tests pass.

The `/api/health` response reports whether the Whop server configuration is present; it never exposes keys or plan IDs.
