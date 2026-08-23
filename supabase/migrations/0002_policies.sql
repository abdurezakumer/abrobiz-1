-- ============================================================================
-- 0002_policies.sql
-- Row Level Security. Run after 0001_schema.sql.
--
-- Model: admin (public.profiles.role = 'admin') sees/edits everything.
-- An owner sees/edits only rows belonging to their own business. The public
-- (including anonymous visitors) can read published businesses and their
-- catalogs, plus active plans.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.business_categories enable row level security;
alter table public.businesses enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.plans enable row level security;
alter table public.payment_methods enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.business_telegram_links enable row level security;
alter table public.notifications enable row level security;
alter table public.page_views enable row level security;
alter table public.admin_logs enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- insert is handled by the handle_new_user trigger (security definer), so no
-- client-facing insert policy is needed.

-- ── business_categories ────────────────────────────────────────────────────

create policy "business_categories_select" on public.business_categories
  for select using (is_active or public.is_admin());

create policy "business_categories_admin_write" on public.business_categories
  for insert with check (public.is_admin());

create policy "business_categories_admin_update" on public.business_categories
  for update using (public.is_admin());

create policy "business_categories_admin_delete" on public.business_categories
  for delete using (public.is_admin());

-- ── businesses ──────────────────────────────────────────────────────────────

create policy "businesses_select" on public.businesses
  for select using (is_published or owner_id = auth.uid() or public.is_admin());

create policy "businesses_insert_own" on public.businesses
  for insert with check (owner_id = auth.uid() or public.is_admin());

create policy "businesses_update_own_or_admin" on public.businesses
  for update using (owner_id = auth.uid() or public.is_admin());

create policy "businesses_delete_own_or_admin" on public.businesses
  for delete using (owner_id = auth.uid() or public.is_admin());

-- ── categories ──────────────────────────────────────────────────────────────

create policy "categories_select" on public.categories
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and (b.is_published or b.owner_id = auth.uid())
    )
  );

create policy "categories_write_own" on public.categories
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "categories_update_own" on public.categories
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "categories_delete_own" on public.categories
  for delete using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ── items ───────────────────────────────────────────────────────────────────

create policy "items_select" on public.items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and (b.is_published or b.owner_id = auth.uid())
    )
  );

create policy "items_write_own" on public.items
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "items_update_own" on public.items
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "items_delete_own" on public.items
  for delete using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ── plans ───────────────────────────────────────────────────────────────────

create policy "plans_select" on public.plans
  for select using (is_active or public.is_admin());

create policy "plans_admin_insert" on public.plans for insert with check (public.is_admin());
create policy "plans_admin_update" on public.plans for update using (public.is_admin());
create policy "plans_admin_delete" on public.plans for delete using (public.is_admin());

-- ── payment_methods ─────────────────────────────────────────────────────────

create policy "payment_methods_select" on public.payment_methods
  for select using (is_active or public.is_admin());

create policy "payment_methods_admin_insert" on public.payment_methods for insert with check (public.is_admin());
create policy "payment_methods_admin_update" on public.payment_methods for update using (public.is_admin());
create policy "payment_methods_admin_delete" on public.payment_methods for delete using (public.is_admin());

-- ── subscriptions ───────────────────────────────────────────────────────────
-- Owners can read their own subscription but never write it directly —
-- status/end_date changes only happen via the admin/Telegram approval flow
-- (which runs as service_role, bypassing RLS, or as an authenticated admin).

create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "subscriptions_admin_update" on public.subscriptions
  for update using (public.is_admin());

-- ── payments ────────────────────────────────────────────────────────────────
-- Owner may submit a new pending payment for their own business; only an
-- admin may transition it to approved/rejected. Nothing is deletable.

create policy "payments_select_own_or_admin" on public.payments
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "payments_insert_own_pending" on public.payments
  for insert with check (
    status = 'pending'
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "payments_admin_update" on public.payments
  for update using (public.is_admin());

-- ── business_telegram_links ────────────────────────────────────────────────

create policy "telegram_links_select_own_or_admin" on public.business_telegram_links
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "telegram_links_write_own" on public.business_telegram_links
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "telegram_links_update_own_or_admin" on public.business_telegram_links
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ── notifications ───────────────────────────────────────────────────────────

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid() or public.is_admin());

create policy "notifications_admin_insert" on public.notifications
  for insert with check (public.is_admin());

-- ── page_views ──────────────────────────────────────────────────────────────

create policy "page_views_select_own_or_admin" on public.page_views
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Inserts happen exclusively through the track_page_view() RPC (security
-- definer), so no direct insert policy is granted here.

-- ── admin_logs ──────────────────────────────────────────────────────────────

create policy "admin_logs_select_admin" on public.admin_logs
  for select using (public.is_admin());

create policy "admin_logs_insert_admin" on public.admin_logs
  for insert with check (public.is_admin());

-- ============================================================================
-- Storage buckets
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('covers', 'covers', true),
  ('item-images', 'item-images', true),
  ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Public buckets: anyone can read; only the owning business (path prefix
-- "{business_id}/...") or an admin can write.

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "covers_public_read" on storage.objects
  for select using (bucket_id = 'covers');

create policy "item_images_public_read" on storage.objects
  for select using (bucket_id = 'item-images');

create policy "public_buckets_owner_write" on storage.objects
  for insert with check (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "public_buckets_owner_update" on storage.objects
  for update using (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "public_buckets_owner_delete" on storage.objects
  for delete using (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

-- Private bucket: only the owning business and admins can read or write,
-- scoped the same way by "{business_id}/..." path prefix.

create policy "payment_proofs_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "payment_proofs_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );
