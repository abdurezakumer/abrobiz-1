-- 0063_mcp_access_tokens_and_audit.sql
-- Secure, revocable credentials and audit records for the remote AbroBiz MCP
-- connector. Plaintext tokens are returned once by the creation RPC only;
-- production API requests authenticate against the stored SHA-256 hash.

create table if not exists public.mcp_access_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  token_prefix text not null check (char_length(token_prefix) between 8 and 32),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default array['mcp:read', 'mcp:drafts:write']::text[],
  expires_at timestamptz not null default (now() + interval '90 days'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_access_tokens_user_created_idx
  on public.mcp_access_tokens (user_id, created_at desc);
create index if not exists mcp_access_tokens_expiry_idx
  on public.mcp_access_tokens (expires_at) where revoked_at is null;

create table if not exists public.mcp_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_id uuid references public.mcp_access_tokens (id) on delete set null,
  tool_name text not null check (char_length(tool_name) between 1 and 120),
  business_id uuid references public.businesses (id) on delete set null,
  outcome text not null check (outcome in ('success', 'denied', 'error')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcp_audit_logs_user_created_idx
  on public.mcp_audit_logs (user_id, created_at desc);
create index if not exists mcp_audit_logs_tool_created_idx
  on public.mcp_audit_logs (tool_name, created_at desc);
create index if not exists mcp_audit_logs_business_created_idx
  on public.mcp_audit_logs (business_id, created_at desc);

alter table public.mcp_access_tokens enable row level security;
alter table public.mcp_audit_logs enable row level security;

drop policy if exists "mcp_tokens_select_own_or_super" on public.mcp_access_tokens;
create policy "mcp_tokens_select_own_or_super" on public.mcp_access_tokens
  for select using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "mcp_audit_select_own_or_super" on public.mcp_audit_logs;
create policy "mcp_audit_select_own_or_super" on public.mcp_audit_logs
  for select using (user_id = auth.uid() or public.is_super_admin());

revoke all on public.mcp_access_tokens from anon, authenticated;
revoke all on public.mcp_audit_logs from anon, authenticated;
grant select on public.mcp_access_tokens to authenticated;
grant select on public.mcp_audit_logs to authenticated;

create or replace function public.mcp_create_access_token(
  p_name text,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '90 days');
  v_token text := 'abz_mcp_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash text := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_token_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found';
  end if;
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Token name must be between 1 and 80 characters';
  end if;
  if v_expires_at <= now() + interval '7 days'
     or v_expires_at > now() + interval '365 days' then
    raise exception 'Token expiry must be between 7 and 365 days';
  end if;
  if (select count(*) from public.mcp_access_tokens
      where user_id = v_user_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'The maximum number of active MCP connections has been reached';
  end if;

  insert into public.mcp_access_tokens (user_id, name, token_prefix, token_hash, expires_at)
  values (v_user_id, v_name, left(v_token, 16), v_hash, v_expires_at)
  returning id into v_token_id;

  insert into public.mcp_audit_logs (user_id, token_id, tool_name, outcome, metadata)
  values (v_user_id, v_token_id, 'mcp_token.created', 'success',
          jsonb_build_object('name', v_name, 'expires_at', v_expires_at));

  return jsonb_build_object(
    'id', v_token_id,
    'name', v_name,
    'token', v_token,
    'token_prefix', left(v_token, 16),
    'scopes', array['mcp:read', 'mcp:drafts:write']::text[],
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.mcp_list_access_tokens()
returns table (
  id uuid,
  user_id uuid,
  name text,
  token_prefix text,
  scopes text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select id, user_id, name, token_prefix, scopes, expires_at, last_used_at, revoked_at, created_at
  from public.mcp_access_tokens
  where user_id = auth.uid() or public.is_super_admin()
  order by created_at desc;
$$;

create or replace function public.mcp_revoke_access_token(p_token_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select user_id into v_owner_id from public.mcp_access_tokens where id = p_token_id;
  if v_owner_id is null or (v_owner_id <> v_user_id and not public.is_super_admin()) then
    raise exception 'Token not found or not authorized';
  end if;

  update public.mcp_access_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_token_id;

  insert into public.mcp_audit_logs (user_id, token_id, tool_name, outcome, metadata)
  values (v_user_id, p_token_id, 'mcp_token.revoked', 'success',
          jsonb_build_object('token_owner_id', v_owner_id));
  return true;
end;
$$;

revoke all on function public.mcp_create_access_token(text, timestamptz) from public, anon;
revoke all on function public.mcp_list_access_tokens() from public, anon;
revoke all on function public.mcp_revoke_access_token(uuid) from public, anon;
grant execute on function public.mcp_create_access_token(text, timestamptz) to authenticated;
grant execute on function public.mcp_list_access_tokens() to authenticated;
grant execute on function public.mcp_revoke_access_token(uuid) to authenticated;
