-- Keep the database constraint aligned with the reference slots accepted by the
-- application. Migration 002 predates the chest-up slot.
alter table public.assets
  drop constraint if exists assets_reference_slot_check;

alter table public.assets
  add constraint assets_reference_slot_check
  check (reference_slot in ('face', 'chest-up', 'face-grid', 'body', 'more'));
