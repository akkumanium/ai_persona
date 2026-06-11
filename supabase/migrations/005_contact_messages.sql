create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or char_length(email) <= 240),
  message text not null check (char_length(message) between 10 and 4000),
  user_agent text,
  page_url text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

drop policy if exists "anyone can send contact messages" on public.contact_messages;
create policy "anyone can send contact messages" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);
