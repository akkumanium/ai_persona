-- Convert stored token-denominated amounts from the old $1 = 1,000 tokens
-- scale to the new $1 = 100 tokens scale. Historical column names still say
-- "cents", but the application treats these integer values as tokens.

update public.account_profiles
set
  credit_balance_cents = ceil(greatest(credit_balance_cents, 0)::numeric / 10)::integer,
  updated_at = now()
where credit_balance_cents > 0;

update public.generation_jobs
set
  cost_estimate_cents = ceil(greatest(cost_estimate_cents, 0)::numeric / 10)::integer,
  updated_at = now()
where cost_estimate_cents > 0;

update public.credit_ledger
set amount_cents = case
  when amount_cents > 0 then ceil(amount_cents::numeric / 10)::integer
  when amount_cents < 0 then -ceil(abs(amount_cents)::numeric / 10)::integer
  else 0
end
where amount_cents <> 0;

alter table public.referral_rewards
  alter column reward_amount_cents set default 100;

update public.referral_rewards
set reward_amount_cents = ceil(greatest(reward_amount_cents, 0)::numeric / 10)::integer
where reward_amount_cents > 0;

update public.billing_refund_requests
set amount_cents = ceil(greatest(amount_cents, 0)::numeric / 10)::integer
where amount_cents > 0;
