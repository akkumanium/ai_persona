grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.personas to authenticated, service_role;
grant select, insert, update, delete on table public.assets to authenticated, service_role;
grant select, insert, update, delete on table public.generation_jobs to authenticated, service_role;
grant select, insert, update, delete on table public.provider_configs to authenticated, service_role;

grant select on table public.credit_ledger to authenticated, service_role;
grant insert on table public.credit_ledger to service_role;

grant select on table public.account_profiles to authenticated, service_role;
grant update (display_name, avatar_url) on table public.account_profiles to authenticated;
grant insert, update, delete on table public.account_profiles to service_role;

grant select on table public.billing_subscriptions to authenticated, service_role;
grant insert, update, delete on table public.billing_subscriptions to service_role;

grant select on table public.billing_webhook_events to authenticated, service_role;
grant insert, update, delete on table public.billing_webhook_events to service_role;

grant insert on table public.contact_messages to anon, authenticated;
grant select, insert, update, delete on table public.contact_messages to service_role;

revoke execute on function public.consume_credits(uuid, integer, uuid, text) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer, uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_paddle_billing_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb
) from public, anon, authenticated;

grant execute on function public.consume_credits(uuid, integer, uuid, text) to service_role;
grant execute on function public.refund_credits(uuid, integer, uuid, text) to service_role;
grant execute on function public.apply_paddle_billing_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb
) to service_role;
