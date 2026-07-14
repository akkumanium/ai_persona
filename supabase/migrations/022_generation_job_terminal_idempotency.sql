-- Webhooks and fallback polls can race. Once a generation reaches either terminal
-- state, it must never be finalized again by a duplicate/out-of-order delivery.
create or replace function public.finalize_generation_job(p_user_id uuid, p_job jsonb, p_assets jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare asset jsonb; job_id uuid := (p_job->>'id')::uuid;
begin
  perform 1 from public.generation_jobs where id=job_id and user_id=p_user_id and status in ('queued','running') for update;
  if not found then
    return exists(select 1 from public.generation_jobs where id=job_id and user_id=p_user_id and status in ('succeeded','failed'));
  end if;
  for asset in select value from jsonb_array_elements(coalesce(p_assets,'[]'::jsonb)) loop
    if (asset->>'user_id')::uuid <> p_user_id then raise exception 'asset owner mismatch'; end if;
    insert into public.assets(id,user_id,persona_id,kind,storage_bucket,storage_path,public_url,title,prompt,reference_asset_ids,reference_slot,is_default_reference,generation_type,provider,provider_job_id,model,mime_type,provider_asset_id,created_at)
    values((asset->>'id')::uuid,p_user_id,nullif(asset->>'persona_id','')::uuid,(asset->>'kind')::public.asset_kind,nullif(asset->>'storage_bucket',''),nullif(asset->>'storage_path',''),nullif(asset->>'public_url',''),asset->>'title',coalesce(asset->>'prompt',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(asset->'reference_asset_ids','[]'::jsonb))::uuid),'{}'::uuid[]),nullif(asset->>'reference_slot',''),coalesce((asset->>'is_default_reference')::boolean,false),(asset->>'generation_type')::public.generation_type,(asset->>'provider')::public.provider_name,nullif(asset->>'provider_job_id',''),asset->>'model',asset->>'mime_type',nullif(asset->>'provider_asset_id',''),(asset->>'created_at')::timestamptz)
    on conflict(id) do nothing;
  end loop;
  update public.generation_jobs set status=(p_job->>'status')::public.job_status,provider=(p_job->>'provider')::public.provider_name,provider_job_id=nullif(p_job->>'provider_job_id',''),model=p_job->>'model',
    generation_type=(p_job->>'generation_type')::public.generation_type,input_params=coalesce(p_job->'input_params','{}'::jsonb),output_asset_ids=coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'output_asset_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
    cost_estimate_cents=coalesce((p_job->>'cost_estimate_cents')::integer,0),raw_provider_response=p_job->'raw_provider_response',error_message=nullif(p_job->>'error_message',''),updated_at=(p_job->>'updated_at')::timestamptz
    where id=job_id and user_id=p_user_id;
  insert into public.generation_job_assets(job_id,asset_id)
    select (p_job->>'id')::uuid,jsonb_array_elements_text(coalesce(p_job->'output_asset_ids','[]'::jsonb))::uuid on conflict do nothing;
  return true;
end; $$;

revoke execute on function public.finalize_generation_job(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_generation_job(uuid,jsonb,jsonb) to service_role;
