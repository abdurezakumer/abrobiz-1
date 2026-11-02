-- MCP access requires explicit super-admin approval for every non-super-admin.
-- Approval is checked at token creation, OAuth exchange, and every MCP request.

create table if not exists public.mcp_access_approvals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcp_access_review_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);

create index if not exists mcp_access_approvals_status_requested_idx
  on public.mcp_access_approvals (status, requested_at desc);

alter table public.mcp_access_approvals enable row level security;
revoke all on public.mcp_access_approvals from public, anon, authenticated;
grant select on public.mcp_access_approvals to authenticated;
grant all on public.mcp_access_approvals to service_role;

drop policy if exists "mcp_access_approval_select_own_or_super" on public.mcp_access_approvals;
create policy "mcp_access_approval_select_own_or_super" on public.mcp_access_approvals
  for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

create or replace function public.mcp_get_access_status()
returns table (status text, requested_at timestamptz, reviewed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select case
           when public.is_super_admin() then 'approved'
           else coalesce(a.status, 'not_requested')
         end,
         a.requested_at,
         a.reviewed_at
  from (select auth.uid() as user_id) current_user_row
  left join public.mcp_access_approvals a on a.user_id = current_user_row.user_id
  where current_user_row.user_id is not null;
$$;

create or replace function public.mcp_request_access()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then raise exception 'Profile not found'; end if;
  if public.is_super_admin() then return 'approved'; end if;

  insert into public.mcp_access_approvals (user_id, status, requested_at, reviewed_at, reviewed_by, updated_at)
  values (v_user_id, 'pending', now(), null, null, now())
  on conflict (user_id) do update
    set status = 'pending', requested_at = now(), reviewed_at = null, reviewed_by = null, updated_at = now()
    where public.mcp_access_approvals.status in ('rejected', 'revoked');

  select status into v_status from public.mcp_access_approvals where user_id = v_user_id;
  insert into public.mcp_audit_logs (user_id, tool_name, outcome, metadata)
  values (v_user_id, 'mcp_access.requested', 'success', jsonb_build_object('status', v_status));
  return v_status;
end;
$$;

create or replace function public.mcp_list_access_requests(p_status text default 'all')
returns table (
  user_id uuid,
  platform_id text,
  name text,
  email text,
  role text,
  admin_role text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then raise exception 'Super administrator access required'; end if;
  if p_status is null or p_status not in ('all', 'pending', 'approved', 'rejected', 'revoked') then raise exception 'Invalid status'; end if;

  return query
    select a.user_id, p.platform_id, p.name, p.email, p.role, p.admin_role,
           a.status, a.requested_at, a.reviewed_at, a.reviewed_by
    from public.mcp_access_approvals a
    join public.profiles p on p.id = a.user_id
    where p_status = 'all' or a.status = p_status
    order by (a.status = 'pending') desc, a.requested_at desc
    limit 250;
end;
$$;

create or replace function public.mcp_review_access_request(p_user_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous text;
begin
  if v_actor is null or not public.is_super_admin() then raise exception 'Super administrator access required'; end if;
  if p_user_id is null or p_decision is null or p_decision not in ('approved', 'rejected', 'revoked') then raise exception 'Invalid decision'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and (role = 'super_admin' or admin_role = 'super_admin')) then
    raise exception 'Super administrators are exempt from approval review';
  end if;

  select status into v_previous from public.mcp_access_approvals where user_id = p_user_id for update;
  if not found then raise exception 'MCP access request not found'; end if;
  if p_decision = 'revoked' and v_previous <> 'approved' then raise exception 'Only approved access can be revoked'; end if;
  if p_decision = 'rejected' and v_previous <> 'pending' then raise exception 'Only pending access can be rejected'; end if;

  update public.mcp_access_approvals
     set status = p_decision, reviewed_at = now(), reviewed_by = v_actor, updated_at = now()
   where user_id = p_user_id;

  if p_decision in ('rejected', 'revoked') then
    update public.mcp_access_tokens set revoked_at = coalesce(revoked_at, now()) where user_id = p_user_id;
    update public.mcp_oauth_refresh_tokens set revoked_at = coalesce(revoked_at, now()) where user_id = p_user_id;
    update public.mcp_oauth_authorization_codes set consumed_at = coalesce(consumed_at, now()) where user_id = p_user_id;
  end if;

  insert into public.mcp_audit_logs (user_id, tool_name, outcome, metadata)
  values (v_actor, 'mcp_access.reviewed', 'success', jsonb_build_object(
    'target_user_id', p_user_id, 'previous_status', v_previous, 'decision', p_decision
  ));
  return p_decision;
end;
$$;

-- Service-only count; it exposes no owner, business, or platform-wide records.
create or replace function public.mcp_sales_registered_business_count(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'admin' and admin_role = 'sales_person'
  ) then return 0; end if;

  return (
    select count(*)
    from public.marketing_attributions a
    join public.businesses b on b.owner_id = a.owner_id
    where a.sales_person_id = p_user_id
  );
end;
$$;

-- Rebuild token minting with an approval check inside the security-definer RPC.
create or replace function public.mcp_create_access_token(
  p_name text,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '90 days');
  v_token text := 'abz_mcp_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash text := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_token_id uuid;
  v_profile record;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select role, admin_role into v_profile from public.profiles where id = v_user_id;
  if not found then raise exception 'Profile not found'; end if;
  if not (v_profile.role = 'super_admin' or v_profile.admin_role = 'super_admin') and not exists (
    select 1 from public.mcp_access_approvals where user_id = v_user_id and status = 'approved'
  ) then raise exception 'MCP access requires super administrator approval'; end if;
  if (v_profile.role in ('admin', 'super_admin') or v_profile.admin_role = 'super_admin') and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Administrator MFA is required';
  end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'Token name must be between 1 and 80 characters'; end if;
  if v_expires_at <= now() + interval '7 days' or v_expires_at > now() + interval '365 days' then
    raise exception 'Token expiry must be between 7 and 365 days';
  end if;
  if (select count(*) from public.mcp_access_tokens where user_id = v_user_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'The maximum number of active MCP connections has been reached';
  end if;

  insert into public.mcp_access_tokens (user_id, name, token_prefix, token_hash, expires_at)
  values (v_user_id, v_name, left(v_token, 16), v_hash, v_expires_at)
  returning id into v_token_id;

  insert into public.mcp_audit_logs (user_id, token_id, tool_name, outcome, metadata)
  values (v_user_id, v_token_id, 'mcp_token.created', 'success', jsonb_build_object('name', v_name, 'expires_at', v_expires_at));

  return jsonb_build_object('id', v_token_id, 'name', v_name, 'token', v_token,
    'token_prefix', left(v_token, 16), 'scopes', array['mcp:read', 'mcp:drafts:write']::text[], 'expires_at', v_expires_at);
end;
$$;

revoke all on function public.mcp_get_access_status() from public, anon;
revoke all on function public.mcp_request_access() from public, anon;
revoke all on function public.mcp_list_access_requests(text) from public, anon;
revoke all on function public.mcp_review_access_request(uuid, text) from public, anon;
revoke all on function public.mcp_sales_registered_business_count(uuid) from public, anon, authenticated;
grant execute on function public.mcp_get_access_status() to authenticated;
grant execute on function public.mcp_request_access() to authenticated;
grant execute on function public.mcp_list_access_requests(text) to authenticated;
grant execute on function public.mcp_review_access_request(uuid, text) to authenticated;
grant execute on function public.mcp_sales_registered_business_count(uuid) to service_role;
