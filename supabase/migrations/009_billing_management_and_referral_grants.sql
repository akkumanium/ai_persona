grant select on table public.referral_rewards to authenticated, service_role;
grant insert, update, delete on table public.referral_rewards to service_role;

revoke execute on function public.claim_referral(text, uuid) from public, anon;
grant execute on function public.claim_referral(text, uuid) to authenticated, service_role;

revoke execute on function public.apply_paddle_billing_event(
  text, text, uuid, text, text, text, text, text, text, integer, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.apply_paddle_billing_event(
  text, text, uuid, text, text, text, text, text, text, integer, jsonb, boolean
) to service_role;

create table if not exists public.billing_refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'failed')),
  paddle_adjustment_id text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_refund_requests enable row level security;
create policy "refund requests visible to owner" on public.billing_refund_requests
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on table public.billing_refund_requests to authenticated, service_role;
grant insert, update, delete on table public.billing_refund_requests to service_role;

drop trigger if exists set_billing_refund_requests_updated_at on public.billing_refund_requests;
create trigger set_billing_refund_requests_updated_at
  before update on public.billing_refund_requests
  for each row execute function public.set_updated_at();
