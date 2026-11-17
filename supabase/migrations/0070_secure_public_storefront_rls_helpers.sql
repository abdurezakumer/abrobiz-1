-- Keep storefront RLS checks working without granting anonymous visitors
-- access to private marketing attribution rows or business owner identifiers.

create or replace function public.can_select_storefront_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        (b.is_published and not b.is_blocked)
        or b.owner_id = auth.uid()
        or public.has_admin_permission('businesses.read')
        or exists (
          select 1
          from public.marketing_attributions ma
          where ma.owner_id = b.owner_id
            and (ma.sales_person_id = auth.uid() or ma.marketing_admin_id = auth.uid())
        )
      )
  );
$function$;

create or replace function public.can_select_storefront_catalog(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        public.is_admin()
        or b.owner_id = auth.uid()
        or (b.is_published and not b.is_blocked)
      )
  );
$function$;

create or replace function public.is_live_storefront_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.is_published
      and not b.is_blocked
  );
$function$;

create or replace function public.is_current_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$function$;

revoke all on function public.can_select_storefront_business(uuid) from public, anon, authenticated;
revoke all on function public.can_select_storefront_catalog(uuid) from public, anon, authenticated;
revoke all on function public.is_live_storefront_business(uuid) from public, anon, authenticated;
revoke all on function public.is_current_business_owner(uuid) from public, anon, authenticated;

grant execute on function public.can_select_storefront_business(uuid) to anon, authenticated;
grant execute on function public.can_select_storefront_catalog(uuid) to anon, authenticated;
grant execute on function public.is_live_storefront_business(uuid) to anon, authenticated;
grant execute on function public.is_current_business_owner(uuid) to anon, authenticated;

drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select using (public.can_select_storefront_business(id));

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (public.can_select_storefront_catalog(business_id));

drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select using (public.can_select_storefront_catalog(business_id));

drop policy if exists reviews_select_scoped on public.reviews;
create policy reviews_select_scoped on public.reviews
  for select using (
    (is_approved and public.is_live_storefront_business(business_id))
    or public.has_admin_permission('reviews.read')
    or public.has_admin_permission('dashboard.read')
    or public.is_current_business_owner(business_id)
  );
