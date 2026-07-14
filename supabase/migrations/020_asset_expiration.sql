-- Non-reference assets are temporary. Persona reference-slot files remain durable.
alter table public.assets
  add column if not exists expires_at timestamptz;

update public.assets asset
set expires_at = case
  when asset.reference_slot is not null
    or asset.is_default_reference
    or exists (select 1 from public.personas persona where persona.reference_asset_id = asset.id)
    then null
  else asset.created_at + interval '7 days'
end;

create index if not exists assets_expires_at_idx
  on public.assets(expires_at)
  where expires_at is not null;

create or replace function public.set_asset_expiration()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference_slot is not null or new.is_default_reference then
    new.expires_at := null;
  elsif tg_op = 'INSERT' then
    new.expires_at := new.created_at + interval '7 days';
  elsif old.reference_slot is not null or old.is_default_reference then
    new.expires_at := now() + interval '7 days';
  else
    new.expires_at := coalesce(old.expires_at, new.created_at + interval '7 days');
  end if;
  return new;
end;
$$;

drop trigger if exists set_asset_expiration_before_write on public.assets;
create trigger set_asset_expiration_before_write
before insert or update of reference_slot, is_default_reference, expires_at on public.assets
for each row execute function public.set_asset_expiration();

-- Storage objects are removed by the scheduled server cleanup first. This RPC then
-- removes their database records and stale denormalized ID references atomically.
create or replace function public.delete_expired_assets(p_asset_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids uuid[];
  deleted_count integer := 0;
begin
  select coalesce(array_agg(asset.id), '{}'::uuid[])
  into expired_ids
  from public.assets asset
  where asset.id = any(coalesce(p_asset_ids, '{}'::uuid[]))
    and asset.expires_at <= now()
    and asset.reference_slot is null
    and not asset.is_default_reference
    and not exists (select 1 from public.personas persona where persona.reference_asset_id = asset.id);

  if cardinality(expired_ids) = 0 then
    return 0;
  end if;

  update public.assets asset
  set reference_asset_ids = array(
    select reference_id
    from unnest(asset.reference_asset_ids) reference_id
    where not (reference_id = any(expired_ids))
  )
  where asset.reference_asset_ids && expired_ids;

  update public.generation_jobs job
  set output_asset_ids = array(
    select output_id
    from unnest(job.output_asset_ids) output_id
    where not (output_id = any(expired_ids))
  )
  where job.output_asset_ids && expired_ids;

  delete from public.assets where id = any(expired_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.delete_expired_assets(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_expired_assets(uuid[]) to service_role;

comment on column public.assets.expires_at is
  'Automatic deletion time for temporary assets. NULL means the asset is a retained persona reference.';
