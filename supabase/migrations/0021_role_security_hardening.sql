-- ============================================================================
-- 0021_role_security_hardening.sql
-- Enforce the single-owner/single-website model and prevent cross-business
-- mutations through direct Supabase requests.
-- ============================================================================

create or replace function public.prevent_business_owner_scope_changes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() and new.owner_id is distinct from old.owner_id then
    raise exception 'Only an administrator can change business ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_prevent_owner_scope_changes on public.businesses;
create trigger businesses_prevent_owner_scope_changes
  before update on public.businesses
  for each row execute function public.prevent_business_owner_scope_changes();

-- Owners may create only through create_business_with_trial(), which also
-- creates the trial and demo catalog atomically.
drop policy if exists "businesses_insert_own" on public.businesses;
create policy "businesses_insert_admin_only" on public.businesses
  for insert with check (public.is_admin());

drop policy if exists "businesses_update_own_or_admin" on public.businesses;
create policy "businesses_update_own_or_admin" on public.businesses
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- A user cannot delete and recreate a second website under the same account.
-- Admin deletion remains available for account support and moderation.
drop policy if exists "businesses_delete_own_or_admin" on public.businesses;
create policy "businesses_delete_admin_only" on public.businesses
  for delete using (public.is_admin());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.categories.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.categories.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "items_write_own" on public.items;
create policy "items_write_own" on public.items
  for insert with check (
    public.is_admin()
    or (
      exists (select 1 from public.businesses b where b.id = public.items.business_id and b.owner_id = auth.uid())
      and exists (select 1 from public.categories c where c.id = public.items.category_id and c.business_id = public.items.business_id)
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.items.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (
      exists (select 1 from public.businesses b where b.id = public.items.business_id and b.owner_id = auth.uid())
      and exists (select 1 from public.categories c where c.id = public.items.category_id and c.business_id = public.items.business_id)
    )
  );

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
