create table if not exists public.media_upload_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null check (storage_bucket = 'uploads'),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  status text not null default 'pending' check (status in ('pending', 'cleaning')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);

create index if not exists media_upload_intents_pending_idx
  on public.media_upload_intents (user_id, expires_at)
  where status = 'pending';

alter table public.media_upload_intents enable row level security;
revoke all on public.media_upload_intents from public, anon, authenticated;
grant select, insert, update, delete on public.media_upload_intents to service_role;
