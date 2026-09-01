-- ============================================================================
-- 0025_phase0_security_hardening.sql
-- P0 security hardening. Apply only after confirming the canonical production
-- Supabase project. Existing custom reset tokens are intentionally invalidated.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

drop function if exists public.request_password_reset(text);
drop function if exists public.check_password_reset_token(text);
drop function if exists public.mark_password_reset_token_used(text);

-- Old tokens may have been exposed through the old anonymous RPC. Invalidate
-- them before removing plaintext token storage. Values are never logged.
delete from public.password_reset_tokens;

alter table public.password_reset_tokens add column if not exists token_hash text;
alter table public.password_reset_tokens add column if not exists claimed_at timestamptz;
alter table public.password_reset_tokens drop column if exists token;
alter table public.password_reset_tokens alter column token_hash set not null;

create unique index if not exists password_reset_tokens_hash_idx
  on public.password_reset_tokens (token_hash);

create or replace function public.request_password_reset(p_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;

  select id, name into v_user_id, v_name
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then return null; end if;

  delete from public.password_reset_tokens
  where user_id = v_user_id and used_at is null;

  insert into public.password_reset_tokens (user_id, token_hash)
  values (v_user_id, encode(extensions.digest(v_raw_token, 'sha256'), 'hex'));

  return jsonb_build_object('token', v_raw_token, 'name', v_name);
end;
$$;

create or replace function public.claim_password_reset_token(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare v_user_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;

  update public.password_reset_tokens
  set claimed_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and used_at is null and claimed_at is null and expires_at > now()
  returning user_id into v_user_id;

  if v_user_id is null then raise exception 'Invalid or expired reset link'; end if;
  return v_user_id;
end;
$$;

create or replace function public.complete_password_reset_token(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  update public.password_reset_tokens
  set used_at = now(), claimed_at = null
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and used_at is null and claimed_at is not null;
  if not found then raise exception 'Invalid or expired reset link'; end if;
end;
$$;

create or replace function public.release_password_reset_token(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  update public.password_reset_tokens set claimed_at = null
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and used_at is null;
end;
$$;

revoke all on function public.request_password_reset(text) from public, anon, authenticated;
revoke all on function public.claim_password_reset_token(text) from public, anon, authenticated;
revoke all on function public.complete_password_reset_token(text) from public, anon, authenticated;
revoke all on function public.release_password_reset_token(text) from public, anon, authenticated;
grant execute on function public.request_password_reset(text) to service_role;
grant execute on function public.claim_password_reset_token(text) to service_role;
grant execute on function public.complete_password_reset_token(text) to service_role;
grant execute on function public.release_password_reset_token(text) to service_role;

create table if not exists public.telegram_processed_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);
alter table public.telegram_processed_updates enable row level security;

create or replace function public.claim_telegram_update(p_update_id bigint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  insert into public.telegram_processed_updates (update_id)
  values (p_update_id) on conflict (update_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_telegram_update(bigint) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint) to service_role;
