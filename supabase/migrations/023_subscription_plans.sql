-- The public catalog now has monthly and yearly plans with unlimited personas. Legacy plan
-- limits remain here so existing subscriptions keep working during the cutover.
create or replace function public.active_persona_limit_for_user(p_user_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    max(case plan_id
      when 'monthly' then 2147483647
      when 'yearly' then 2147483647
      when 'agency' then 2147483647
      when 'creator' then 5
      when 'solo' then 1
      else 0
    end),
    0
  )
  from public.billing_subscriptions
  where user_id = p_user_id
    and provider = 'whop'
    and (
      status in ('active', 'trialing')
      or (status = 'canceling' and current_period_ends_at > now())
    );
$$;

revoke execute on function public.active_persona_limit_for_user(uuid) from public, anon, authenticated;
grant execute on function public.active_persona_limit_for_user(uuid) to service_role;
