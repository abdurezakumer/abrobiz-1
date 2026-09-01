-- ============================================================================
-- 0001_schema.sql
-- Core schema for the Business Digital Platform (multi-vertical SaaS).
-- Run this in the Supabase SQL Editor (or `supabase db push`) on a fresh
-- project, before 0002_policies.sql and 0003_seed.sql.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth.users row. role drives platform-wide vs single-business
-- access. Created automatically by the handle_new_user trigger below.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('admin', 'owner')),
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent a user from promoting themselves to admin via a normal UPDATE.
-- Role changes must go through the service role (admin panel backend).
create function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() = old.id then
    raise exception 'Cannot change your own role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- Central helper used throughout RLS policies and triggers.
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── business_categories ────────────────────────────────────────────────────
-- Admin-managed list of verticals. Drives storefront/dashboard copy so
-- "Menu" becomes "Services" for a salon, "Products" for a shop, etc.,
-- without any code changes when a new vertical is added.

create table public.business_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  label text not null,
  item_label text not null default 'Item',
  category_label text not null default 'Category',
  icon text not null default 'Store',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── businesses ──────────────────────────────────────────────────────────────
-- One business per owner for the MVP (matches a single-tenant-per-account
-- model; easy to relax later by dropping the unique constraint).

create table public.businesses (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  category_id uuid references public.business_categories (id),
  name text not null,
  slug text not null unique,
  description text not null default '',
  logo_url text,
  cover_url text,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  maps_url text not null default '',
  template_slug text not null default 'clean-minimal',
  languages text[] not null default array['en'],
  accent_color text not null default '#D4A853',
  opening_hours jsonb not null default '{}'::jsonb,
  social jsonb not null default '{}'::jsonb,
  currency text not null default 'ETB',
  timezone text not null default 'Africa/Addis_Ababa',
  is_published boolean not null default false,
  is_blocked boolean not null default false,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_slug_idx on public.businesses (slug);
create index businesses_category_id_idx on public.businesses (category_id);

-- Only an admin may flip is_blocked / blocked_reason — an owner updating
-- their own row (e.g. publishing, editing description) can't unblock
-- themselves.
create function public.prevent_owner_unblocking()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.is_blocked is distinct from old.is_blocked
      or new.blocked_reason is distinct from old.blocked_reason)
     and not public.is_admin() then
    raise exception 'Only an administrator can change block status';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_prevent_owner_unblocking
  before update on public.businesses
  for each row execute function public.prevent_owner_unblocking();

-- ── categories & items ─────────────────────────────────────────────────────
-- Generic catalog shape that works for a restaurant menu, a salon service
-- list, or a retail product catalog alike.

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  icon text not null default '',
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index categories_business_id_idx on public.categories (business_id);

create table public.items (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  image_url text,
  price numeric(12, 2) not null default 0,
  is_available boolean not null default true,
  sort_order int not null default 0,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index items_business_id_idx on public.items (business_id);
create index items_category_id_idx on public.items (category_id);

-- ── plans ───────────────────────────────────────────────────────────────────
-- Admin-configurable pricing — no hardcoded plan names/prices in the app.

create table public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_etb numeric(12, 2) not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  features jsonb not null default '[]'::jsonb,
  is_trial boolean not null default false,
  trial_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── payment_methods ─────────────────────────────────────────────────────────
-- Admin-configurable "where to send money" (Telebirr, bank accounts, etc.)

create table public.payment_methods (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  account_name text not null default '',
  account_number text not null default '',
  instructions text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── subscriptions ───────────────────────────────────────────────────────────
-- One row per business, updated in place on renewal. History of individual
-- payments/renewals lives in the payments table.

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  plan_id uuid references public.plans (id),
  status text not null default 'trial' check (status in ('trial', 'active', 'expired', 'cancelled')),
  start_date date not null default current_date,
  end_date date,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_end_date_idx on public.subscriptions (end_date);

-- ── payments ────────────────────────────────────────────────────────────────
-- Manual payment-proof submissions. Immutable once created from the client;
-- only the admin flow (approve/reject) may update status.

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  billing_cycle text not null default 'month',
  amount_etb numeric(12, 2) not null,
  payment_method_id uuid references public.payment_methods (id),
  proof_url text,
  owner_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  telegram_message_id text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index payments_business_id_idx on public.payments (business_id);
create index payments_status_idx on public.payments (status);

-- ── business_telegram_links ────────────────────────────────────────────────
-- Optional linkage so an owner can submit proof / get notified via the bot.

create table public.business_telegram_links (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  telegram_chat_id text,
  telegram_username text,
  link_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  linked_at timestamptz
);

-- ── notifications ───────────────────────────────────────────────────────────

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, is_read);

-- ── page_views ──────────────────────────────────────────────────────────────
-- Lightweight storefront analytics.

create table public.page_views (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  path text not null default '',
  referrer text not null default '',
  created_at timestamptz not null default now()
);

create index page_views_business_id_idx on public.page_views (business_id, created_at);

-- ── admin_logs ──────────────────────────────────────────────────────────────
-- Audit trail for every admin action (block, approve payment, edit plan…).

create table public.admin_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  admin_id uuid references public.profiles (id),
  action text not null,
  target_table text,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_logs_created_at_idx on public.admin_logs (created_at desc);

-- ── RPC: track a storefront page view ──────────────────────────────────────
-- Called by anonymous visitors; only allowed for published businesses.

create function public.track_page_view(p_business_id uuid, p_path text, p_referrer text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.businesses where id = p_business_id and is_published) then
    insert into public.page_views (business_id, path, referrer)
    values (p_business_id, p_path, p_referrer);
  end if;
end;
$$;

-- ── RPC: create a new business + its trial subscription atomically ────────
-- Called right after an owner finishes registration.

create function public.create_business_with_trial(
  p_name text,
  p_slug text,
  p_category_id uuid
)
returns public.businesses
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_trial_plan public.plans;
begin
  if exists (select 1 from public.businesses where owner_id = auth.uid()) then
    raise exception 'You already have a business on this account';
  end if;

  insert into public.businesses (owner_id, name, slug, category_id)
  values (auth.uid(), p_name, p_slug, p_category_id)
  returning * into v_business;

  select * into v_trial_plan from public.plans where is_trial and is_active limit 1;

  insert into public.subscriptions (business_id, plan_id, status, start_date, end_date)
  values (
    v_business.id,
    v_trial_plan.id,
    'trial',
    current_date,
    current_date + make_interval(days => coalesce(v_trial_plan.trial_days, 14))
  );

  return v_business;
end;
$$;
