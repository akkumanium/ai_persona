alter table public.billing_refund_requests
  drop constraint if exists billing_refund_requests_status_check;

alter table public.billing_refund_requests
  add constraint billing_refund_requests_status_check
  check (status in ('pending', 'submitted', 'approved', 'failed', 'rejected'));

create or replace function public.assert_persona_reference_asset_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference_asset_id is not null and not exists (
    select 1
      from public.assets
     where id = new.reference_asset_id
       and user_id = new.user_id
  ) then
    raise exception 'reference_asset_id must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists assert_persona_reference_asset_owner on public.personas;
create trigger assert_persona_reference_asset_owner
  before insert or update of user_id, reference_asset_id on public.personas
  for each row execute function public.assert_persona_reference_asset_owner();

create or replace function public.assert_asset_owner_references()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  reference_count integer;
begin
  if new.persona_id is not null and not exists (
    select 1
      from public.personas
     where id = new.persona_id
       and user_id = new.user_id
  ) then
    raise exception 'persona_id must belong to the same user';
  end if;

  if coalesce(array_length(new.reference_asset_ids, 1), 0) > 0 then
    select count(*)
      into reference_count
      from public.assets
     where user_id = new.user_id
       and id = any(new.reference_asset_ids);

    if reference_count <> coalesce(array_length(new.reference_asset_ids, 1), 0) then
      raise exception 'reference_asset_ids must belong to the same user';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assert_asset_owner_references on public.assets;
create trigger assert_asset_owner_references
  before insert or update of user_id, persona_id, reference_asset_ids on public.assets
  for each row execute function public.assert_asset_owner_references();

create or replace function public.assert_generation_job_persona_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.persona_id is not null and not exists (
    select 1
      from public.personas
     where id = new.persona_id
       and user_id = new.user_id
  ) then
    raise exception 'persona_id must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists assert_generation_job_persona_owner on public.generation_jobs;
create trigger assert_generation_job_persona_owner
  before insert or update of user_id, persona_id on public.generation_jobs
  for each row execute function public.assert_generation_job_persona_owner();
