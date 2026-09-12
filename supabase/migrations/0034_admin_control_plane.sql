-- 0034_admin_control_plane.sql
-- Super-admin control plane, scoped administrator roles, platform IDs, and
-- immutable actor attribution. Existing admins are promoted to super_admin so
-- the rollout cannot strand the current platform operator.

alter table public.profiles
  add column if not exists platform_id text,
  add column if not exists admin_role text not null default 'none';

-- Email already exists in the production migration chain. Keep it populated
-- for the user directory without exposing auth.users to the browser.
update public.profiles p
set email = coalesce(nullif(p.email, ''), u.email, '')
from auth.users u
where u.id = p.id;

-- Expand the role constraints before the compatibility backfill below.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_admin_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'super_admin', 'owner'));
alter table public.profiles
  add constraint profiles_admin_role_check check (admin_role in ('none', 'super_admin', 'operations', 'support', 'finance', 'content'));

update public.profiles
set platform_id = 'ABZ-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where platform_id is null or btrim(platform_id) = '';

-- Preserve all current administrator access while introducing the explicit
-- role model. Super-admins can later demote individual administrators safely.
update public.profiles
set role = 'super_admin', admin_role = 'super_admin'
where role = 'admin' and (admin_role is null or admin_role = 'none');

alter table public.profiles alter column platform_id set not null;
alter table public.profiles alter column email set default '';

create unique index if not exists profiles_platform_id_uidx on public.profiles (platform_id);
create index if not exists profiles_admin_role_idx on public.profiles (admin_role) where role in ('admin', 'super_admin');
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- New accounts receive both a stable, support-safe platform ID and their auth
-- email through the existing auth trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, platform_id, email, name, phone)
  values (
    new.id,
    'ABZ-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'super_admin' or admin_role = 'super_admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- Permission names are deliberately stable API contracts for pages and Edge
-- Functions. Super-admins bypass the matrix; normal admins receive only the
-- tools assigned by their admin_role.
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_role text;
  v_admin_role text;
begin
  select role, admin_role into v_role, v_admin_role
  from public.profiles where id = auth.uid();
  if v_role = 'super_admin' or v_admin_role = 'super_admin' then return true; end if;
  if v_role <> 'admin' then return false; end if;
  return case v_admin_role
    when 'operations' then p_permission in ('dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read')
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    else false
  end;
end;
$$;

-- Role changes are only possible through the RPC below (or a trusted service
-- migration). A normal admin cannot edit someone else's role through the
-- broad legacy profiles policy, and the last super-admin cannot be removed.
create or replace function public.protect_admin_role_changes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.admin_role is distinct from old.admin_role then
    if auth.role() <> 'service_role' and not public.is_super_admin() then
      raise exception 'Only a super administrator can change administrator roles';
    end if;
    if auth.role() <> 'service_role' and new.id = auth.uid() then
      raise exception 'You cannot change your own administrator role';
    end if;
    if old.role = 'super_admin' and new.role <> 'super_admin'
       and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'At least one super administrator is required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_role_changes on public.profiles;
create trigger profiles_protect_admin_role_changes
  before update on public.profiles
  for each row execute function public.protect_admin_role_changes();

create or replace function public.super_admin_assign_admin_role(
  p_user_id uuid,
  p_admin_role text
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_old_role text;
  v_old_admin_role text;
  v_role text;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'You cannot change your own administrator role'; end if;
  if p_admin_role not in ('none', 'super_admin', 'operations', 'support', 'finance', 'content') then
    raise exception 'Invalid administrator role';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.id is null then raise exception 'User not found'; end if;

  v_old_role := v_profile.role;
  v_old_admin_role := v_profile.admin_role;
  v_role := case when p_admin_role = 'none' then 'owner' when p_admin_role = 'super_admin' then 'super_admin' else 'admin' end;

  update public.profiles
  set role = v_role, admin_role = p_admin_role
  where id = p_user_id
  returning * into v_profile;

  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (
    auth.uid(), 'assign_admin_role', 'profiles', p_user_id,
    jsonb_build_object('from_role', v_old_role, 'from_admin_role', v_old_admin_role,
                       'to_role', v_role, 'to_admin_role', p_admin_role,
                       'target_platform_id', v_profile.platform_id)
  );
  return v_profile;
end;
$$;

revoke all on function public.super_admin_assign_admin_role(uuid, text) from public;
grant execute on function public.super_admin_assign_admin_role(uuid, text) to authenticated, service_role;

-- Only the super-admin control plane can read the complete audit stream.
drop policy if exists "admin_logs_select_admin" on public.admin_logs;
create policy "admin_logs_select_super_admin" on public.admin_logs
  for select using (public.is_super_admin());
drop policy if exists "admin_logs_insert_admin" on public.admin_logs;
revoke insert on public.admin_logs from anon, authenticated;

-- Scope the most sensitive admin tables. Owner clauses remain unchanged; only
-- the administrator branch is narrowed, so owner dashboards and storefronts
-- are unaffected.
drop policy if exists "businesses_select" on public.businesses;
create policy "businesses_select" on public.businesses
  for select using (is_published or owner_id = auth.uid() or public.has_admin_permission('businesses.read'));
drop policy if exists "businesses_insert_admin_only" on public.businesses;
create policy "businesses_insert_admin_only" on public.businesses
  for insert with check (public.has_admin_permission('businesses.manage'));
drop policy if exists "businesses_update_own_or_admin" on public.businesses;
create policy "businesses_update_own_or_admin" on public.businesses
  for update using (owner_id = auth.uid() or public.has_admin_permission('businesses.manage'))
  with check (owner_id = auth.uid() or public.has_admin_permission('businesses.manage'));
drop policy if exists "businesses_delete_admin_only" on public.businesses;
create policy "businesses_delete_admin_only" on public.businesses
  for delete using (public.has_admin_permission('businesses.manage'));

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (public.has_admin_permission('dashboard.read') or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update" on public.subscriptions
  for update using (public.has_admin_permission('payments.review'));

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin" on public.payments
  for select using (public.has_admin_permission('payments.read') or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists "payments_admin_update" on public.payments;
create policy "payments_admin_update" on public.payments
  for update using (public.has_admin_permission('payments.review'));

drop policy if exists "announcements_admin_select" on public.announcements;
create policy "announcements_admin_select" on public.announcements
  for select using (public.has_admin_permission('announcements.send'));
drop policy if exists "announcements_admin_insert" on public.announcements;
create policy "announcements_admin_insert" on public.announcements
  for insert with check (public.has_admin_permission('announcements.send'));

drop policy if exists "templates_public_read_active" on public.templates;
create policy "templates_public_read_active" on public.templates
  for select using (is_active or public.has_admin_permission('templates.manage'));
drop policy if exists "templates_admin_insert" on public.templates;
create policy "templates_admin_insert" on public.templates
  for insert with check (public.has_admin_permission('templates.manage'));
drop policy if exists "templates_admin_update" on public.templates;
create policy "templates_admin_update" on public.templates
  for update using (public.has_admin_permission('templates.manage'));
drop policy if exists "templates_admin_delete" on public.templates;
create policy "templates_admin_delete" on public.templates
  for delete using (public.has_admin_permission('templates.manage'));

drop policy if exists "business_categories_select" on public.business_categories;
create policy "business_categories_select" on public.business_categories
  for select using (is_active or public.has_admin_permission('templates.manage'));
drop policy if exists "business_categories_admin_write" on public.business_categories;
create policy "business_categories_admin_write" on public.business_categories
  for insert with check (public.has_admin_permission('templates.manage'));
drop policy if exists "business_categories_admin_update" on public.business_categories;
create policy "business_categories_admin_update" on public.business_categories
  for update using (public.has_admin_permission('templates.manage'));
drop policy if exists "business_categories_admin_delete" on public.business_categories;
create policy "business_categories_admin_delete" on public.business_categories
  for delete using (public.has_admin_permission('templates.manage'));

drop policy if exists "plans_admin_insert" on public.plans;
create policy "plans_admin_insert" on public.plans for insert with check (public.has_admin_permission('templates.manage'));
drop policy if exists "plans_admin_update" on public.plans;
create policy "plans_admin_update" on public.plans for update using (public.has_admin_permission('templates.manage'));
drop policy if exists "plans_admin_delete" on public.plans;
create policy "plans_admin_delete" on public.plans for delete using (public.has_admin_permission('templates.manage'));
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select using (is_active or public.has_admin_permission('templates.manage'));

drop policy if exists "payment_methods_admin_insert" on public.payment_methods;
create policy "payment_methods_admin_insert" on public.payment_methods for insert with check (public.has_admin_permission('templates.manage'));
drop policy if exists "payment_methods_admin_update" on public.payment_methods;
create policy "payment_methods_admin_update" on public.payment_methods for update using (public.has_admin_permission('templates.manage'));
drop policy if exists "payment_methods_admin_delete" on public.payment_methods;
create policy "payment_methods_admin_delete" on public.payment_methods for delete using (public.has_admin_permission('templates.manage'));
drop policy if exists "payment_methods_select" on public.payment_methods;
create policy "payment_methods_select" on public.payment_methods for select using (is_active or public.has_admin_permission('templates.manage'));

-- Existing admin payment RPCs now honor the finance/operations role matrix.
create or replace function public.admin_approve_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
  v_current_end date;
  v_new_start date;
  v_new_end date;
  v_months int;
begin
  if not (public.has_admin_permission('payments.review') or auth.role() = 'service_role') then raise exception 'Not authorized'; end if;
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment already reviewed'; end if;
  update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment_id returning * into v_payment;
  select end_date into v_current_end from public.subscriptions where business_id = v_payment.business_id;
  v_new_start := case when v_current_end is not null and v_current_end > current_date then v_current_end else current_date end;
  v_months := case when v_payment.billing_cycle = 'year' then 12 else 1 end;
  v_new_end := v_new_start + make_interval(months => v_months);
  update public.subscriptions set plan_id = v_payment.plan_id, status = 'active',
    start_date = case when v_current_end is not null and v_current_end > current_date then start_date else current_date end,
    end_date = v_new_end, updated_at = now() where business_id = v_payment.business_id;
  insert into public.notifications (user_id, type, title, body, link)
    select b.owner_id, 'payment_approved', 'Payment approved', 'Your payment has been approved and your subscription is now active.', '/dashboard/billing'
    from public.businesses b where b.id = v_payment.business_id;
  if auth.uid() is not null then
    insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
      values (auth.uid(), 'approve_payment', 'payments', p_payment_id, jsonb_build_object('business_id', v_payment.business_id));
  end if;
  return v_payment;
end;
$$;

create or replace function public.admin_reject_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
declare v_payment public.payments;
begin
  if not (public.has_admin_permission('payments.review') or auth.role() = 'service_role') then raise exception 'Not authorized'; end if;
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment already reviewed'; end if;
  update public.payments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = left(p_reason, 1000)
    where id = p_payment_id returning * into v_payment;
  insert into public.notifications (user_id, type, title, body, link)
    select b.owner_id, 'payment_rejected', 'Payment rejected', coalesce('Reason: ' || p_reason, 'Your payment proof was rejected. Please review and resubmit.'), '/dashboard/billing'
    from public.businesses b where b.id = v_payment.business_id;
  if auth.uid() is not null then
    insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
      values (auth.uid(), 'reject_payment', 'payments', p_payment_id, jsonb_build_object('business_id', v_payment.business_id));
  end if;
  return v_payment;
end;
$$;
