-- ============================================================================
-- 0013_email_verification.sql
-- Replaces Supabase's built-in confirmation email with one this app fully
-- controls: its own token table, its own RPCs, and (separately, in
-- send-verification-email/) its own Edge Function that sends the actual
-- email via Resend. Supabase's "Confirm email" setting should be turned OFF
-- (see SETUP.md) so signUp() returns a working session immediately —
-- verification here is informational/non-blocking, not a login gate.
-- ============================================================================

alter table public.profiles add column if not exists email_verified_at timestamptz;

create table public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_verification_tokens_user_id_idx on public.email_verification_tokens (user_id);

-- RLS enabled with zero client-facing policies — every interaction goes
-- through the two RPCs below, same pattern as telegram_pending_actions.
alter table public.email_verification_tokens enable row level security;

-- Called by the logged-in user (right after signup, or via a "resend"
-- button) to get a fresh token. Old unused tokens for that user are
-- cleared first so only the latest link works.
create function public.create_email_verification_token()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.email_verification_tokens where user_id = auth.uid() and used_at is null;

  insert into public.email_verification_tokens (user_id) values (auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- Called by whoever clicks the link in the email — deliberately does NOT
-- require being logged in as that user (possibly a different browser/device
-- than where they signed up). The token itself, delivered only via their
-- inbox, is the proof.
create function public.verify_email_token(p_token text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.email_verification_tokens;
begin
  select * into v_row from public.email_verification_tokens where token = p_token;

  if v_row.id is null then
    raise exception 'Invalid verification link';
  end if;
  if v_row.used_at is not null then
    raise exception 'This link has already been used';
  end if;
  if v_row.expires_at < now() then
    raise exception 'This verification link has expired';
  end if;

  update public.email_verification_tokens set used_at = now() where id = v_row.id;
  update public.profiles set email_verified_at = now() where id = v_row.user_id;

  return true;
end;
$$;

grant execute on function public.create_email_verification_token() to authenticated;
grant execute on function public.verify_email_token(text) to anon, authenticated;
