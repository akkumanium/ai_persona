create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount_cents integer,
  p_job_id uuid,
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance integer;
begin
  if coalesce(p_amount_cents, 0) <= 0 then
    select credit_balance_cents
      into next_balance
      from public.account_profiles
     where user_id = p_user_id;
    return coalesce(next_balance, 0);
  end if;

  update public.account_profiles
     set credit_balance_cents = credit_balance_cents - p_amount_cents,
         updated_at = now()
   where user_id = p_user_id
     and credit_balance_cents >= p_amount_cents
  returning credit_balance_cents into next_balance;

  if next_balance is null then
    return null;
  end if;

  insert into public.credit_ledger (
    id,
    user_id,
    job_id,
    amount_cents,
    description
  )
  values (
    gen_random_uuid(),
    p_user_id,
    p_job_id,
    -p_amount_cents,
    p_description
  );

  return next_balance;
end;
$$;

create or replace function public.refund_credits(
  p_user_id uuid,
  p_amount_cents integer,
  p_job_id uuid,
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance integer;
begin
  update public.account_profiles
     set credit_balance_cents = credit_balance_cents + greatest(coalesce(p_amount_cents, 0), 0),
         updated_at = now()
   where user_id = p_user_id
  returning credit_balance_cents into next_balance;

  if next_balance is null then
    return null;
  end if;

  if greatest(coalesce(p_amount_cents, 0), 0) > 0 then
    insert into public.credit_ledger (
      id,
      user_id,
      job_id,
      amount_cents,
      description
    )
    values (
      gen_random_uuid(),
      p_user_id,
      p_job_id,
      greatest(coalesce(p_amount_cents, 0), 0),
      p_description
    );
  end if;

  return next_balance;
end;
$$;
