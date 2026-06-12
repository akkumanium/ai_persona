alter type public.asset_kind add value if not exists 'audio';

alter type public.generation_type add value if not exists 'speech_text';
alter type public.generation_type add value if not exists 'avatar_talking';

alter type public.provider_name add value if not exists 'wavespeed';
alter type public.provider_name add value if not exists 'elevenlabs';

insert into storage.buckets (id, name, public)
values ('generated-audio', 'generated-audio', false)
on conflict (id) do nothing;

drop policy if exists "users can read own upload objects" on storage.objects;
drop policy if exists "users can insert own upload objects" on storage.objects;
drop policy if exists "users can update own storage objects" on storage.objects;
drop policy if exists "users can delete own storage objects" on storage.objects;

create policy "users can read own upload objects" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'generated-audio', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can insert own upload objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'generated-audio', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can update own storage objects" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'generated-audio', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'generated-audio', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can delete own storage objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('uploads', 'generated-images', 'generated-videos', 'generated-audio', 'provider-temp')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
