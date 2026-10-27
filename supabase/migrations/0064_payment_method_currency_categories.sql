-- Categorize subscription payment accounts by the business currency and let
-- Finance admins manage those accounts without granting template permissions.

alter table public.payment_methods
  add column if not exists currency text not null default 'ETB';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_methods_currency_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_currency_check
      check (currency in ('ETB', 'EUR', 'USD')) not valid;
  end if;
end;
$$;

alter table public.payment_methods
  validate constraint payment_methods_currency_check;

-- Preserve the existing role matrix, adding payment-account management only
-- to Finance and the implicit full access already granted to Super Admins.
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare v_role text; v_admin_role text;
begin
  select role, admin_role into v_role, v_admin_role
  from public.profiles where id = auth.uid();
  if v_role = 'super_admin' or v_admin_role = 'super_admin' then return true; end if;
  if v_role <> 'admin' then return false; end if;
  return case v_admin_role
    when 'operations' then p_permission in ('dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read')
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review', 'plans.manage', 'payment_methods.manage')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    when 'marketing_admin' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders')
    when 'sales_person' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions')
    else false
  end;
end;
$$;

drop policy if exists "payment_methods_admin_insert" on public.payment_methods;
create policy "payment_methods_admin_insert" on public.payment_methods
  for insert with check (public.has_admin_permission('payment_methods.manage'));

drop policy if exists "payment_methods_admin_update" on public.payment_methods;
create policy "payment_methods_admin_update" on public.payment_methods
  for update using (public.has_admin_permission('payment_methods.manage'))
  with check (public.has_admin_permission('payment_methods.manage'));

drop policy if exists "payment_methods_admin_delete" on public.payment_methods;
create policy "payment_methods_admin_delete" on public.payment_methods
  for delete using (public.has_admin_permission('payment_methods.manage'));

drop policy if exists "payment_methods_select" on public.payment_methods;
create policy "payment_methods_select" on public.payment_methods
  for select using (is_active or public.has_admin_permission('payment_methods.manage'));

-- Enforce currency matching on the server for browser and Telegram submissions.
create or replace function public.validate_payment_method_currency()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_business_currency text;
  v_method_currency text;
begin
  select case upper(coalesce(b.currency, 'ETB'))
           when 'EUR' then 'EUR'
           when 'USD' then 'USD'
           else 'ETB'
         end,
         method.currency
    into v_business_currency, v_method_currency
  from public.businesses b
  join public.payment_methods method
    on method.id = new.payment_method_id and method.is_active
  where b.id = new.business_id;

  if not found then
    raise exception 'Payment method or business is unavailable';
  end if;
  if v_method_currency is distinct from v_business_currency then
    raise exception 'Payment method currency does not match business currency';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_payment_method_currency() from public, anon, authenticated;

drop trigger if exists payments_validate_method_currency on public.payments;
create trigger payments_validate_method_currency
  before insert on public.payments
  for each row execute function public.validate_payment_method_currency();
