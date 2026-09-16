-- 0050_full_security_remediation.sql
-- Final-state security remediation for the existing migration chain.
-- Historical migrations are intentionally left immutable; this migration
-- removes/replaces their broad policies on an already-running project.

-- Privileged browser sessions must have completed Supabase MFA step-up.
create or replace function public.has_privileged_mfa()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function public.has_privileged_mfa() from public;
grant execute on function public.has_privileged_mfa() to authenticated, service_role;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_privileged_mfa()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and (role = 'super_admin' or admin_role = 'super_admin')
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_privileged_mfa()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    );
$$;

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
      'messages.read', 'messages.manage', 'telegram.manage', 'analytics.read', 'support.read'
    )
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review', 'analytics.read')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'messages.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    when 'marketing_admin' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders')
    when 'sales_person' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions')
    else false
  end;
end;
$$;

-- Owners may edit ordinary contact fields. Identity, verification, legal,
-- platform, and role fields are changed only through controlled workflows.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.admin_role is distinct from old.admin_role
      or new.platform_id is distinct from old.platform_id
      or new.email_verified_at is distinct from old.email_verified_at
      or new.terms_accepted_at is distinct from old.terms_accepted_at
      or new.privacy_accepted_at is distinct from old.privacy_accepted_at
      or new.legal_version is distinct from old.legal_version
      or new.marketing_policy_accepted_at is distinct from old.marketing_policy_accepted_at
      or new.marketing_policy_version is distinct from old.marketing_policy_version then
      raise exception 'Protected profile fields can only be changed through an authorized workflow';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

create or replace function public.prevent_owner_unblocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_blocked is distinct from old.is_blocked or new.blocked_reason is distinct from old.blocked_reason)
     and auth.role() <> 'service_role'
     and not public.has_admin_permission('businesses.manage') then
    raise exception 'Only an authorized administrator can change block status';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_order_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.has_admin_permission('orders.manage')
     and (
       new.business_id is distinct from old.business_id
       or new.customer_name is distinct from old.customer_name
       or new.phone is distinct from old.phone
       or new.fulfillment_type is distinct from old.fulfillment_type
       or new.address is distinct from old.address
       or new.notes is distinct from old.notes
       or new.total_etb is distinct from old.total_etb
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Order details cannot be changed after submission';
  end if;
  return new;
end;
$$;

-- Profiles: self-read/update, or explicitly scoped directory access. Role and
-- protected-field writes remain blocked by the trigger above.
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_select_self_or_scoped on public.profiles
  for select using (
    id = auth.uid()
    or public.has_admin_permission('users.read')
    or public.has_admin_permission('marketing.read')
  );
create policy profiles_update_self_or_super on public.profiles
  for update using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

drop policy if exists categories_write_own on public.categories;
drop policy if exists categories_update_own on public.categories;
drop policy if exists categories_delete_own on public.categories;
create policy categories_write_scoped on public.categories
  for insert with check (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy categories_update_scoped on public.categories
  for update using (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy categories_delete_scoped on public.categories
  for delete using (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists items_write_own on public.items;
drop policy if exists items_update_own on public.items;
drop policy if exists items_delete_own on public.items;
create policy items_write_scoped on public.items
  for insert with check (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy items_update_scoped on public.items
  for update using (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy items_delete_scoped on public.items
  for delete using (
    public.has_admin_permission('businesses.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Tenant operational data: explicit permissions replace the historical
-- is_admin() branches. Owner clauses remain limited to the owning business.
drop policy if exists contact_messages_select_own_or_admin on public.contact_messages;
drop policy if exists contact_messages_update_own_or_admin on public.contact_messages;
create policy contact_messages_select_scoped on public.contact_messages
  for select using (
    public.has_admin_permission('messages.read')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy contact_messages_update_scoped on public.contact_messages
  for update using (
    public.has_admin_permission('messages.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('messages.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists bookings_select_own_or_admin on public.bookings;
drop policy if exists bookings_update_own_or_admin on public.bookings;
create policy bookings_select_scoped on public.bookings
  for select using (
    public.has_admin_permission('bookings.read')
    or public.has_admin_permission('dashboard.read')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy bookings_update_scoped on public.bookings
  for update using (
    public.has_admin_permission('bookings.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('bookings.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists orders_select_own_or_admin on public.orders;
drop policy if exists orders_update_own_or_admin on public.orders;
drop policy if exists order_items_select_own_or_admin on public.order_items;
create policy orders_select_scoped on public.orders
  for select using (
    public.has_admin_permission('orders.read')
    or public.has_admin_permission('dashboard.read')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy orders_update_scoped on public.orders
  for update using (
    public.has_admin_permission('orders.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('orders.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy order_items_select_scoped on public.order_items
  for select using (
    public.has_admin_permission('orders.read')
    or public.has_admin_permission('dashboard.read')
    or exists (
      select 1 from public.orders o
      join public.businesses b on b.id = o.business_id
      where o.id = order_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists reviews_select_approved_or_own on public.reviews;
drop policy if exists reviews_update_own_or_admin on public.reviews;
drop policy if exists reviews_delete_own_or_admin on public.reviews;
create policy reviews_select_scoped on public.reviews
  for select using (
    is_approved
    or public.has_admin_permission('reviews.read')
    or public.has_admin_permission('dashboard.read')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy reviews_update_scoped on public.reviews
  for update using (
    public.has_admin_permission('reviews.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('reviews.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy reviews_delete_scoped on public.reviews
  for delete using (
    public.has_admin_permission('reviews.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Notifications are personal records. Browser clients may not create fake
-- notifications for other users; trusted functions and database triggers do.
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete on public.notifications from anon, authenticated;

drop policy if exists page_views_select_own_or_admin on public.page_views;
create policy page_views_select_scoped on public.page_views
  for select using (
    public.has_admin_permission('analytics.read')
    or public.has_admin_permission('dashboard.read')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Admin Telegram credentials are account-scoped. Business links remain
-- business-owner scoped, with explicit permission for platform operators.
drop policy if exists admin_telegram_links_select on public.admin_telegram_links;
drop policy if exists admin_telegram_links_insert on public.admin_telegram_links;
drop policy if exists admin_telegram_links_update on public.admin_telegram_links;
create policy admin_telegram_links_select_scoped on public.admin_telegram_links
  for select using (admin_id = auth.uid() or public.is_super_admin());
create policy admin_telegram_links_insert_scoped on public.admin_telegram_links
  for insert with check (admin_id = auth.uid() and public.has_admin_permission('dashboard.read'));
create policy admin_telegram_links_update_scoped on public.admin_telegram_links
  for update using (admin_id = auth.uid() or public.is_super_admin())
  with check (admin_id = auth.uid() or public.is_super_admin());

drop policy if exists telegram_links_select_own_or_admin on public.business_telegram_links;
drop policy if exists telegram_links_write_own on public.business_telegram_links;
drop policy if exists telegram_links_update_own_or_admin on public.business_telegram_links;
drop policy if exists business_telegram_links_update_own_or_admin on public.business_telegram_links;
create policy telegram_links_select_scoped on public.business_telegram_links
  for select using (
    public.has_admin_permission('telegram.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy telegram_links_insert_scoped on public.business_telegram_links
  for insert with check (
    public.has_admin_permission('telegram.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy telegram_links_update_scoped on public.business_telegram_links
  for update using (
    public.has_admin_permission('telegram.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.has_admin_permission('telegram.manage')
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Payment proofs are private even for administrators without payment access.
drop policy if exists payment_proofs_owner_or_admin_read on storage.objects;
create policy payment_proofs_owner_or_payment_admin_read on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and array_length(storage.foldername(storage.objects.name), 1) = 1
    and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(storage.objects.name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    and (
      public.has_admin_permission('payments.read')
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1]
          and b.owner_id = auth.uid()
      )
    )
  );

-- Keep all sensitive mutation APIs server-authorized and immutable from the
-- browser. Existing payment/referral/commission RPCs remain the sole write
-- paths and now inherit the MFA-gated permission helpers above.
revoke insert, update, delete on public.marketing_commission_ledger from anon, authenticated;
revoke insert, update, delete on public.marketing_attribution_events from anon, authenticated;
revoke insert, update, delete on public.marketing_reminder_events from anon, authenticated;
