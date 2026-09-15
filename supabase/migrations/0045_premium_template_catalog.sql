-- Premium multi-template catalog. Presentation metadata lives in config so this
-- remains compatible with existing installations without changing tenant data
-- or the templates table shape.

insert into public.business_categories (slug, label, item_label, category_label, icon, sort_order)
values
  ('real-estate', 'Real Estate', 'Property', 'Property Type', 'BriefcaseBusiness', 5),
  ('healthcare', 'Healthcare', 'Service', 'Service Category', 'Heart', 6),
  ('professional', 'Professional Services', 'Service', 'Service Category', 'BriefcaseBusiness', 7),
  ('fitness', 'Fitness & Gym', 'Program', 'Program Category', 'Heart', 8),
  ('events', 'Events & Weddings', 'Package', 'Package Category', 'Sparkles', 9)
on conflict (slug) do update set
  label = excluded.label,
  item_label = excluded.item_label,
  category_label = excluded.category_label,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;

update public.templates
set config = config || jsonb_build_object(
  'category', case slug
    when 'restaurant-cafe' then 'Restaurant'
    when 'modern-dark' then 'General'
    when 'clean-minimal' then 'General'
    when 'traditional-warm' then 'General'
    when 'aurora-glass' then 'General'
    when 'luxury-editorial' then 'General'
    when 'heritage-boutique' then 'General'
    else 'General'
  end,
  'version', '1.0.0',
  'status', 'ACTIVE',
  'composition', case slug
    when 'clean-minimal' then 'minimal'
    when 'modern-dark' then 'bento'
    when 'aurora-glass' then 'split'
    else 'editorial'
  end
)
where is_builtin;

insert into public.templates (slug, name, description, config, is_builtin, is_active, sort_order)
values
  ('luxury-dining', 'Luxury Dining', 'A cinematic, spacious presentation for fine dining and destination restaurants.', '{"category":"Restaurant","supportedBusinessTypes":["restaurant","cafe"],"features":["Reservations","Editorial hero"],"version":"1.0.0","status":"ACTIVE","composition":"split","bg":"#110F0D","card":"#1D1814","text":"#F7E9D3","textDim":"rgba(247,233,211,0.62)","border":"rgba(215,174,104,0.2)","heroBg":"#0A0908","visualStyle":"luxury","headingFont":"Georgia, serif"}'::jsonb, true, true, 45),
  ('modern-cafe', 'Modern Café', 'A bright, confident layout for cafés, coffee bars and contemporary bakeries.', '{"category":"Restaurant","supportedBusinessTypes":["cafe"],"features":["Menu highlights"],"version":"1.0.0","status":"ACTIVE","composition":"bento","bg":"#F7F7F2","card":"#FFFFFF","text":"#17221F","textDim":"rgba(23,34,31,0.58)","border":"rgba(23,34,31,0.1)","heroBg":"#E8F0E8","visualStyle":"minimal","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 46),
  ('salon-atelier', 'Salon Atelier', 'An elegant, image-led studio for salons, makeup artists and beauty professionals.', '{"category":"Beauty","supportedBusinessTypes":["salon"],"features":["Appointment CTA"],"version":"1.0.0","status":"ACTIVE","composition":"split","bg":"#F8F3F0","card":"#FFFDFC","text":"#291E20","textDim":"rgba(41,30,32,0.58)","border":"rgba(41,30,32,0.1)","heroBg":"#EBDDD8","visualStyle":"minimal","headingFont":"Georgia, serif"}'::jsonb, true, true, 55),
  ('spa-retreat', 'Spa Retreat', 'Calm, tactile and spacious for spas, wellness studios and restorative services.', '{"category":"Beauty","supportedBusinessTypes":["salon"],"features":["Appointment CTA","Services grid"],"version":"1.0.0","status":"ACTIVE","composition":"minimal","bg":"#EFF3EE","card":"#F9FBF7","text":"#1C3028","textDim":"rgba(28,48,40,0.58)","border":"rgba(28,48,40,0.11)","heroBg":"#D8E5D9","visualStyle":"minimal","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 56),
  ('property-atelier', 'Property Atelier', 'Editorial property storytelling with clear enquiry paths for agencies and developers.', '{"category":"Real estate","supportedBusinessTypes":["other"],"features":["Enquiry CTA","Property gallery"],"version":"1.0.0","status":"ACTIVE","composition":"corporate","bg":"#F5F4F0","card":"#FFFFFF","text":"#202625","textDim":"rgba(32,38,37,0.58)","border":"rgba(32,38,37,0.1)","heroBg":"#DCE2DE","visualStyle":"minimal","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 65),
  ('boutique-hotel', 'Boutique Hotel', 'A polished hospitality experience for hotels, resorts and guest houses.', '{"category":"Hospitality","supportedBusinessTypes":["hotel"],"features":["Room showcase","Booking CTA"],"version":"1.0.0","status":"ACTIVE","composition":"hospitality","bg":"#111B1B","card":"#1B2928","text":"#F2EBDD","textDim":"rgba(242,235,221,0.62)","border":"rgba(242,235,221,0.15)","heroBg":"#0A1111","visualStyle":"luxury","headingFont":"Georgia, serif"}'::jsonb, true, true, 66),
  ('clinic-modern', 'Clinic Modern', 'Clear, reassuring and accessible for clinics, dental practices and pharmacies.', '{"category":"Healthcare","supportedBusinessTypes":["other"],"features":["Service list","Contact CTA"],"version":"1.0.0","status":"ACTIVE","composition":"corporate","bg":"#F3F8FA","card":"#FFFFFF","text":"#16303A","textDim":"rgba(22,48,58,0.6)","border":"rgba(22,48,58,0.11)","heroBg":"#DCEEF1","visualStyle":"minimal","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 67),
  ('studio-corporate', 'Studio Corporate', 'A focused, trust-led presence for consultants, agencies, law and accounting firms.', '{"category":"Professional","supportedBusinessTypes":["other"],"features":["Trust-focused hero","Enquiry CTA"],"version":"1.0.0","status":"ACTIVE","composition":"corporate","bg":"#101722","card":"#182333","text":"#F4F7FB","textDim":"rgba(244,247,251,0.62)","border":"rgba(244,247,251,0.12)","heroBg":"#0A1019","visualStyle":"grid","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 68),
  ('fashion-gallery', 'Fashion Gallery', 'An editorial product gallery for fashion, furniture and considered retail brands.', '{"category":"Retail","supportedBusinessTypes":["retail"],"features":["Product gallery","Featured collection"],"version":"1.0.0","status":"ACTIVE","composition":"editorial","bg":"#F6F2EE","card":"#FFFCF9","text":"#261D19","textDim":"rgba(38,29,25,0.58)","border":"rgba(38,29,25,0.1)","heroBg":"#E9DDD3","visualStyle":"heritage","headingFont":"Georgia, serif"}'::jsonb, true, true, 69),
  ('fitness-energy', 'Fitness Energy', 'Bold, energetic and action-oriented for gyms, fitness studios and trainers.', '{"category":"Fitness","supportedBusinessTypes":["other"],"features":["Service cards","Strong CTA"],"version":"1.0.0","status":"ACTIVE","composition":"bento","bg":"#101313","card":"#1A2020","text":"#F4F8F2","textDim":"rgba(244,248,242,0.6)","border":"rgba(244,248,242,0.12)","heroBg":"#080A0A","visualStyle":"grid","headingFont":"Outfit, sans-serif"}'::jsonb, true, true, 70),
  ('event-house', 'Event House', 'A high-impact visual home for event planners, venues and wedding specialists.', '{"category":"Events","supportedBusinessTypes":["other"],"features":["Gallery-led hero","Enquiry CTA"],"version":"1.0.0","status":"ACTIVE","composition":"split","bg":"#19131F","card":"#271C2D","text":"#F8F0FA","textDim":"rgba(248,240,250,0.62)","border":"rgba(248,240,250,0.14)","heroBg":"#0F0A13","visualStyle":"aurora","headingFont":"Georgia, serif"}'::jsonb, true, true, 71)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = public.templates.config || excluded.config,
  is_builtin = true,
  is_active = true,
  sort_order = excluded.sort_order;
