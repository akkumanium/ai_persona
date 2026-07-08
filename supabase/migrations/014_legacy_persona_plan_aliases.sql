create or replace function public.active_persona_limit_for_user(p_user_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    max(case plan_id
      when 'agency' then 2147483647
      when 'pro' then 2147483647
      when 'creator' then 5
      when 'plus' then 5
      when 'solo' then 1
      when 'starter' then 1
      else 0
    end),
    0
  )
  from public.billing_subscriptions
  where user_id = p_user_id
    and status in ('active', 'trialing');
$$;

revoke execute on function public.active_persona_limit_for_user(uuid) from public, anon, authenticated;
grant execute on function public.active_persona_limit_for_user(uuid) to service_role;
