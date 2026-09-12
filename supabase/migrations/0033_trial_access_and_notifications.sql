-- ============================================================================
-- 0033_trial_access_and_notifications.sql
-- Seven-day trials, subscription-aware public access, and public form gates.
-- ============================================================================

-- New businesses always receive exactly seven calendar days, regardless of a
-- stale value in the trial plan row. Existing trials are never extended.
update public.plans
set trial_days = 7
where is_trial;

update public.subscriptions
set end_date = start_date + 7,
    updated_at = now()
where status = 'trial'
  and end_date is not null
  and end_date > start_date + 7;

create or replace function public.create_business_with_trial(
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
    current_date + 7
  );

  return v_business;
end;
$$;

create or replace function public.get_business_entitlements(p_business_id uuid)
returns jsonb
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (
      select coalesce(p.feature_flags, '{}'::jsonb) || jsonb_build_object('siteActive', true)
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      join public.businesses b on b.id = s.business_id
      where s.business_id = p_business_id
        and s.status in ('trial', 'active')
        and s.end_date >= current_date
        and b.is_published
        and not b.is_blocked
    ),
    '{"bookings": false, "ordering": false, "reviews": false, "siteActive": false}'::jsonb
  );
$$;

create or replace function public.track_page_view(p_business_id uuid, p_path text, p_referrer text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce((public.get_business_entitlements(p_business_id) ->> 'siteActive')::boolean, false) then
    insert into public.page_views (business_id, path, referrer)
    values (p_business_id, p_path, p_referrer);
  end if;
end;
$$;

drop policy if exists "contact_messages_public_insert" on public.contact_messages;
create policy "contact_messages_public_insert" on public.contact_messages
  for insert with check (
    coalesce((public.get_business_entitlements(business_id) ->> 'siteActive')::boolean, false)
  );

drop policy if exists "bookings_public_insert" on public.bookings;
create policy "bookings_public_insert" on public.bookings
  for insert with check (
    coalesce((public.get_business_entitlements(business_id) ->> 'siteActive')::boolean, false)
    and coalesce((public.get_business_entitlements(business_id) ->> 'bookings')::boolean, false)
  );

drop policy if exists "reviews_public_insert" on public.reviews;
create policy "reviews_public_insert" on public.reviews
  for insert with check (
    is_approved = false
    and coalesce((public.get_business_entitlements(business_id) ->> 'siteActive')::boolean, false)
    and coalesce((public.get_business_entitlements(business_id) ->> 'reviews')::boolean, false)
  );

grant execute on function public.get_business_entitlements(uuid) to anon, authenticated;
