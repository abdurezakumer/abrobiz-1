-- 0051_owner_support_subdomain_requests.sql
-- Controlled website-address changes. Owners may request a new address; only
-- authorized support/operations administrators can approve it through the RPC.

create table if not exists public.support_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_type text not null default 'website_address_change'
    check (request_type in ('website_address_change', 'general')),
  current_subdomain text not null,
  requested_subdomain text,
  message text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'under_review', 'completed', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_owner_created_idx
  on public.support_requests (owner_id, created_at desc);
create index if not exists support_requests_status_created_idx
  on public.support_requests (status, created_at desc);
create unique index if not exists support_requests_one_open_address_idx
  on public.support_requests (business_id)
  where request_type = 'website_address_change'
    and status in ('requested', 'under_review');

alter table public.support_requests enable row level security;

drop policy if exists support_requests_owner_select on public.support_requests;
create policy support_requests_owner_select on public.support_requests
  for select using (
    owner_id = auth.uid()
    or public.has_admin_permission('support.read')
    or public.has_admin_permission('businesses.manage')
  );

-- Inserts and state transitions are intentionally RPC-only. This prevents a
-- browser from forging owner_id, reviewed_by, or an approved status.
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text;
  v_admin_role text;
begin
  if not public.has_privileged_mfa() then return false; end if;
  select role, admin_role into v_role, v_admin_role
  from public.profiles where id = auth.uid();
  if v_role = 'super_admin' or v_admin_role = 'super_admin' then return true; end if;
  if v_role <> 'admin' then return false; end if;
  return case v_admin_role
    when 'operations' then p_permission in (
      'dashboard.read', 'businesses.read', 'businesses.manage',
      'payments.read', 'payments.review', 'bookings.read', 'bookings.manage',
      'orders.read', 'orders.manage', 'reviews.read', 'reviews.manage',
      'messages.read', 'messages.manage', 'telegram.manage', 'analytics.read',
      'support.read', 'support.manage'
    )
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review', 'analytics.read')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'support.manage', 'messages.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    when 'marketing_admin' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders')
    when 'sales_person' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions')
    else false
  end;
end;
$$;

create or replace function public.request_business_subdomain_change(
  p_business_id uuid,
  p_requested_subdomain text,
  p_message text default ''
)
returns public.support_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_business public.businesses;
  v_request public.support_requests;
  v_slug text := lower(trim(coalesce(p_requested_subdomain, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_business from public.businesses
  where id = p_business_id and owner_id = auth.uid();
  if v_business.id is null then raise exception 'Business not found'; end if;
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$'
     or v_slug = any (array['www','app','admin','api','mail','smtp','auth','dashboard','login','register','setup','support','status','static','cdn','ftp','dev','staging','test','billing','payments','storage','assets']) then
    raise exception 'Choose a valid, available AbroBiz subdomain';
  end if;
  if v_slug = v_business.slug then raise exception 'This is already your current subdomain'; end if;
  if exists (select 1 from public.businesses where slug = v_slug and id <> p_business_id) then
    raise exception 'That subdomain is already in use';
  end if;

  insert into public.support_requests (owner_id, business_id, current_subdomain, requested_subdomain, message)
  values (auth.uid(), p_business_id, v_business.slug, v_slug, left(trim(coalesce(p_message, '')), 1000))
  returning * into v_request;
  return v_request;
exception when unique_violation then
  raise exception 'You already have an open website-address request';
end;
$$;

create or replace function public.prevent_uncontrolled_subdomain_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is distinct from old.slug
     and auth.role() <> 'service_role'
     and coalesce(current_setting('abrobiz.subdomain_change_authorized', true), '0') <> '1' then
    raise exception 'Website addresses can only be changed through an approved support request';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_prevent_uncontrolled_subdomain_change on public.businesses;
create trigger businesses_prevent_uncontrolled_subdomain_change
  before update of slug on public.businesses
  for each row execute function public.prevent_uncontrolled_subdomain_change();

create or replace function public.admin_resolve_subdomain_request(
  p_request_id uuid,
  p_approved boolean,
  p_new_subdomain text default null,
  p_resolution_note text default ''
)
returns public.support_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request public.support_requests;
  v_slug text;
  v_status text;
begin
  if not (public.has_admin_permission('support.manage') or public.has_admin_permission('businesses.manage')) then
    raise exception 'Not authorized';
  end if;
  select * into v_request from public.support_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Support request not found'; end if;
  if v_request.status in ('completed', 'rejected') then raise exception 'This request has already been resolved'; end if;

  v_status := case when p_approved then 'completed' else 'rejected' end;
  if p_approved then
    v_slug := lower(trim(coalesce(nullif(p_new_subdomain, ''), v_request.requested_subdomain, '')));
    if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$'
       or v_slug = any (array['www','app','admin','api','mail','smtp','auth','dashboard','login','register','setup','support','status','static','cdn','ftp','dev','staging','test','billing','payments','storage','assets']) then
      raise exception 'Choose a valid, available AbroBiz subdomain';
    end if;
    if exists (select 1 from public.businesses where slug = v_slug and id <> v_request.business_id) then
      raise exception 'That subdomain is already in use';
    end if;
    perform set_config('abrobiz.subdomain_change_authorized', '1', true);
    update public.businesses set slug = v_slug, updated_at = now() where id = v_request.business_id;
    v_request.requested_subdomain := v_slug;
  end if;

  update public.support_requests
  set status = v_status,
      requested_subdomain = case when p_approved then v_slug else requested_subdomain end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = left(trim(coalesce(p_resolution_note, '')), 1000),
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (auth.uid(), case when p_approved then 'approve_subdomain_request' else 'reject_subdomain_request' end,
    'support_requests', p_request_id,
    jsonb_build_object('business_id', v_request.business_id, 'new_subdomain', v_request.requested_subdomain, 'note', v_request.resolution_note));

  insert into public.notifications (user_id, type, title, body, link)
  values (v_request.owner_id, 'support_request',
    case when p_approved then 'Website address updated' else 'Website address request reviewed' end,
    case when p_approved then 'Your AbroBiz website address request was approved.' else coalesce(nullif(v_request.resolution_note, ''), 'Your website address request was not approved.') end,
    '/dashboard/settings');
  return v_request;
end;
$$;

revoke all on function public.request_business_subdomain_change(uuid, text, text) from public;
grant execute on function public.request_business_subdomain_change(uuid, text, text) to authenticated;
revoke all on function public.admin_resolve_subdomain_request(uuid, boolean, text, text) from public;
grant execute on function public.admin_resolve_subdomain_request(uuid, boolean, text, text) to authenticated;

-- Support staff need the business/owner context for a request, but must not
-- receive a general unrestricted businesses query. Return only rows already
-- present in the support queue from this permission-checked function.
create or replace function public.admin_list_support_requests()
returns table (
  id uuid,
  owner_id uuid,
  business_id uuid,
  owner_name text,
  owner_email text,
  owner_platform_id text,
  business_name text,
  current_subdomain text,
  requested_subdomain text,
  message text,
  status text,
  resolution_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.has_admin_permission('support.read') or public.has_admin_permission('businesses.manage')) then
    raise exception 'Not authorized';
  end if;
  return query
  select r.id, r.owner_id, r.business_id,
    coalesce(p.name, 'Business owner'), coalesce(p.email, ''), coalesce(p.platform_id, '—'),
    coalesce(b.name, 'Business'), r.current_subdomain, r.requested_subdomain,
    r.message, r.status, r.resolution_note, r.created_at, r.reviewed_at
  from public.support_requests r
  left join public.profiles p on p.id = r.owner_id
  left join public.businesses b on b.id = r.business_id
  order by r.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_list_support_requests() from public;
grant execute on function public.admin_list_support_requests() to authenticated;
