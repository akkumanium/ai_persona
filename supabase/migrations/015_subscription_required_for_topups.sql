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
  grant_amount integer := normalized_amount;
  has_active_subscription boolean;
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

  if not p_is_subscription_payment then
    select exists (
      select 1
      from public.billing_subscriptions
      where user_id = p_user_id
        and status in ('active', 'trialing')
    ) into has_active_subscription;

    if not has_active_subscription then
      grant_amount := 0;
    end if;
  end if;

  if p_is_subscription_payment and (
    exists (
      select 1
      from public.credit_ledger
      where user_id = p_user_id
        and description like 'Paddle subscription top-up:%'
    )
    or (
      coalesce(p_subscription_id, '') <> ''
      and exists (
        select 1
        from public.credit_ledger
        where user_id = p_user_id
          and description like 'Paddle welcome credits:%'
          and description like '%' || p_subscription_id || '%'
      )
    )
    or (
      coalesce(p_subscription_id, '') = ''
      and exists (
        select 1
        from public.credit_ledger
        where user_id = p_user_id
          and description like 'Paddle welcome credits:%'
      )
    )
  ) then
    grant_amount := 0;
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
    grant_amount,
    p_paddle_customer_id,
    paddle_metadata,
    lower(substr(md5(p_user_id::text), 1, 12))
  )
  on conflict (user_id) do update
  set
    credit_balance_cents = public.account_profiles.credit_balance_cents + grant_amount,
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

  if grant_amount > 0 then
    insert into public.credit_ledger (
      id,
      user_id,
      amount_cents,
      description
    )
    values (
      gen_random_uuid(),
      p_user_id,
      grant_amount,
      case
        when p_is_subscription_payment then 'Paddle welcome credits: ' || p_plan_id || coalesce(' / subscription ' || nullif(p_subscription_id, ''), '')
        else 'Paddle top-up: ' || p_plan_id
      end
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

revoke execute on function public.apply_paddle_billing_event(
  text, text, uuid, text, text, text, text, text, text, integer, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.apply_paddle_billing_event(
  text, text, uuid, text, text, text, text, text, text, integer, jsonb, boolean
) to service_role;
