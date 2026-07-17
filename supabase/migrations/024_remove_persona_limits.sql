-- Personas are no longer quota-limited by subscription. Remove the legacy
-- trigger so inserts are never rejected because of a plan-specific cap.
drop trigger if exists enforce_persona_subscription_limit on public.personas;
drop function if exists public.enforce_persona_subscription_limit();
drop function if exists public.active_persona_limit_for_user(uuid);
