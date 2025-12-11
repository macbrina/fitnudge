-- Enable RLS and add policies for sensitive token tables

alter table password_reset_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'password_reset_tokens'
      and policyname = 'password_reset_tokens_service_all'
  ) then
    create policy password_reset_tokens_service_all
      on password_reset_tokens
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

alter table email_verification_codes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'email_verification_codes'
      and policyname = 'email_verification_codes_service_all'
  ) then
    create policy email_verification_codes_service_all
      on email_verification_codes
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;


