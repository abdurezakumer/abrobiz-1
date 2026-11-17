-- Restore only the read privileges required by public storefronts.
-- Row visibility remains controlled by the existing RLS policies.

grant usage on schema public to anon, authenticated;

-- Browsers must not inherit table-wide anon SELECT on businesses: owner_id,
-- block reasons, and internal SEO workflow columns are not storefront data.
revoke select on table public.businesses from anon;
grant select (
  id,
  category_id,
  name,
  slug,
  description,
  about_content,
  gallery_urls,
  logo_url,
  cover_url,
  phone,
  email,
  address,
  maps_url,
  template_slug,
  languages,
  accent_color,
  opening_hours,
  social,
  currency,
  timezone,
  is_published,
  is_blocked,
  created_at,
  seo_title,
  seo_description,
  seo_image_url,
  seo_indexing_enabled
) on table public.businesses to anon;

-- Public catalog reads use explicit presentation fields and remain subject to
-- the existing business-scoped RLS policies on categories and items.
revoke select on table public.business_categories from anon;
grant select (id, slug, label, item_label, category_label, icon, sort_order, is_active)
  on table public.business_categories to anon;

revoke select on table public.categories from anon;
grant select (id, business_id, name, icon, sort_order, is_hidden, translations, created_at)
  on table public.categories to anon;

revoke select on table public.items from anon;
grant select (id, business_id, category_id, image_url, price, is_available, is_featured, sort_order, translations, created_at)
  on table public.items to anon;

-- Only active template presentation configuration is exposed to anonymous
-- storefront visitors; RLS continues to hide inactive templates.
revoke select on table public.templates from anon;
grant select (slug, is_active, config) on table public.templates to anon;

-- Customer names/reviews are public only when the applicable RLS moderation
-- and live-business policy permits them.
revoke select on table public.reviews from anon;
grant select (id, business_id, customer_name, rating, comment, is_approved, created_at)
  on table public.reviews to anon;
