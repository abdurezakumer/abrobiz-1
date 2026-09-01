-- ============================================================================
-- 0031_legal_acceptance_reliability.sql
-- Make the authenticated legal-consent flow recover profiles for legacy Auth
-- accounts whose profile trigger did not create a row.
-- ============================================================================

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists legal_version text;

create or replace function public.record_legal_acceptance(
  p_terms_accepted boolean,
  p_privacy_accepted boolean,
  p_legal_version text default '2026-01'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user auth.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_terms_accepted is not true or p_privacy_accepted is not true then
    raise exception 'Both legal documents must be accepted';
  end if;
  if p_legal_version is distinct from '2026-01' then
    raise exception 'Unsupported legal version';
  end if;

  -- A small number of legacy Auth users can exist without their profile row
  -- after an interrupted trigger/migration rollout. Recreate only that user's
  -- owner profile from auth.users; never accept an arbitrary profile id.
  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'Authenticated user was not found';
  end if;

  insert into public.profiles (id, name, phone, email, email_verified_at)
  values (
    v_user.id,
    coalesce(v_user.raw_user_meta_data ->> 'name', v_user.raw_user_meta_data ->> 'full_name', ''),
    coalesce(v_user.raw_user_meta_data ->> 'phone', ''),
    v_user.email,
    case when v_user.raw_app_meta_data ->> 'provider' = 'google'
      then coalesce(v_user.email_confirmed_at, now())
      else null
    end
  )
  on conflict (id) do nothing;

  perform set_config('app.legal_acceptance', 'on', true);
  update public.profiles
  set terms_accepted_at = now(),
      privacy_accepted_at = now(),
      legal_version = p_legal_version
  where id = auth.uid();

  if not found then
    raise exception 'Legal acceptance profile could not be saved';
  end if;
  return true;
end;
$$;

revoke all on function public.record_legal_acceptance(boolean, boolean, text) from public, anon;
grant execute on function public.record_legal_acceptance(boolean, boolean, text) to authenticated;
