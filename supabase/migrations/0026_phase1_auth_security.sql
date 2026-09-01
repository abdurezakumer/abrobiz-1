-- ============================================================================
-- 0026_phase1_auth_security.sql
-- Supabase Auth-authoritative verification and legal-consent gates.
-- ============================================================================

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists legal_version text;

-- A previous app-only verification link must not satisfy the new Auth gate.
update public.profiles p
set email_verified_at = null
where exists (
  select 1 from auth.users u
  where u.id = p.id
    and coalesce(u.raw_app_meta_data ->> 'provider', 'email') <> 'google'
    and u.email_confirmed_at is null
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, phone, email, email_verified_at,
    terms_accepted_at, privacy_accepted_at, legal_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    new.email,
    case when new.raw_app_meta_data ->> 'provider' = 'google' then coalesce(new.email_confirmed_at, now()) else null end,
    null,
    null,
    null
  );
  return new;
end;
$$;

create or replace function public.sync_auth_email_verification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('app.auth_verification_sync', 'on', true);
  update public.profiles
  set email_verified_at = case
    when new.email_confirmed_at is not null then coalesce(new.email_confirmed_at, now())
    else null
  end,
  email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists auth_user_email_verification_sync on auth.users;
create trigger auth_user_email_verification_sync
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.sync_auth_email_verification();

-- Direct profile updates cannot forge or remove consent. The RPC below is the
-- only authenticated application path that may record the current legal
-- version and timestamps.
create or replace function public.prevent_legal_self_edit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() = old.id
     and current_setting('app.auth_verification_sync', true) is distinct from 'on'
     and (
       new.email_verified_at is distinct from old.email_verified_at
       or new.email is distinct from old.email
     ) then
    raise exception 'Auth-managed profile fields cannot be edited directly';
  end if;
  if auth.uid() = old.id
     and current_setting('app.legal_acceptance', true) is distinct from 'on'
     and (
       new.terms_accepted_at is distinct from old.terms_accepted_at
       or new.privacy_accepted_at is distinct from old.privacy_accepted_at
       or new.legal_version is distinct from old.legal_version
     ) then
    raise exception 'Legal acceptance must be recorded through the acceptance flow';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_legal_self_edit on public.profiles;
create trigger profiles_prevent_legal_self_edit
  before update on public.profiles
  for each row execute function public.prevent_legal_self_edit();

create or replace function public.record_legal_acceptance(
  p_terms_accepted boolean,
  p_privacy_accepted boolean,
  p_legal_version text default '2026-01'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_terms_accepted is not true or p_privacy_accepted is not true then
    raise exception 'Both legal documents must be accepted'; end if;
  if p_legal_version is distinct from '2026-01' then
    raise exception 'Unsupported legal version'; end if;

  perform set_config('app.legal_acceptance', 'on', true);
  update public.profiles
  set terms_accepted_at = now(), privacy_accepted_at = now(), legal_version = p_legal_version
  where id = auth.uid();
  return found;
end;
$$;

revoke all on function public.record_legal_acceptance(boolean, boolean, text) from public, anon;
grant execute on function public.record_legal_acceptance(boolean, boolean, text) to authenticated;

-- Business creation is enforced at the database boundary, not only by UI.
create or replace function public.require_verified_legal_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.role() = 'service_role' then return new; end if;
  if auth.uid() is null or new.owner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.email_verified_at is null then raise exception 'Email verification is required'; end if;
  if v_profile.terms_accepted_at is null or v_profile.privacy_accepted_at is null or v_profile.legal_version is null then
    raise exception 'Legal acceptance is required'; end if;
  return new;
end;
$$;

drop trigger if exists businesses_require_verified_legal_owner on public.businesses;
create trigger businesses_require_verified_legal_owner
  before insert on public.businesses
  for each row execute function public.require_verified_legal_owner();

-- The old custom link functions remain in migration history but no longer
-- satisfy or issue client-callable verification proofs.
revoke all on function public.create_email_verification_token() from public, anon, authenticated;
revoke all on function public.verify_email_token(text) from public, anon, authenticated;
