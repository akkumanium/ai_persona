alter table public.account_profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references auth.users(id) on delete set null;

update public.account_profiles
set referral_code = lower(substr(md5(user_id::text), 1, 12))
where referral_code is null or referral_code = '';

alter table public.account_profiles
  alter column referral_code set not null;

create unique index if not exists account_profiles_referral_code_key
  on public.account_profiles (referral_code);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'rewarded')),
  reward_amount_cents integer not null default 1000 check (reward_amount_cents > 0),
  rewarded_subscription_id text,
  rewarded_event_id text,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  unique (referred_user_id),
  check (referrer_user_id <> referred_user_id)
);

alter table public.referral_rewards enable row level security;

drop policy if exists "referral rewards visible to participants" on public.referral_rewards;
create policy "referral rewards visible to participants" on public.referral_rewards
  for select to authenticated
  using ((select auth.uid()) in (referrer_user_id, referred_user_id));

create index if not exists referral_rewards_referrer_status_idx
  on public.referral_rewards (referrer_user_id, status, created_at desc);

create or replace function public.claim_referral(
  p_referral_code text,
  p_referred_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := lower(trim(coalesce(p_referral_code, '')));
  referrer_id uuid;
begin
  if normalized_code = '' or p_referred_user_id is null then
    return false;
  end if;

  select user_id into referrer_id
  from public.account_profiles
  where lower(referral_code) = normalized_code
  limit 1;

  if referrer_id is null or referrer_id = p_referred_user_id then
    return false;
  end if;

  insert into public.account_profiles (user_id, referral_code, referred_by_user_id)
  values (p_referred_user_id, lower(substr(md5(p_referred_user_id::text), 1, 12)), referrer_id)
  on conflict (user_id) do update
  set
    referred_by_user_id = coalesce(public.account_profiles.referred_by_user_id, referrer_id),
    updated_at = now();

  insert into public.referral_rewards (
    referrer_user_id,
    referred_user_id,
    referral_code
  )
  values (
    referrer_id,
    p_referred_user_id,
    normalized_code
  )
  on conflict (referred_user_id) do nothing;

  return true;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_referral_code text := coalesce(new.raw_user_meta_data->>'referral_code', '');
begin
  insert into public.account_profiles (user_id, display_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    lower(substr(md5(new.id::text), 1, 12))
  )
  on conflict (user_id) do nothing;

  if raw_referral_code <> '' then
    perform public.claim_referral(raw_referral_code, new.id);
  end if;

  return new;
end;
$$;

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
  p_payload jsonb,
  p_is_subscription_payment boolean default false
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
  reward record;
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
    account_metadata,
    referral_code
  )
  values (
    p_user_id,
    normalized_amount,
    p_paddle_customer_id,
    paddle_metadata,
    lower(substr(md5(p_user_id::text), 1, 12))
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

  if p_is_subscription_payment then
    for reward in
      update public.referral_rewards
      set
        status = 'rewarded',
        rewarded_subscription_id = p_subscription_id,
        rewarded_event_id = p_event_id,
        rewarded_at = now()
      where referred_user_id = p_user_id
        and status = 'pending'
      returning id, referrer_user_id, reward_amount_cents
    loop
      update public.account_profiles
      set
        credit_balance_cents = credit_balance_cents + reward.reward_amount_cents,
        updated_at = now()
      where user_id = reward.referrer_user_id;

      insert into public.credit_ledger (
        id,
        user_id,
        amount_cents,
        description
      )
      values (
        gen_random_uuid(),
        reward.referrer_user_id,
        reward.reward_amount_cents,
        'Referral reward: invited user subscribed'
      );
    end loop;
  end if;

  return true;
end;
$$;
