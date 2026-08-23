-- 0019_restaurant_cafe_template.sql
-- Warm editorial restaurant/café template inspired by the local reference UI.
-- Content remains data-driven from each business record.

insert into public.templates (slug, name, description, config, is_builtin, sort_order)
values (
  'restaurant-cafe',
  'Restaurant & Café Editorial',
  'Warm cream, espresso, amber and editorial typography for restaurants, cafés and bakeries.',
  '{"bg":"#FAF8F3","card":"#FFFDF9","text":"#2C1A0E","textDim":"rgba(44,26,14,0.62)","border":"#EAD9C8","heroBg":"#1A0E07","visualStyle":"heritage","layout":"restaurant-cafe","headingFont":"''Playfair Display'', Georgia, serif"}'::jsonb,
  true,
  35
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  is_builtin = true,
  is_active = true,
  sort_order = excluded.sort_order;
