create or replace function public.set_account_profile_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code = lower(substr(md5(new.user_id::text), 1, 12));
  else
    new.referral_code = lower(btrim(new.referral_code));
  end if;

  return new;
end;
$$;

drop trigger if exists set_account_profile_referral_code on public.account_profiles;
create trigger set_account_profile_referral_code
  before insert on public.account_profiles
  for each row execute function public.set_account_profile_referral_code();
