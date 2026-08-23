-- 0018_professional_templates.sql
-- Premium-feeling storefront skins built from lightweight CSS + motion
-- primitives. They are data-driven so owners can choose them without a
-- redeploy.

insert into public.templates (slug, name, description, config, is_builtin, sort_order)
values
  ('aurora-glass', 'Aurora Glass', 'Luminous glass surfaces with a calm, modern glow.',
    '{"bg":"#07131A","card":"rgba(18,44,54,0.72)","text":"#E9FBF7","textDim":"rgba(233,251,247,0.62)","border":"rgba(164,255,231,0.16)","heroBg":"#041016","visualStyle":"aurora"}'::jsonb, true, 40),
  ('luxury-editorial', 'Luxury Editorial', 'High-end hospitality styling with cinematic gold accents.',
    '{"bg":"#110F0D","card":"#1D1814","text":"#F7E9D3","textDim":"rgba(247,233,211,0.62)","border":"rgba(215,174,104,0.2)","heroBg":"#0A0908","visualStyle":"luxury"}'::jsonb, true, 50),
  ('heritage-boutique', 'Heritage Boutique', 'Rich, warm and crafted for distinctive local brands.',
    '{"bg":"#2A1B16","card":"#3A251D","text":"#F7EBDD","textDim":"rgba(247,235,221,0.64)","border":"rgba(247,206,151,0.18)","heroBg":"#1C110D","visualStyle":"heritage"}'::jsonb, true, 60)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  is_builtin = true,
  is_active = true,
  sort_order = excluded.sort_order;

