-- ============================================================================
-- 0003_seed.sql
-- Starter data. Safe to re-run (uses ON CONFLICT DO NOTHING on natural keys).
-- Everything here is editable later from the Admin panel — this just gets
-- the platform usable on day one.
-- ============================================================================

-- ── Business categories ─────────────────────────────────────────────────────

insert into public.business_categories (slug, label, item_label, category_label, icon, sort_order)
values
  ('restaurant', 'Restaurant',        'Menu Item', 'Menu Category',     'UtensilsCrossed', 0),
  ('cafe',       'Café & Bakery',     'Menu Item', 'Menu Category',     'Coffee',          1),
  ('salon',      'Salon & Beauty',    'Service',   'Service Category',  'Scissors',        2),
  ('retail',     'Retail Shop',       'Product',   'Product Category',  'ShoppingBag',     3),
  ('hotel',      'Hotel & Lodging',   'Room / Package', 'Category',     'BedDouble',       4),
  ('other',      'Other Business',    'Item',      'Category',         'Store',           5)
on conflict (slug) do nothing;

-- ── Plans ────────────────────────────────────────────────────────────────────

insert into public.plans (slug, name, price_etb, billing_interval, features, is_trial, trial_days, is_active, sort_order)
values
  ('trial', 'Free Trial', 0, 'month',
    '["Full website","Digital catalog","QR code (PNG)","1 language"]'::jsonb,
    true, 14, true, 0),
  ('basic', 'Basic', 300, 'month',
    '["Full website","Digital catalog","QR code (PNG)","3 language support","Unlimited items"]'::jsonb,
    false, null, true, 1),
  ('business', 'Business', 700, 'month',
    '["Everything in Basic","All templates","QR (PNG + PDF + SVG)","Analytics","Priority support"]'::jsonb,
    false, null, true, 2)
on conflict (slug) do nothing;

-- ── Payment methods ──────────────────────────────────────────────────────────
-- Payment methods are intentionally not seeded. Placeholder account numbers
-- must never be active in production. Create real methods from the Admin panel
-- after deployment.

-- ============================================================================
-- IMPORTANT — creating your admin account
-- ============================================================================
-- 1. Sign up normally through the app (or Supabase Auth dashboard) with the
--    email you want to use as the platform admin.
-- 2. Then run, replacing the email:
--
--      update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'you@example.com');
--
-- Do this once per admin account. There is no public "admin signup" —
-- by design, only you can promote an account this way.
-- ============================================================================
