-- ============================================================================
-- 0009_plan_features.sql
-- Feature gating by plan. Bookings/Ordering/Reviews (built starting now) are
-- Premium-only. Flags are admin-editable (Admin -> Settings -> Plans), not
-- hardcoded, so which plan gets what can change without a code deploy.
-- ============================================================================

alter table public.plans add column if not exists feature_flags jsonb not null default '{}'::jsonb;

-- Existing plans: trial gets full access (so people can actually evaluate
-- premium features during their trial); basic/business stay as they were.
update public.plans set feature_flags = '{"bookings": true, "ordering": true, "reviews": true}'::jsonb
where slug = 'trial';

update public.plans set feature_flags = '{"bookings": false, "ordering": false, "reviews": false}'::jsonb
where slug in ('basic', 'business');

insert into public.plans (slug, name, price_etb, billing_interval, features, feature_flags, is_trial, is_active, sort_order)
values (
  'premium', 'Premium', 1000, 'month',
  '["Everything in Business", "Table/appointment bookings", "Online ordering", "Customer reviews"]'::jsonb,
  '{"bookings": true, "ordering": true, "reviews": true}'::jsonb,
  false, true, 3
)
on conflict (slug) do update set
  feature_flags = excluded.feature_flags,
  features = excluded.features,
  price_etb = excluded.price_etb;

-- ── Public entitlements lookup ─────────────────────────────────────────────
-- Storefront pages need to know "does this business's current plan include
-- bookings/ordering/reviews" without exposing the full subscriptions row
-- (billing history, dates, etc.) to anonymous visitors. Security definer,
-- but deliberately returns only the three booleans — nothing sensitive.

create function public.get_business_entitlements(p_business_id uuid)
returns jsonb
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (
      select p.feature_flags
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      join public.businesses b on b.id = s.business_id
      where s.business_id = p_business_id
        and s.status in ('trial', 'active')
        and b.is_published
        and not b.is_blocked
    ),
    '{"bookings": false, "ordering": false, "reviews": false}'::jsonb
  );
$$;

grant execute on function public.get_business_entitlements(uuid) to anon, authenticated;
