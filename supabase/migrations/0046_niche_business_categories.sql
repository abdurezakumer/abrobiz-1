-- Additional business types used by the premium niche template library.
-- Existing businesses and catalog data are untouched.

insert into public.business_categories (slug, label, item_label, category_label, icon, sort_order)
values
  ('dental', 'Dental Clinic', 'Treatment', 'Treatment Category', 'Heart', 10),
  ('spa', 'Spa & Wellness', 'Treatment', 'Treatment Category', 'Sparkles', 11),
  ('massage', 'Massage Center', 'Massage', 'Massage Type', 'Heart', 12),
  ('hair-salon', 'Hair Salon', 'Service', 'Service Category', 'Scissors', 13),
  ('barbershop', 'Barbershop', 'Service', 'Service Category', 'Scissors', 14)
on conflict (slug) do update set
  label = excluded.label,
  item_label = excluded.item_label,
  category_label = excluded.category_label,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;
