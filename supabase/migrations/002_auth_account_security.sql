create table if not exists public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text not null default '',
  credit_balance_cents integer not null default 0 check (credit_balance_cents >= 0),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  billing_customer_id text,
  account_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_profiles enable row level security;

revoke all on public.account_profiles from anon, authenticated;
grant select on public.account_profiles to authenticated;
grant update (display_name, avatar_url) on public.account_profiles to authenticated;

drop policy if exists "account profiles are visible to owner" on public.account_profiles;
create policy "account profiles are visible to owner" on public.account_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "account profiles editable by owner" on public.account_profiles;
create policy "account profiles editable by owner" on public.account_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_account_profiles_updated_at on public.account_profiles;
create trigger set_account_profiles_updated_at
  before update on public.account_profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.assets
  add column if not exists is_default_reference boolean not null default false,
  add column if not exists reference_slot text check (reference_slot in ('face', 'face-grid', 'body', 'more'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_storage_path_scoped_to_user'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_storage_path_scoped_to_user
      check (
        storage_path is null
        or storage_path = ''
        or storage_path like user_id::text || '/%'
      );
  end if;
end;
$$;

create index if not exists personas_user_created_idx on public.personas (user_id, created_at desc);
create index if not exists assets_user_created_idx on public.assets (user_id, created_at desc);
create index if not exists jobs_user_created_idx on public.generation_jobs (user_id, created_at desc);
create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

drop policy if exists "users can read own upload objects" on storage.objects;
drop policy if exists "users can insert own upload objects" on storage.objects;
drop policy if exists "users can update own storage objects" on storage.objects;
drop policy if exists "users can delete own storage objects" on storage.objects;

create policy "users can read own upload objects" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can insert own upload objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can update own storage objects" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can delete own storage objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
