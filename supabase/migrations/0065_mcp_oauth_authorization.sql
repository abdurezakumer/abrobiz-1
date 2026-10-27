-- OAuth 2.1 authorization-code + PKCE support for AbroBiz MCP clients.
-- OAuth records are server-managed only; no browser role can read or mutate them.

create table if not exists public.mcp_oauth_clients (
  id uuid primary key default extensions.gen_random_uuid(),
  client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
  client_uri text,
  redirect_uris jsonb not null check (jsonb_typeof(redirect_uris) = 'array'),
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method = 'none'),
  grant_types text[] not null default array['authorization_code']::text[],
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_clients_created_idx
  on public.mcp_oauth_clients (created_at desc);

create table if not exists public.mcp_oauth_authorization_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id uuid not null references public.mcp_oauth_clients (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redirect_uri text not null check (char_length(redirect_uri) between 1 and 2048),
  resource text not null check (char_length(resource) between 1 and 2048),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  scopes text[] not null default array['mcp:read']::text[],
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expiry_idx
  on public.mcp_oauth_authorization_codes (expires_at) where consumed_at is null;
create index if not exists mcp_oauth_codes_user_created_idx
  on public.mcp_oauth_authorization_codes (user_id, created_at desc);

create table if not exists public.mcp_oauth_refresh_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_id uuid not null references public.mcp_access_tokens (id) on delete cascade,
  client_id uuid not null references public.mcp_oauth_clients (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  resource text not null check (char_length(resource) between 1 and 2048),
  scopes text[] not null default array['mcp:read']::text[],
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_refresh_active_idx
  on public.mcp_oauth_refresh_tokens (client_id, user_id, expires_at)
  where revoked_at is null;
create index if not exists mcp_oauth_refresh_token_idx
  on public.mcp_oauth_refresh_tokens (token_id);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_authorization_codes enable row level security;
alter table public.mcp_oauth_refresh_tokens enable row level security;

revoke all on public.mcp_oauth_clients from public, anon, authenticated;
revoke all on public.mcp_oauth_authorization_codes from public, anon, authenticated;
revoke all on public.mcp_oauth_refresh_tokens from public, anon, authenticated;
grant all on public.mcp_oauth_clients to service_role;
grant all on public.mcp_oauth_authorization_codes to service_role;
grant all on public.mcp_oauth_refresh_tokens to service_role;

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

  update public.mcp_oauth_refresh_tokens
  set revoked_at = coalesce(revoked_at, now())
  where token_id = p_token_id;

  insert into public.mcp_audit_logs (user_id, token_id, tool_name, outcome, metadata)
  values (v_user_id, p_token_id, 'mcp_token.revoked', 'success',
          jsonb_build_object('token_owner_id', v_owner_id));
  return true;
end;
$$;

revoke all on function public.mcp_revoke_access_token(uuid) from public, anon;
grant execute on function public.mcp_revoke_access_token(uuid) to authenticated;
