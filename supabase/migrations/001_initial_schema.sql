create extension if not exists pgcrypto;

create type public.asset_kind as enum ('avatar', 'image', 'video', 'upload');
create type public.generation_type as enum (
  'avatar_prompt',
  'avatar_image_blend',
  'avatar_normalization',
  'image_from_reference',
  'video_normal',
  'video_motion'
);
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');
create type public.provider_name as enum ('nano-banana-pro', 'wan', 'demo');

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  style_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  reference_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  kind public.asset_kind not null,
  storage_bucket text,
  storage_path text,
  public_url text,
  title text not null,
  prompt text not null default '',
  generation_type public.generation_type not null,
  provider public.provider_name not null,
  model text not null,
  mime_type text not null,
  provider_asset_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.personas
  add constraint personas_reference_asset_id_fkey
  foreign key (reference_asset_id) references public.assets(id) on delete set null;

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  status public.job_status not null default 'queued',
  provider public.provider_name not null,
  model text not null,
  generation_type public.generation_type not null,
  input_params jsonb not null default '{}'::jsonb,
  output_asset_ids uuid[] not null default '{}',
  cost_estimate_cents integer not null default 0,
  raw_provider_response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.provider_name not null,
  encrypted_key_reference text,
  enabled_models text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.generation_jobs(id) on delete set null,
  amount_cents integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values
  ('uploads', 'uploads', false),
  ('generated-images', 'generated-images', false),
  ('generated-videos', 'generated-videos', false),
  ('provider-temp', 'provider-temp', false)
on conflict (id) do nothing;

alter table public.personas enable row level security;
alter table public.assets enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.provider_configs enable row level security;
alter table public.credit_ledger enable row level security;

create policy "personas owned by user" on public.personas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assets owned by user" on public.assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "jobs owned by user" on public.generation_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "provider configs owned by user" on public.provider_configs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "credit ledger owned by user" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "users can read own upload objects" on storage.objects
  for select using (bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp') and owner = auth.uid());

create policy "users can insert own upload objects" on storage.objects
  for insert with check (bucket_id in ('uploads', 'generated-images', 'generated-videos', 'provider-temp') and owner = auth.uid());
