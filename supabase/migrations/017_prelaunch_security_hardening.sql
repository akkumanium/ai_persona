-- Security-critical launch hardening. Apply this migration before deploying the matching application release.

create table if not exists public.billing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id text not null,
  price_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (option_id in ('solo', 'creator', 'agency', 'topup_2', 'topup_5', 'topup_10', 'topup_20', 'topup_50', 'topup_100'))
);
alter table public.billing_checkout_intents enable row level security;
create policy "checkout intents visible to owner" on public.billing_checkout_intents
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.billing_checkout_intents to authenticated, service_role;
grant insert, update, delete on public.billing_checkout_intents to service_role;
create index if not exists checkout_intents_user_expiry_idx on public.billing_checkout_intents (user_id, expires_at desc);

alter table public.billing_subscriptions add column if not exists checkout_intent_id uuid references public.billing_checkout_intents(id);
alter table public.billing_subscriptions add column if not exists last_event_occurred_at timestamptz;
alter table public.billing_subscriptions add column if not exists scheduled_change jsonb;
alter table public.billing_subscriptions add column if not exists current_period_starts_at timestamptz;
alter table public.billing_subscriptions add column if not exists current_period_ends_at timestamptz;
alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_status_check
  check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled', 'expired', 'refunded', 'disputed')) not valid;
alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_plan_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_plan_check
  check (plan_id in ('solo', 'creator', 'agency')) not valid;

with ranked as (
  select subscription_id, row_number() over (partition by user_id order by updated_at desc, created_at desc) as position
  from public.billing_subscriptions where status in ('active', 'trialing')
)
update public.billing_subscriptions s set status = 'canceled', updated_at = now()
from ranked r where r.subscription_id = s.subscription_id and r.position > 1;
create unique index if not exists one_active_subscription_per_user
  on public.billing_subscriptions (user_id) where status in ('active', 'trialing');

alter table public.billing_webhook_events add column if not exists occurred_at timestamptz;

create table if not exists public.billing_payments (
  transaction_id text primary key,
  event_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_intent_id uuid not null references public.billing_checkout_intents(id),
  subscription_id text,
  option_id text not null,
  price_id text not null,
  paid_amount_minor integer not null check (paid_amount_minor >= 0),
  granted_credit_cents integer not null check (granted_credit_cents >= 0),
  reversed_credit_cents integer not null default 0 check (reversed_credit_cents >= 0),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.billing_payments enable row level security;
create policy "payments visible to owner" on public.billing_payments for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.billing_payments to authenticated, service_role;
grant insert, update, delete on public.billing_payments to service_role;

create table if not exists public.billing_adjustments (
  adjustment_id text primary key,
  transaction_id text not null references public.billing_payments(transaction_id),
  event_id text not null unique,
  action text not null,
  adjustment_type text not null,
  status text not null,
  adjusted_amount_minor integer not null default 0,
  reversed_credit_cents integer not null default 0,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_adjustments enable row level security;
grant select, insert, update, delete on public.billing_adjustments to service_role;

create table if not exists public.billing_operations_outbox (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  operation_type text not null check(operation_type in ('cancel_subscription')),
  subscription_id text not null,
  status text not null default 'pending' check(status in ('pending','processing','completed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_operations_outbox enable row level security;
grant select,insert,update,delete on public.billing_operations_outbox to service_role;

alter table public.account_profiles add column if not exists credit_debt_cents integer not null default 0 check (credit_debt_cents >= 0);
alter table public.billing_refund_requests add column if not exists reserved_credit_cents integer not null default 0;
alter table public.credit_ledger add column if not exists operation_key text;
create unique index if not exists credit_ledger_operation_key_unique on public.credit_ledger (operation_key);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null,
  reset_at timestamptz not null
);
alter table public.rate_limit_buckets enable row level security;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  if length(p_bucket_key) <> 64 or p_limit < 1 or p_window_seconds < 1 then return false; end if;
  delete from public.rate_limit_buckets where reset_at < now() - interval '1 hour';
  insert into public.rate_limit_buckets(bucket_key, request_count, reset_at)
  values (p_bucket_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update set
    request_count = case when public.rate_limit_buckets.reset_at <= now() then 1 else public.rate_limit_buckets.request_count + 1 end,
    reset_at = case when public.rate_limit_buckets.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else public.rate_limit_buckets.reset_at end
  returning request_count <= p_limit into allowed;
  return allowed;
end; $$;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create table if not exists public.account_storage_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  quota_bytes bigint not null default 1073741824 check (quota_bytes > 0),
  updated_at timestamptz not null default now()
);
alter table public.account_storage_usage enable row level security;
grant select, insert, update, delete on public.account_storage_usage to service_role;

create or replace function public.reserve_storage_upload(p_user_id uuid, p_size_bytes bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare active_subscription boolean; allowed boolean;
begin
  if p_size_bytes <= 0 or p_size_bytes > 104857600 then return false; end if;
  select exists(select 1 from public.billing_subscriptions where user_id = p_user_id and status in ('active','trialing')) into active_subscription;
  if not active_subscription then return false; end if;
  insert into public.account_storage_usage(user_id, reserved_bytes) values (p_user_id, p_size_bytes)
  on conflict (user_id) do update set reserved_bytes = public.account_storage_usage.reserved_bytes + p_size_bytes, updated_at = now()
  where public.account_storage_usage.reserved_bytes + p_size_bytes <= public.account_storage_usage.quota_bytes
  returning true into allowed;
  return coalesce(allowed, false);
end; $$;
create or replace function public.release_storage_reservation(p_user_id uuid, p_size_bytes bigint)
returns void language sql security definer set search_path = public as $$
  update public.account_storage_usage set reserved_bytes = greatest(0, reserved_bytes - greatest(p_size_bytes, 0)), updated_at = now() where user_id = p_user_id;
$$;
revoke execute on function public.reserve_storage_upload(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.release_storage_reservation(uuid, bigint) from public, anon, authenticated;
grant execute on function public.reserve_storage_upload(uuid, bigint) to service_role;
grant execute on function public.release_storage_reservation(uuid, bigint) to service_role;

drop policy if exists "users can insert own upload objects" on storage.objects;
drop policy if exists "users can update own storage objects" on storage.objects;
drop policy if exists "users can delete own storage objects" on storage.objects;
update storage.buckets set file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','audio/aac','audio/flac','audio/mp4','audio/mpeg','audio/ogg','audio/opus','audio/wav','audio/webm','video/mp4','video/mpeg','video/quicktime','video/webm']
where id in ('uploads','generated-images','generated-videos','generated-audio','provider-temp');

drop policy if exists "jobs owned by user" on public.generation_jobs;
create policy "jobs visible to owner" on public.generation_jobs for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.generation_jobs from authenticated;
grant select on public.generation_jobs to authenticated;
grant select, insert, update, delete on public.generation_jobs to service_role;
create unique index if not exists generation_jobs_provider_id_unique on public.generation_jobs(provider, provider_job_id) where provider_job_id is not null;
with ranked_defaults as (
  select id,row_number() over(partition by persona_id,reference_slot order by created_at desc,id) as position
  from public.assets where is_default_reference=true and persona_id is not null and reference_slot is not null
)
update public.assets a set is_default_reference=false from ranked_defaults r where a.id=r.id and r.position>1;
create unique index if not exists one_default_reference_per_slot on public.assets(persona_id,reference_slot)
  where is_default_reference=true and persona_id is not null and reference_slot is not null;

create table if not exists public.generation_job_assets (
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  primary key(job_id,asset_id)
);
alter table public.generation_job_assets enable row level security;
create policy "job asset links visible to owner" on public.generation_job_assets for select to authenticated
  using(exists(select 1 from public.generation_jobs where id=job_id and user_id=(select auth.uid())));
grant select on public.generation_job_assets to authenticated,service_role;
grant insert,update,delete on public.generation_job_assets to service_role;

create or replace function public.enforce_persona_subscription_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare allowed_personas integer; current_personas integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  allowed_personas := public.active_persona_limit_for_user(new.user_id);
  if allowed_personas <= 0 then raise exception 'Active subscription required to create personas.'; end if;
  if allowed_personas < 2147483647 then
    select count(*) into current_personas from public.personas where user_id = new.user_id;
    if current_personas >= allowed_personas then raise exception 'Persona limit reached for current subscription.'; end if;
  end if;
  return new;
end; $$;

create or replace function public.claim_referral(p_referral_code text, p_referred_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare referrer_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_referred_user_id then raise exception 'not authorized'; end if;
  select user_id into referrer_id from public.account_profiles where referral_code = lower(trim(p_referral_code));
  if referrer_id is null or referrer_id = p_referred_user_id then return false; end if;
  insert into public.referral_rewards(referrer_user_id, referred_user_id, status, reward_amount_cents)
  values(referrer_id, p_referred_user_id, 'pending', 100) on conflict (referred_user_id) do nothing;
  return found;
end; $$;

create or replace function public.consume_credits(p_user_id uuid, p_amount_cents integer, p_job_id uuid, p_description text)
returns integer language plpgsql security definer set search_path = public as $$
declare next_balance integer; already_applied integer; daily_spend integer;
begin
  select amount_cents into already_applied from public.credit_ledger where operation_key = 'consume:' || p_job_id::text;
  if found then select credit_balance_cents into next_balance from public.account_profiles where user_id = p_user_id; return next_balance; end if;
  select coalesce(-sum(amount_cents),0) into daily_spend from public.credit_ledger
    where user_id = p_user_id and amount_cents < 0 and created_at >= date_trunc('day', now()) and operation_key like 'consume:%';
  if daily_spend + p_amount_cents > 25000 then raise exception 'Daily generation budget exceeded.'; end if;
  update public.account_profiles set credit_balance_cents = credit_balance_cents - p_amount_cents, updated_at = now()
    where user_id = p_user_id and credit_debt_cents = 0 and p_amount_cents > 0 and credit_balance_cents >= p_amount_cents
      and exists(select 1 from public.billing_subscriptions where user_id=p_user_id and status in ('active','trialing'))
    returning credit_balance_cents into next_balance;
  if next_balance is null then return null; end if;
  insert into public.credit_ledger(id,user_id,job_id,amount_cents,description,operation_key)
    values(gen_random_uuid(),p_user_id,p_job_id,-p_amount_cents,p_description,'consume:' || p_job_id::text);
  return next_balance;
end; $$;

create or replace function public.refund_credits(p_user_id uuid, p_amount_cents integer, p_job_id uuid, p_description text)
returns integer language plpgsql security definer set search_path = public as $$
declare next_balance integer; consumed integer;
begin
  if exists(select 1 from public.credit_ledger where operation_key = 'refund:' || p_job_id::text) then
    select credit_balance_cents into next_balance from public.account_profiles where user_id=p_user_id; return next_balance;
  end if;
  select -amount_cents into consumed from public.credit_ledger where operation_key='consume:' || p_job_id::text and user_id=p_user_id;
  if consumed is null then raise exception 'Cannot refund credits that were not consumed for this job.'; end if;
  update public.account_profiles set credit_balance_cents=credit_balance_cents+least(consumed,greatest(p_amount_cents,0)),updated_at=now()
    where user_id=p_user_id returning credit_balance_cents into next_balance;
  insert into public.credit_ledger(id,user_id,job_id,amount_cents,description,operation_key)
    values(gen_random_uuid(),p_user_id,p_job_id,least(consumed,greatest(p_amount_cents,0)),p_description,'refund:' || p_job_id::text);
  return next_balance;
end; $$;

create or replace function public.apply_paddle_billing_event_v2(
  p_event_id text, p_event_type text, p_occurred_at timestamptz, p_user_id uuid, p_checkout_intent_id uuid,
  p_paddle_entity_id text, p_subscription_id text, p_paddle_customer_id text, p_subscription_status text,
  p_plan_id text, p_price_id text, p_grant_amount_cents integer, p_paid_amount_minor integer, p_payload jsonb,
  p_is_subscription_payment boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_count integer; grant_amount integer := 0; payment_inserted integer; has_active boolean; reward record;
begin
  perform 1 from public.billing_checkout_intents where id=p_checkout_intent_id and user_id=p_user_id and option_id=p_plan_id and price_id=p_price_id for update;
  if not found then raise exception 'checkout intent mismatch'; end if;
  insert into public.billing_webhook_events(event_id,event_type,user_id,paddle_entity_id,payload,occurred_at)
    values(p_event_id,p_event_type,p_user_id,p_paddle_entity_id,coalesce(p_payload,'{}'),p_occurred_at) on conflict(event_id) do nothing;
  get diagnostics inserted_count=row_count; if inserted_count=0 then return false; end if;

  if coalesce(p_subscription_id,'')<>'' and p_subscription_status in ('active','trialing') and exists(
    select 1 from public.billing_subscriptions where subscription_id=p_subscription_id and status in ('refunded','disputed')
  ) then
    select status into p_subscription_status from public.billing_subscriptions where subscription_id=p_subscription_id;
  end if;

  if p_event_type='transaction.completed' then
    if not p_is_subscription_payment then
      select exists(select 1 from public.billing_subscriptions where user_id=p_user_id and status in ('active','trialing')) into has_active;
      if not has_active then raise exception 'active subscription required for top-up'; end if;
    end if;
    grant_amount := greatest(p_grant_amount_cents,0);
    if p_is_subscription_payment and exists(select 1 from public.billing_payments where subscription_id=p_subscription_id and granted_credit_cents>0) then grant_amount:=0; end if;
    insert into public.billing_payments(transaction_id,event_id,user_id,checkout_intent_id,subscription_id,option_id,price_id,paid_amount_minor,granted_credit_cents,occurred_at,payload)
      values(p_paddle_entity_id,p_event_id,p_user_id,p_checkout_intent_id,p_subscription_id,p_plan_id,p_price_id,greatest(p_paid_amount_minor,0),grant_amount,p_occurred_at,p_payload)
      on conflict(transaction_id) do nothing;
    get diagnostics payment_inserted=row_count;
    if payment_inserted=0 then grant_amount:=0; end if;
    update public.billing_checkout_intents set consumed_at=coalesce(consumed_at,now()) where id=p_checkout_intent_id;
  end if;

  insert into public.account_profiles(user_id,credit_balance_cents,billing_customer_id,account_metadata,referral_code)
  values(p_user_id,grant_amount,p_paddle_customer_id,jsonb_build_object('paddle',jsonb_build_object('customerId',p_paddle_customer_id,'subscriptionId',p_subscription_id,'subscriptionStatus',p_subscription_status,'planId',p_plan_id,'priceId',p_price_id,'lastEventId',p_event_id,'occurredAt',p_occurred_at)),lower(substr(md5(p_user_id::text),1,12)))
  on conflict(user_id) do update set credit_balance_cents=public.account_profiles.credit_balance_cents+grant_amount,
    billing_customer_id=coalesce(excluded.billing_customer_id,public.account_profiles.billing_customer_id),
    account_metadata=coalesce(public.account_profiles.account_metadata,'{}')||excluded.account_metadata,updated_at=now();
  if grant_amount>0 then insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
    values(gen_random_uuid(),p_user_id,grant_amount,case when p_is_subscription_payment then 'Paddle welcome credits: '||p_plan_id else 'Paddle top-up: '||p_plan_id end,'paddle-grant:'||p_paddle_entity_id) on conflict(operation_key) do nothing; end if;

  if coalesce(p_subscription_id,'')<>'' then
    insert into public.billing_subscriptions(subscription_id,user_id,paddle_customer_id,status,plan_id,price_id,checkout_intent_id,last_event_occurred_at,scheduled_change,current_period_starts_at,current_period_ends_at)
    values(p_subscription_id,p_user_id,p_paddle_customer_id,p_subscription_status,p_plan_id,p_price_id,p_checkout_intent_id,p_occurred_at,p_payload#>'{data,scheduled_change}',nullif(p_payload#>>'{data,current_billing_period,starts_at}','')::timestamptz,nullif(p_payload#>>'{data,current_billing_period,ends_at}','')::timestamptz)
    on conflict(subscription_id) do update set paddle_customer_id=excluded.paddle_customer_id,status=excluded.status,plan_id=excluded.plan_id,price_id=excluded.price_id,
      checkout_intent_id=coalesce(public.billing_subscriptions.checkout_intent_id,excluded.checkout_intent_id),last_event_occurred_at=excluded.last_event_occurred_at,
      scheduled_change=excluded.scheduled_change,current_period_starts_at=excluded.current_period_starts_at,current_period_ends_at=excluded.current_period_ends_at,updated_at=now()
    where public.billing_subscriptions.last_event_occurred_at is null or excluded.last_event_occurred_at>public.billing_subscriptions.last_event_occurred_at;
  end if;
  if p_is_subscription_payment then for reward in update public.referral_rewards set status='rewarded',rewarded_subscription_id=p_subscription_id,rewarded_event_id=p_event_id,rewarded_at=now()
    where referred_user_id=p_user_id and status='pending' returning referrer_user_id,reward_amount_cents loop
      update public.account_profiles set credit_balance_cents=credit_balance_cents+reward.reward_amount_cents,updated_at=now() where user_id=reward.referrer_user_id;
      insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key) values(gen_random_uuid(),reward.referrer_user_id,reward.reward_amount_cents,'Referral reward: invited user subscribed','referral:'||p_user_id::text) on conflict(operation_key) do nothing;
    end loop; end if;
  return true;
end; $$;

create or replace function public.apply_paddle_adjustment_event(
  p_event_id text,p_event_type text,p_occurred_at timestamptz,p_adjustment_id text,p_transaction_id text,p_action text,p_adjustment_type text,p_status text,p_adjusted_amount_minor integer,p_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare payment public.billing_payments%rowtype; inserted_count integer; reversal integer; available integer; shortfall integer; previous_reversal integer:=0; reserved integer:=0; refund_user uuid;
begin
  select * into payment from public.billing_payments where transaction_id=p_transaction_id for update;
  if not found then raise exception 'unknown adjusted transaction'; end if;
  insert into public.billing_webhook_events(event_id,event_type,user_id,paddle_entity_id,payload,occurred_at)
    values(p_event_id,p_event_type,payment.user_id,p_adjustment_id,p_payload,p_occurred_at) on conflict(event_id) do nothing;
  get diagnostics inserted_count=row_count; if inserted_count=0 then return false; end if;
  select reversed_credit_cents into previous_reversal from public.billing_adjustments where adjustment_id=p_adjustment_id;
  insert into public.billing_adjustments(adjustment_id,transaction_id,event_id,action,adjustment_type,status,adjusted_amount_minor,occurred_at,payload)
    values(p_adjustment_id,p_transaction_id,p_event_id,lower(p_action),lower(p_adjustment_type),lower(p_status),greatest(p_adjusted_amount_minor,0),p_occurred_at,p_payload)
    on conflict(adjustment_id) do update set event_id=excluded.event_id,status=excluded.status,adjusted_amount_minor=excluded.adjusted_amount_minor,occurred_at=excluded.occurred_at,payload=excluded.payload,updated_at=now()
    where excluded.occurred_at>public.billing_adjustments.occurred_at;
  if lower(p_status) in ('rejected','failed','canceled','cancelled') then
    select reserved_credit_cents,user_id into reserved,refund_user from public.billing_refund_requests
      where paddle_adjustment_id=p_adjustment_id and status in ('pending','submitted') for update;
    update public.billing_refund_requests set status='rejected',failure_message='Paddle adjustment '||p_status,reserved_credit_cents=0
      where paddle_adjustment_id=p_adjustment_id and status in ('pending','submitted');
    if refund_user is not null and reserved>0 then update public.account_profiles set credit_balance_cents=credit_balance_cents+reserved,updated_at=now() where user_id=refund_user; end if;
    return true;
  end if;
  if lower(p_status) not in ('approved','complete','completed') then
    if lower(p_action) like 'chargeback%' then update public.billing_subscriptions set status='disputed',updated_at=now() where subscription_id=payment.subscription_id; end if;
    return true;
  end if;
  if lower(p_action)='chargeback_reverse' then
    reversal:=least(payment.reversed_credit_cents,greatest(previous_reversal,payment.granted_credit_cents));
    update public.account_profiles set credit_debt_cents=greatest(0,credit_debt_cents-reversal),credit_balance_cents=credit_balance_cents+greatest(0,reversal-credit_debt_cents),updated_at=now() where user_id=payment.user_id;
    update public.billing_payments set reversed_credit_cents=greatest(0,reversed_credit_cents-reversal) where transaction_id=p_transaction_id;
    update public.billing_subscriptions set status='active',updated_at=now() where subscription_id=payment.subscription_id and status='disputed';
    return true;
  end if;
  reversal:=case when payment.paid_amount_minor>0 and p_adjusted_amount_minor>0 then least(payment.granted_credit_cents-payment.reversed_credit_cents,ceil(payment.granted_credit_cents::numeric*p_adjusted_amount_minor/payment.paid_amount_minor)::integer) else payment.granted_credit_cents-payment.reversed_credit_cents end;
  reversal:=greatest(reversal,0);
  select coalesce(reserved_credit_cents,0) into reserved from public.billing_refund_requests where paddle_adjustment_id=p_adjustment_id for update;
  if reserved=0 then
    select credit_balance_cents into available from public.account_profiles where user_id=payment.user_id for update;
    shortfall:=greatest(0,reversal-available);
    update public.account_profiles set credit_balance_cents=greatest(0,credit_balance_cents-reversal),credit_debt_cents=credit_debt_cents+shortfall,updated_at=now() where user_id=payment.user_id;
  end if;
  if reversal>0 then insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key) values(gen_random_uuid(),payment.user_id,-reversal,'Paddle adjustment credit reversal: '||p_adjustment_id,'paddle-adjustment:'||p_adjustment_id) on conflict(operation_key) do nothing; end if;
  update public.billing_payments set reversed_credit_cents=reversed_credit_cents+reversal where transaction_id=p_transaction_id;
  update public.billing_adjustments set reversed_credit_cents=reversal where adjustment_id=p_adjustment_id;
  update public.billing_refund_requests set status='approved',reserved_credit_cents=0 where paddle_adjustment_id=p_adjustment_id;
  if payment.subscription_id is not null and (lower(p_adjustment_type)='full' or lower(p_action) like 'chargeback%') then
    update public.billing_subscriptions set status=case when lower(p_action) like 'chargeback%' then 'disputed' else 'refunded' end,updated_at=now() where subscription_id=payment.subscription_id;
    if lower(p_action)='refund' and lower(p_adjustment_type)='full' then
      insert into public.billing_operations_outbox(operation_key,operation_type,subscription_id)
        values('cancel-refunded-subscription:'||payment.subscription_id,'cancel_subscription',payment.subscription_id) on conflict(operation_key) do nothing;
    end if;
  end if;
  return true;
end; $$;

create or replace function public.create_refund_request_and_reserve(p_user_id uuid,p_transaction_id text)
returns uuid language plpgsql security definer set search_path=public as $$
declare payment public.billing_payments%rowtype; request_id uuid;
begin
  select * into payment from public.billing_payments where transaction_id=p_transaction_id and user_id=p_user_id for update;
  if not found or payment.granted_credit_cents<=payment.reversed_credit_cents then raise exception 'payment is not refundable'; end if;
  perform 1 from public.account_profiles where user_id=p_user_id and credit_balance_cents>=payment.granted_credit_cents-payment.reversed_credit_cents for update;
  if not found then raise exception 'refundable credits are no longer available'; end if;
  update public.account_profiles set credit_balance_cents=credit_balance_cents-(payment.granted_credit_cents-payment.reversed_credit_cents),updated_at=now() where user_id=p_user_id;
  insert into public.billing_refund_requests(user_id,transaction_id,amount_cents,reserved_credit_cents)
    values(p_user_id,p_transaction_id,payment.granted_credit_cents-payment.reversed_credit_cents,payment.granted_credit_cents-payment.reversed_credit_cents) returning id into request_id;
  return request_id;
end; $$;

create or replace function public.release_refund_reservation(p_request_id uuid,p_failure_message text)
returns void language plpgsql security definer set search_path=public as $$
declare request public.billing_refund_requests%rowtype;
begin
  select * into request from public.billing_refund_requests where id=p_request_id for update;
  if request.status not in ('pending','submitted') then return; end if;
  update public.account_profiles set credit_balance_cents=credit_balance_cents+request.reserved_credit_cents,updated_at=now() where user_id=request.user_id;
  update public.billing_refund_requests set reserved_credit_cents=0,status='failed',failure_message=p_failure_message where id=p_request_id;
end; $$;

revoke execute on function public.apply_paddle_billing_event_v2(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,integer,integer,jsonb,boolean) from public,anon,authenticated;
revoke execute on function public.apply_paddle_adjustment_event(text,text,timestamptz,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.create_refund_request_and_reserve(uuid,text) from public,anon,authenticated;
revoke execute on function public.release_refund_reservation(uuid,text) from public,anon,authenticated;
grant execute on function public.apply_paddle_billing_event_v2(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,integer,integer,jsonb,boolean) to service_role;
grant execute on function public.apply_paddle_adjustment_event(text,text,timestamptz,text,text,text,text,text,integer,jsonb) to service_role;
grant execute on function public.create_refund_request_and_reserve(uuid,text) to service_role;
grant execute on function public.release_refund_reservation(uuid,text) to service_role;

create or replace function public.finalize_generation_job(p_user_id uuid, p_job jsonb, p_assets jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare asset jsonb; job_id uuid := (p_job->>'id')::uuid;
begin
  perform 1 from public.generation_jobs where id=job_id and user_id=p_user_id and status in ('queued','running') for update;
  if not found then
    return exists(select 1 from public.generation_jobs where id=job_id and user_id=p_user_id and status='succeeded');
  end if;
  for asset in select value from jsonb_array_elements(coalesce(p_assets,'[]'::jsonb)) loop
    if (asset->>'user_id')::uuid <> p_user_id then raise exception 'asset owner mismatch'; end if;
    insert into public.assets(id,user_id,persona_id,kind,storage_bucket,storage_path,public_url,title,prompt,reference_asset_ids,reference_slot,is_default_reference,generation_type,provider,provider_job_id,model,mime_type,provider_asset_id,created_at)
    values((asset->>'id')::uuid,p_user_id,nullif(asset->>'persona_id','')::uuid,(asset->>'kind')::public.asset_kind,nullif(asset->>'storage_bucket',''),nullif(asset->>'storage_path',''),nullif(asset->>'public_url',''),asset->>'title',coalesce(asset->>'prompt',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(asset->'reference_asset_ids','[]'::jsonb))::uuid),'{}'::uuid[]),nullif(asset->>'reference_slot',''),coalesce((asset->>'is_default_reference')::boolean,false),(asset->>'generation_type')::public.generation_type,(asset->>'provider')::public.provider_name,nullif(asset->>'provider_job_id',''),asset->>'model',asset->>'mime_type',nullif(asset->>'provider_asset_id',''),(asset->>'created_at')::timestamptz)
    on conflict(id) do nothing;
  end loop;
  update public.generation_jobs set status=(p_job->>'status')::public.job_status,provider=(p_job->>'provider')::public.provider_name,provider_job_id=nullif(p_job->>'provider_job_id',''),model=p_job->>'model',
    generation_type=(p_job->>'generation_type')::public.generation_type,input_params=coalesce(p_job->'input_params','{}'::jsonb),output_asset_ids=coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'output_asset_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
    cost_estimate_cents=coalesce((p_job->>'cost_estimate_cents')::integer,0),raw_provider_response=p_job->'raw_provider_response',error_message=nullif(p_job->>'error_message',''),updated_at=(p_job->>'updated_at')::timestamptz
    where id=job_id and user_id=p_user_id;
  insert into public.generation_job_assets(job_id,asset_id)
    select (p_job->>'id')::uuid,jsonb_array_elements_text(coalesce(p_job->'output_asset_ids','[]'::jsonb))::uuid on conflict do nothing;
  return true;
end; $$;
revoke execute on function public.finalize_generation_job(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_generation_job(uuid,jsonb,jsonb) to service_role;
