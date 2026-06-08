create table if not exists public.billing_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_customer_id text,
  status text not null default 'unknown',
  plan_id text not null,
  price_id text not null,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  paddle_entity_id text,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  error_message text
);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "billing subscriptions visible to owner" on public.billing_subscriptions;
create policy "billing subscriptions visible to owner" on public.billing_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "billing webhook events visible to owner" on public.billing_webhook_events;
create policy "billing webhook events visible to owner" on public.billing_webhook_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists set_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger set_billing_subscriptions_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

create index if not exists billing_subscriptions_user_status_idx
  on public.billing_subscriptions (user_id, status);

create index if not exists billing_webhook_events_user_processed_idx
  on public.billing_webhook_events (user_id, processed_at desc);

create or replace function public.apply_paddle_billing_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_paddle_entity_id text,
  p_subscription_id text,
  p_paddle_customer_id text,
  p_subscription_status text,
  p_plan_id text,
  p_price_id text,
  p_amount_cents integer,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event_count integer;
  normalized_amount integer := greatest(coalesce(p_amount_cents, 0), 0);
  paddle_metadata jsonb;
begin
  insert into public.billing_webhook_events (
    event_id,
    event_type,
    user_id,
    paddle_entity_id,
    payload
  )
  values (
    p_event_id,
    p_event_type,
    p_user_id,
    p_paddle_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_event_count = row_count;
  if inserted_event_count = 0 then
    return false;
  end if;

  paddle_metadata := jsonb_build_object(
    'paddle',
    jsonb_build_object(
      'customerId', p_paddle_customer_id,
      'subscriptionId', p_subscription_id,
      'subscriptionStatus', p_subscription_status,
      'planId', p_plan_id,
      'priceId', p_price_id,
      'lastEventId', p_event_id,
      'lastEventType', p_event_type,
      'updatedAt', now()
    )
  );

  insert into public.account_profiles (
    user_id,
    credit_balance_cents,
    billing_customer_id,
    account_metadata
  )
  values (
    p_user_id,
    normalized_amount,
    p_paddle_customer_id,
    paddle_metadata
  )
  on conflict (user_id) do update
  set
    credit_balance_cents = public.account_profiles.credit_balance_cents + normalized_amount,
    billing_customer_id = coalesce(excluded.billing_customer_id, public.account_profiles.billing_customer_id),
    account_metadata = coalesce(public.account_profiles.account_metadata, '{}'::jsonb) || paddle_metadata,
    updated_at = now();

  if coalesce(p_subscription_id, '') <> '' then
    insert into public.billing_subscriptions (
      subscription_id,
      user_id,
      paddle_customer_id,
      status,
      plan_id,
      price_id
    )
    values (
      p_subscription_id,
      p_user_id,
      p_paddle_customer_id,
      coalesce(nullif(p_subscription_status, ''), 'active'),
      p_plan_id,
      p_price_id
    )
    on conflict (subscription_id) do update
    set
      paddle_customer_id = excluded.paddle_customer_id,
      status = excluded.status,
      plan_id = excluded.plan_id,
      price_id = excluded.price_id,
      updated_at = now();
  end if;

  if normalized_amount > 0 then
    insert into public.credit_ledger (
      id,
      user_id,
      amount_cents,
      description
    )
    values (
      gen_random_uuid(),
      p_user_id,
      normalized_amount,
      'Paddle subscription top-up: ' || p_plan_id
    );
  end if;

  return true;
end;
$$;
