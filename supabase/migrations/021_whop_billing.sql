-- Replace Paddle with Whop. Paddle billing records are intentionally discarded.

drop function if exists public.apply_paddle_billing_event(text,text,uuid,text,text,text,text,text,text,integer,jsonb) cascade;
drop function if exists public.apply_paddle_billing_event(text,text,uuid,text,text,text,text,text,text,integer,jsonb,boolean) cascade;
drop function if exists public.apply_paddle_billing_event_v2(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,integer,integer,jsonb,boolean) cascade;
drop function if exists public.apply_paddle_adjustment_event(text,text,timestamptz,text,text,text,text,text,integer,jsonb) cascade;

delete from public.billing_refund_requests;
delete from public.billing_adjustments;
delete from public.billing_operations_outbox;
delete from public.billing_payments;
delete from public.billing_subscriptions;
delete from public.billing_checkout_intents;
delete from public.billing_webhook_events;

alter table public.account_profiles rename column billing_customer_id to provider_customer_id;
update public.account_profiles set account_metadata = coalesce(account_metadata, '{}'::jsonb) - 'paddle';

alter table public.billing_checkout_intents rename column price_id to provider_plan_id;
alter table public.billing_checkout_intents add column provider text;
alter table public.billing_checkout_intents alter column provider set default 'whop';
alter table public.billing_checkout_intents alter column provider set not null;
alter table public.billing_checkout_intents add column provider_checkout_session_id text unique;
alter table public.billing_checkout_intents add column return_path text not null default '/pricing' check (return_path in ('/pricing','/studio'));
alter table public.billing_checkout_intents add column status text not null default 'pending' check (status in ('pending','consumed','failed','expired'));
alter table public.billing_checkout_intents add column failure_message text;
drop policy if exists "checkout intents visible to owner" on public.billing_checkout_intents;
revoke select on public.billing_checkout_intents from authenticated;

alter table public.billing_subscriptions rename column paddle_customer_id to provider_user_id;
alter table public.billing_subscriptions rename column price_id to provider_plan_id;
alter table public.billing_subscriptions add column provider text;
alter table public.billing_subscriptions alter column provider set default 'whop';
alter table public.billing_subscriptions alter column provider set not null;
alter table public.billing_subscriptions add column provider_member_id text;
alter table public.billing_subscriptions add column manage_url text;
alter table public.billing_subscriptions add column cancel_at_period_end boolean not null default false;
alter table public.billing_subscriptions add column provider_updated_at timestamptz;
alter table public.billing_subscriptions drop column scheduled_change;
alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_status_check
  check (status in ('trialing','active','canceling','past_due','completed','canceled','expired','unresolved','drafted','refunded','disputed')) not valid;
drop index if exists public.one_active_subscription_per_user;
create unique index one_active_subscription_per_user on public.billing_subscriptions(user_id)
  where provider='whop' and status in ('active','trialing','canceling');

alter table public.billing_payments rename column price_id to provider_plan_id;
alter table public.billing_payments add column provider text;
alter table public.billing_payments alter column provider set default 'whop';
alter table public.billing_payments alter column provider set not null;

alter table public.billing_webhook_events rename column paddle_entity_id to provider_entity_id;
alter table public.billing_webhook_events add column provider text;
alter table public.billing_webhook_events alter column provider set default 'whop';
alter table public.billing_webhook_events alter column provider set not null;
alter table public.billing_webhook_events add column processing_status text not null default 'pending' check (processing_status in ('pending','processing','processed','failed','ignored'));
alter table public.billing_webhook_events add column attempts integer not null default 0;
alter table public.billing_webhook_events add column next_attempt_at timestamptz;
alter table public.billing_webhook_events alter column processed_at drop not null;
alter table public.billing_webhook_events alter column processed_at drop default;
drop policy if exists "billing webhook events visible to owner" on public.billing_webhook_events;
revoke select on public.billing_webhook_events from authenticated;
create index billing_webhook_retry_idx on public.billing_webhook_events(processing_status,next_attempt_at,occurred_at)
  where provider='whop' and processing_status in ('pending','failed');

alter table public.billing_adjustments add column provider text;
alter table public.billing_adjustments add column previous_subscription_status text;
alter table public.billing_adjustments alter column provider set default 'whop';
alter table public.billing_adjustments alter column provider set not null;

alter table public.billing_refund_requests rename column paddle_adjustment_id to provider_refund_id;
create unique index billing_refund_provider_id_unique on public.billing_refund_requests(provider_refund_id) where provider_refund_id is not null;

alter table public.billing_operations_outbox drop constraint if exists billing_operations_outbox_operation_type_check;
update public.billing_operations_outbox set operation_type='cancel_membership' where operation_type='cancel_subscription';
alter table public.billing_operations_outbox add constraint billing_operations_outbox_operation_type_check check(operation_type in ('cancel_membership'));
alter table public.billing_operations_outbox add column next_attempt_at timestamptz;

create or replace function public.active_persona_limit_for_user(p_user_id uuid)
returns integer language sql stable set search_path=public as $$
  select coalesce(max(case plan_id
    when 'agency' then 2147483647 when 'creator' then 5 when 'solo' then 1 else 0 end),0)
  from public.billing_subscriptions
  where user_id=p_user_id and provider='whop'
    and (status in ('active','trialing') or (status='canceling' and current_period_ends_at>now()));
$$;

create or replace function public.reserve_storage_upload(p_user_id uuid,p_size_bytes bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
  if p_size_bytes<=0 or p_size_bytes>104857600 then return false; end if;
  if not exists(select 1 from public.billing_subscriptions where user_id=p_user_id and provider='whop'
    and (status in ('active','trialing') or (status='canceling' and current_period_ends_at>now()))) then return false; end if;
  insert into public.account_storage_usage(user_id,reserved_bytes) values(p_user_id,p_size_bytes)
  on conflict(user_id) do update set reserved_bytes=public.account_storage_usage.reserved_bytes+p_size_bytes,updated_at=now()
  where public.account_storage_usage.reserved_bytes+p_size_bytes<=public.account_storage_usage.quota_bytes
  returning true into allowed;
  return coalesce(allowed,false);
end; $$;

create or replace function public.consume_credits(p_user_id uuid,p_amount_cents integer,p_job_id uuid,p_description text)
returns integer language plpgsql security definer set search_path=public as $$
declare next_balance integer; already_applied integer; daily_spend integer;
begin
  select amount_cents into already_applied from public.credit_ledger where operation_key='consume:'||p_job_id::text;
  if found then select credit_balance_cents into next_balance from public.account_profiles where user_id=p_user_id; return next_balance; end if;
  select coalesce(-sum(amount_cents),0) into daily_spend from public.credit_ledger
    where user_id=p_user_id and amount_cents<0 and created_at>=date_trunc('day',now()) and operation_key like 'consume:%';
  if daily_spend+p_amount_cents>25000 then raise exception 'Daily generation budget exceeded.'; end if;
  update public.account_profiles set credit_balance_cents=credit_balance_cents-p_amount_cents,updated_at=now()
    where user_id=p_user_id and credit_debt_cents=0 and p_amount_cents>0 and credit_balance_cents>=p_amount_cents
      and exists(select 1 from public.billing_subscriptions where user_id=p_user_id and provider='whop'
        and (status in ('active','trialing') or (status='canceling' and current_period_ends_at>now())))
    returning credit_balance_cents into next_balance;
  if next_balance is null then return null; end if;
  insert into public.credit_ledger(id,user_id,job_id,amount_cents,description,operation_key)
    values(gen_random_uuid(),p_user_id,p_job_id,-p_amount_cents,p_description,'consume:'||p_job_id::text);
  return next_balance;
end; $$;

create or replace function public.apply_whop_payment_event(
  p_event_id text,p_occurred_at timestamptz,p_user_id uuid,p_checkout_intent_id uuid,p_payment_id text,
  p_membership_id text,p_provider_user_id text,p_provider_member_id text,p_membership_status text,
  p_plan_id text,p_provider_plan_id text,p_grant_amount_cents integer,p_paid_amount_minor integer,
  p_is_subscription_payment boolean,p_is_initial_checkout boolean,p_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare inserted_count integer; grant_amount integer:=0; has_active boolean; reward record;
begin
  perform 1 from public.billing_checkout_intents where id=p_checkout_intent_id and user_id=p_user_id
    and option_id=p_plan_id and provider_plan_id=p_provider_plan_id and provider='whop' for update;
  if not found then raise exception 'checkout intent mismatch'; end if;
  if p_is_initial_checkout and exists(select 1 from public.billing_checkout_intents where id=p_checkout_intent_id and expires_at<now()) then
    raise exception 'checkout intent expired';
  end if;
  if not p_is_subscription_payment then
    select exists(select 1 from public.billing_subscriptions where user_id=p_user_id and provider='whop'
      and (status in ('active','trialing') or (status='canceling' and current_period_ends_at>now()))) into has_active;
    if not has_active then raise exception 'active subscription required for top-up'; end if;
  end if;

  grant_amount:=greatest(p_grant_amount_cents,0);
  if p_is_subscription_payment and (not p_is_initial_checkout or exists(
    select 1 from public.billing_payments where provider='whop' and subscription_id=p_membership_id and granted_credit_cents>0
  )) then grant_amount:=0; end if;
  insert into public.billing_payments(transaction_id,event_id,user_id,checkout_intent_id,subscription_id,option_id,provider_plan_id,paid_amount_minor,granted_credit_cents,occurred_at,payload,provider)
    values(p_payment_id,p_event_id,p_user_id,p_checkout_intent_id,case when p_is_subscription_payment then p_membership_id else null end,p_plan_id,p_provider_plan_id,greatest(p_paid_amount_minor,0),grant_amount,p_occurred_at,coalesce(p_payload,'{}'), 'whop')
    on conflict(transaction_id) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then return false; end if;
  update public.billing_checkout_intents set consumed_at=coalesce(consumed_at,now()),status='consumed' where id=p_checkout_intent_id;
  update public.billing_webhook_events set user_id=p_user_id where event_id=p_event_id;

  insert into public.account_profiles(user_id,credit_balance_cents,provider_customer_id,account_metadata,referral_code)
    values(p_user_id,grant_amount,p_provider_user_id,'{}'::jsonb,lower(substr(md5(p_user_id::text),1,12)))
    on conflict(user_id) do update set credit_balance_cents=public.account_profiles.credit_balance_cents+grant_amount,
      provider_customer_id=coalesce(excluded.provider_customer_id,public.account_profiles.provider_customer_id),
      updated_at=now();
  if grant_amount>0 then
    insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
      values(gen_random_uuid(),p_user_id,grant_amount,case when p_is_subscription_payment then 'Whop welcome credits: '||p_plan_id else 'Whop top-up: '||p_plan_id end,'whop-grant:'||p_payment_id)
      on conflict(operation_key) do nothing;
  end if;

  if p_is_subscription_payment and coalesce(p_membership_id,'')<>'' then
    insert into public.billing_subscriptions(subscription_id,user_id,provider_user_id,provider_member_id,status,plan_id,provider_plan_id,checkout_intent_id,last_event_occurred_at,provider_updated_at,provider)
      values(p_membership_id,p_user_id,p_provider_user_id,p_provider_member_id,coalesce(nullif(p_membership_status,''),'active'),p_plan_id,p_provider_plan_id,p_checkout_intent_id,p_occurred_at,p_occurred_at,'whop')
      on conflict(subscription_id) do update set provider_user_id=excluded.provider_user_id,provider_member_id=excluded.provider_member_id,
        status=case when public.billing_subscriptions.status in ('refunded','disputed') and excluded.status in ('active','trialing','canceling') then public.billing_subscriptions.status else excluded.status end,
        plan_id=excluded.plan_id,provider_plan_id=excluded.provider_plan_id,updated_at=now();
  end if;

  if p_is_subscription_payment and grant_amount>0 then
    for reward in update public.referral_rewards set status='rewarded',rewarded_subscription_id=p_membership_id,rewarded_event_id=p_event_id,rewarded_at=now()
      where referred_user_id=p_user_id and status='pending' returning referrer_user_id,reward_amount_cents loop
      update public.account_profiles set credit_balance_cents=credit_balance_cents+reward.reward_amount_cents,updated_at=now() where user_id=reward.referrer_user_id;
      insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
        values(gen_random_uuid(),reward.referrer_user_id,reward.reward_amount_cents,'Referral reward: invited user subscribed','referral:'||p_user_id::text)
        on conflict(operation_key) do nothing;
    end loop;
  end if;
  return true;
end $$;

create or replace function public.apply_whop_membership_event(
  p_event_id text,p_user_id uuid,p_checkout_intent_id uuid,p_membership_id text,p_provider_user_id text,p_provider_member_id text,
  p_status text,p_plan_id text,p_provider_plan_id text,p_manage_url text,p_period_starts_at timestamptz,p_period_ends_at timestamptz,
  p_cancel_at_period_end boolean,p_provider_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update public.billing_webhook_events set user_id=p_user_id where event_id=p_event_id;
  insert into public.billing_subscriptions(subscription_id,user_id,provider_user_id,provider_member_id,status,plan_id,provider_plan_id,checkout_intent_id,
    manage_url,current_period_starts_at,current_period_ends_at,cancel_at_period_end,last_event_occurred_at,provider_updated_at,provider)
  values(p_membership_id,p_user_id,p_provider_user_id,p_provider_member_id,p_status,p_plan_id,p_provider_plan_id,p_checkout_intent_id,
    p_manage_url,p_period_starts_at,p_period_ends_at,p_cancel_at_period_end,p_provider_updated_at,p_provider_updated_at,'whop')
  on conflict(subscription_id) do update set provider_user_id=excluded.provider_user_id,provider_member_id=excluded.provider_member_id,
    status=case when public.billing_subscriptions.status in ('refunded','disputed') and excluded.status in ('active','trialing','canceling') then public.billing_subscriptions.status else excluded.status end,
    plan_id=excluded.plan_id,provider_plan_id=excluded.provider_plan_id,manage_url=coalesce(excluded.manage_url,public.billing_subscriptions.manage_url),
    current_period_starts_at=excluded.current_period_starts_at,current_period_ends_at=excluded.current_period_ends_at,
    cancel_at_period_end=excluded.cancel_at_period_end,last_event_occurred_at=excluded.last_event_occurred_at,
    provider_updated_at=excluded.provider_updated_at,updated_at=now()
  where public.billing_subscriptions.provider_updated_at is null or excluded.provider_updated_at>public.billing_subscriptions.provider_updated_at;
  get diagnostics changed=row_count;
  return changed>0;
end $$;

create or replace function public.apply_whop_refund_event(
  p_event_id text,p_occurred_at timestamptz,p_refund_id text,p_payment_id text,p_status text,p_refunded_amount_minor integer,p_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare payment public.billing_payments%rowtype; previous public.billing_adjustments%rowtype; target integer:=0; delta integer:=0; available integer:=0; shortfall integer:=0; reserved integer:=0; refund_user uuid;
begin
  select * into payment from public.billing_payments where transaction_id=p_payment_id and provider='whop' for update;
  if not found then raise exception 'unknown refunded payment'; end if;
  select * into previous from public.billing_adjustments where adjustment_id=p_refund_id for update;
  if found and previous.occurred_at>=p_occurred_at then return false; end if;
  insert into public.billing_adjustments(adjustment_id,transaction_id,event_id,action,adjustment_type,status,adjusted_amount_minor,occurred_at,payload,provider)
    values(p_refund_id,p_payment_id,p_event_id,'refund',case when p_refunded_amount_minor>=payment.paid_amount_minor then 'full' else 'partial' end,lower(p_status),greatest(p_refunded_amount_minor,0),p_occurred_at,p_payload,'whop')
    on conflict(adjustment_id) do update set event_id=excluded.event_id,status=excluded.status,adjustment_type=excluded.adjustment_type,
      adjusted_amount_minor=excluded.adjusted_amount_minor,occurred_at=excluded.occurred_at,payload=excluded.payload,updated_at=now();
  update public.billing_webhook_events set user_id=payment.user_id where event_id=p_event_id;

  if lower(p_status) in ('failed','canceled') then
    select reserved_credit_cents,user_id into reserved,refund_user from public.billing_refund_requests
      where transaction_id=p_payment_id and status in ('pending','submitted') for update;
    update public.billing_refund_requests set status='failed',failure_message='Whop refund '||p_status,reserved_credit_cents=0,provider_refund_id=p_refund_id
      where transaction_id=p_payment_id and status in ('pending','submitted');
    if refund_user is not null and reserved>0 then update public.account_profiles set credit_balance_cents=credit_balance_cents+reserved,updated_at=now() where user_id=refund_user; end if;
    return true;
  end if;
  update public.billing_refund_requests set provider_refund_id=p_refund_id,status=case when lower(p_status)='succeeded' then 'approved' else 'submitted' end
    where transaction_id=p_payment_id and status in ('pending','submitted');
  if lower(p_status)<>'succeeded' then return true; end if;

  target:=case when payment.paid_amount_minor>0 then least(payment.granted_credit_cents,ceil(payment.granted_credit_cents::numeric*greatest(p_refunded_amount_minor,0)/payment.paid_amount_minor)::integer) else payment.granted_credit_cents end;
  delta:=greatest(0,target-coalesce(previous.reversed_credit_cents,0));
  select coalesce(reserved_credit_cents,0) into reserved from public.billing_refund_requests where transaction_id=p_payment_id for update;
  if reserved=0 and delta>0 then
    select credit_balance_cents into available from public.account_profiles where user_id=payment.user_id for update;
    shortfall:=greatest(0,delta-available);
    update public.account_profiles set credit_balance_cents=greatest(0,credit_balance_cents-delta),credit_debt_cents=credit_debt_cents+shortfall,updated_at=now() where user_id=payment.user_id;
  end if;
  if delta>0 then insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
    values(gen_random_uuid(),payment.user_id,-delta,'Whop refund credit reversal: '||p_refund_id,'whop-refund:'||p_refund_id||':'||target) on conflict(operation_key) do nothing; end if;
  update public.billing_payments set reversed_credit_cents=reversed_credit_cents+delta where transaction_id=p_payment_id;
  update public.billing_adjustments set reversed_credit_cents=target where adjustment_id=p_refund_id;
  update public.billing_refund_requests set status='approved',reserved_credit_cents=0,provider_refund_id=p_refund_id where transaction_id=p_payment_id;
  if payment.subscription_id is not null and p_refunded_amount_minor>=payment.paid_amount_minor then
    update public.billing_subscriptions set status='refunded',updated_at=now() where subscription_id=payment.subscription_id;
    insert into public.billing_operations_outbox(operation_key,operation_type,subscription_id)
      values('cancel-refunded-membership:'||payment.subscription_id,'cancel_membership',payment.subscription_id) on conflict(operation_key) do nothing;
  end if;
  return true;
end $$;

create or replace function public.apply_whop_dispute_event(
  p_event_id text,p_occurred_at timestamptz,p_dispute_id text,p_payment_id text,p_status text,p_disputed_amount_minor integer,p_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare payment public.billing_payments%rowtype; previous public.billing_adjustments%rowtype; target integer:=0; delta integer:=0; available integer:=0; shortfall integer:=0; prior_status text;
begin
  select * into payment from public.billing_payments where transaction_id=p_payment_id and provider='whop' for update;
  if not found then raise exception 'unknown disputed payment'; end if;
  select status into prior_status from public.billing_subscriptions where subscription_id=payment.subscription_id for update;
  select * into previous from public.billing_adjustments where adjustment_id=p_dispute_id for update;
  if found and previous.occurred_at>=p_occurred_at then return false; end if;
  insert into public.billing_adjustments(adjustment_id,transaction_id,event_id,action,adjustment_type,status,adjusted_amount_minor,occurred_at,payload,provider,previous_subscription_status)
    values(p_dispute_id,p_payment_id,p_event_id,'dispute','chargeback',lower(p_status),greatest(p_disputed_amount_minor,0),p_occurred_at,p_payload,'whop',prior_status)
    on conflict(adjustment_id) do update set event_id=excluded.event_id,status=excluded.status,adjusted_amount_minor=excluded.adjusted_amount_minor,
      occurred_at=excluded.occurred_at,payload=excluded.payload,
      previous_subscription_status=coalesce(public.billing_adjustments.previous_subscription_status,excluded.previous_subscription_status),updated_at=now();
  update public.billing_webhook_events set user_id=payment.user_id where event_id=p_event_id;

  if lower(p_status) in ('won','warning_closed') then
    target:=coalesce(previous.reversed_credit_cents,0);
    if target>0 then
      update public.account_profiles set credit_debt_cents=greatest(0,credit_debt_cents-target),credit_balance_cents=credit_balance_cents+greatest(0,target-credit_debt_cents),updated_at=now() where user_id=payment.user_id;
      update public.billing_payments set reversed_credit_cents=greatest(0,reversed_credit_cents-target) where transaction_id=p_payment_id;
      insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
        values(gen_random_uuid(),payment.user_id,target,'Whop dispute reversal: '||p_dispute_id,'whop-dispute-won:'||p_dispute_id) on conflict(operation_key) do nothing;
    end if;
    update public.billing_adjustments set reversed_credit_cents=0 where adjustment_id=p_dispute_id;
    update public.billing_subscriptions set status=coalesce(previous.previous_subscription_status,prior_status,'active'),updated_at=now()
      where subscription_id=payment.subscription_id and status='disputed';
    return true;
  end if;

  target:=case when payment.paid_amount_minor>0 then least(payment.granted_credit_cents,ceil(payment.granted_credit_cents::numeric*greatest(p_disputed_amount_minor,0)/payment.paid_amount_minor)::integer) else payment.granted_credit_cents end;
  delta:=greatest(0,target-coalesce(previous.reversed_credit_cents,0));
  if delta>0 then
    select credit_balance_cents into available from public.account_profiles where user_id=payment.user_id for update;
    shortfall:=greatest(0,delta-available);
    update public.account_profiles set credit_balance_cents=greatest(0,credit_balance_cents-delta),credit_debt_cents=credit_debt_cents+shortfall,updated_at=now() where user_id=payment.user_id;
    update public.billing_payments set reversed_credit_cents=reversed_credit_cents+delta where transaction_id=p_payment_id;
    insert into public.credit_ledger(id,user_id,amount_cents,description,operation_key)
      values(gen_random_uuid(),payment.user_id,-delta,'Whop dispute credit reversal: '||p_dispute_id,'whop-dispute:'||p_dispute_id||':'||target) on conflict(operation_key) do nothing;
  end if;
  update public.billing_adjustments set reversed_credit_cents=target where adjustment_id=p_dispute_id;
  update public.billing_subscriptions set status='disputed',updated_at=now() where subscription_id=payment.subscription_id;
  return true;
end $$;

create or replace function public.claim_whop_billing_events(p_limit integer default 20)
returns setof public.billing_webhook_events language sql security definer set search_path=public as $$
  update public.billing_webhook_events set processing_status='processing',attempts=attempts+1
  where event_id in (
    select event_id from public.billing_webhook_events where provider='whop' and processing_status in ('pending','failed')
      and (next_attempt_at is null or next_attempt_at<=now()) order by occurred_at for update skip locked limit greatest(1,least(p_limit,100))
  ) returning *;
$$;

revoke execute on function public.apply_whop_payment_event(text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,integer,integer,boolean,boolean,jsonb) from public,anon,authenticated;
revoke execute on function public.apply_whop_membership_event(text,uuid,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
revoke execute on function public.apply_whop_refund_event(text,timestamptz,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.apply_whop_dispute_event(text,timestamptz,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.claim_whop_billing_events(integer) from public,anon,authenticated;
grant execute on function public.apply_whop_payment_event(text,timestamptz,uuid,uuid,text,text,text,text,text,text,text,integer,integer,boolean,boolean,jsonb) to service_role;
grant execute on function public.apply_whop_membership_event(text,uuid,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;
grant execute on function public.apply_whop_refund_event(text,timestamptz,text,text,text,integer,jsonb) to service_role;
grant execute on function public.apply_whop_dispute_event(text,timestamptz,text,text,text,integer,jsonb) to service_role;
grant execute on function public.claim_whop_billing_events(integer) to service_role;
