-- ============================================================================
-- 0015_password_reset.sql
-- Replaces Supabase's built-in resetPasswordForEmail() with a custom flow
-- that sends through this app's own mailer, matching the verification email.
--
-- Needs profiles.email (not stored before now — the app always read it live
-- from the session) because looking up "which user owns this email" for an
-- anonymous password-reset request needs a plain, RLS-bypassable table
-- lookup, and going through Supabase's admin API or cross-schema auth.users
-- access from an Edge Function is less predictable to get right than a
-- column this app fully controls.
--
-- The actual password change can't happen in SQL — Supabase Auth manages
-- password hashes internally via its Admin API, which requires the service
-- role and therefore has to run in an Edge Function
-- (supabase/functions/reset-password/), not a Postgres RPC. This migration
-- only covers token issuance and validation.
-- ============================================================================

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, email, email_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    new.email,
    case when new.raw_app_meta_data ->> 'provider' = 'google' then now() else null end
  );
  return new;
end;
$$;

create table public.password_reset_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index password_reset_tokens_user_id_idx on public.password_reset_tokens (user_id);

-- RLS enabled with zero client-facing policies, same pattern as
-- email_verification_tokens — every interaction goes through the RPCs
-- below or the Edge Function's service-role client.
alter table public.password_reset_tokens enable row level security;

-- Called (anonymously — the person is locked out, by definition) with an
-- email address. Always returns without error whether or not that email
-- matches an account, and the token itself is only ever handed to the
-- server-side caller (the Edge Function), never echoed back to the
-- original HTTP request — both are deliberate, to prevent using this to
-- discover which emails have accounts.
create function public.request_password_reset(p_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_token text;
begin
  select id, name into v_user_id, v_name from public.profiles where lower(email) = lower(p_email);
  if v_user_id is null then
    return null;
  end if;

  delete from public.password_reset_tokens where user_id = v_user_id and used_at is null;

  insert into public.password_reset_tokens (user_id) values (v_user_id)
  returning token into v_token;

  return jsonb_build_object('token', v_token, 'name', v_name);
end;
$$;

-- Validates a token without consuming it — the Edge Function only marks it
-- used after the password change itself actually succeeds, so a transient
-- failure doesn't burn the user's only link.
create function public.check_password_reset_token(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.password_reset_tokens;
begin
  select * into v_row from public.password_reset_tokens where token = p_token;

  if v_row.id is null then
    raise exception 'Invalid or expired reset link';
  end if;
  if v_row.used_at is not null then
    raise exception 'This reset link has already been used';
  end if;
  if v_row.expires_at < now() then
    raise exception 'This reset link has expired';
  end if;

  return v_row.user_id;
end;
$$;

create function public.mark_password_reset_token_used(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.password_reset_tokens set used_at = now() where token = p_token and used_at is null;
end;
$$;

grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.check_password_reset_token(text) to anon, authenticated;
grant execute on function public.mark_password_reset_token_used(text) to anon, authenticated;
