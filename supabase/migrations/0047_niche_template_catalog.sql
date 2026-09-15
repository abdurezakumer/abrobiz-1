-- Niche templates for fitness, dental, spa, massage, hair and barber brands.
-- All templates remain presentation metadata over the existing tenant data model.

insert into public.templates (slug, name, description, config, is_builtin, is_active, sort_order)
select slug, name, description,
  jsonb_build_object(
    'category', category,
    'supportedBusinessTypes', supported_types,
    'features', features,
    'version', '1.0.0',
    'status', 'ACTIVE',
    'composition', composition,
    'bg', bg, 'card', card, 'text', text_color, 'textDim', text_dim,
    'border', border_color, 'heroBg', hero_bg, 'visualStyle', visual_style,
    'headingFont', heading_font
  ),
  true, true, sort_order
from (values
  ('luxury-gym', 'Luxury Gym', 'A dark, elevated club experience for premium gyms and performance spaces.', 'Fitness', array['fitness'], array['Programs','Membership','Facilities','Results'], 'fitness-command', '#0D1110','#19211D','#F4F2E9','rgba(244,242,233,.62)','rgba(224,184,91,.2)','#080B0A','luxury','''Playfair Display'', Georgia, serif', 80),
  ('fitness-studio', 'Modern Fitness Studio', 'A clean, high-energy studio layout that puts classes and programs first.', 'Fitness', array['fitness'], array['Classes','Schedule','Trainers','Membership'], 'fitness-coach', '#F2F4F0','#FFFFFF','#17231E','rgba(23,35,30,.6)','rgba(23,35,30,.11)','#DDE9DD','minimal','Outfit, sans-serif', 81),
  ('personal-trainer', 'Personal Trainer', 'A focused coaching page built around one-to-one expertise and a clear first step.', 'Fitness', array['fitness'], array['Coaching','Programs','Results','Booking'], 'fitness-personal', '#F9F7F2','#FFFFFF','#20201B','rgba(32,32,27,.6)','rgba(32,32,27,.11)','#EDE5D4','minimal','''Playfair Display'', Georgia, serif', 82),
  ('athletic-training', 'Athletic Training', 'A bold, modular system for CrossFit boxes and athletic training teams.', 'Fitness', array['fitness'], array['Classes','Schedule','Coaches','Facilities'], 'fitness-athletic', '#111416','#1D2528','#F2F5F4','rgba(242,245,244,.62)','rgba(113,216,180,.2)','#090B0C','grid','Outfit, sans-serif', 83),
  ('dental-trust', 'Premium Dental Clinic', 'A reassuring, structured clinic experience designed around care and confidence.', 'Dental', array['dental'], array['Treatments','Doctors','FAQ','Appointments'], 'clinical-trust', '#F1F7F8','#FFFFFF','#15343B','rgba(21,52,59,.61)','rgba(21,52,59,.11)','#DCECEF','minimal','Outfit, sans-serif', 90),
  ('dental-modern', 'Modern Dental Care', 'A light, approachable care page with a precise service-led information hierarchy.', 'Dental', array['dental'], array['Treatments','Doctors','Payment information','Appointments'], 'clinical-smile', '#FAFCFB','#FFFFFF','#173D3B','rgba(23,61,59,.58)','rgba(23,61,59,.1)','#DDF2ED','minimal','Outfit, sans-serif', 91),
  ('dental-cosmetic', 'Smile Clinic', 'An editorial cosmetic dentistry presentation for smile design and transformations.', 'Dental', array['dental'], array['Treatments','Before and after','Testimonials','Consultation'], 'clinical-cosmetic', '#191718','#292224','#F8F2EF','rgba(248,242,239,.64)','rgba(239,190,180,.2)','#100E0F','luxury','''Playfair Display'', Georgia, serif', 92),
  ('spa-luxe', 'Luxury Spa', 'A quiet, cinematic spa experience for rituals, treatments and considered self-care.', 'Spa', array['spa'], array['Experiences','Treatments','Packages','Booking'], 'spa-ritual', '#171512','#25221D','#F4E9D8','rgba(244,233,216,.62)','rgba(211,177,118,.2)','#0D0C0A','luxury','''Playfair Display'', Georgia, serif', 100),
  ('wellness-retreat', 'Wellness Retreat', 'A calm, spacious retreat layout for restorative programs and immersive stays.', 'Spa', array['spa'], array['Experiences','Programs','Therapists','Location'], 'spa-wellness', '#EEF3EC','#FBFDF9','#23352D','rgba(35,53,45,.6)','rgba(35,53,45,.11)','#D9E8D8','minimal','''Playfair Display'', Georgia, serif', 101),
  ('beauty-wellness-spa', 'Beauty & Wellness Spa', 'A polished, warm service gallery for modern beauty and wellness studios.', 'Spa', array['spa'], array['Treatments','Packages','Gallery','Booking'], 'spa-balance', '#F7F1EE','#FFFDFC','#392527','rgba(57,37,39,.6)','rgba(57,37,39,.11)','#EBDCD6','heritage','''Playfair Display'', Georgia, serif', 102),
  ('massage-center', 'Premium Massage Center', 'A refined, tactile service page that makes restorative treatment feel considered.', 'Massage', array['massage'], array['Massage types','Packages','Therapists','Booking'], 'massage-therapy', '#211A17','#30251F','#F6EBDD','rgba(246,235,221,.62)','rgba(224,174,119,.2)','#120E0C','warm','''Playfair Display'', Georgia, serif', 110),
  ('therapeutic-massage', 'Therapeutic Massage', 'A clear, grounded experience for therapeutic care, benefits and consultations.', 'Massage', array['massage'], array['Massage types','Benefits','Pricing','Appointments'], 'massage-flow', '#EFF4F2','#FFFFFF','#19332F','rgba(25,51,47,.6)','rgba(25,51,47,.11)','#D9E8E3','minimal','Outfit, sans-serif', 111),
  ('wellness-massage', 'Wellness Massage', 'A soft, modern treatment gallery for everyday recovery and wellbeing.', 'Massage', array['massage'], array['Treatments','Packages','Testimonials','Booking'], 'massage-wellness', '#FAF8F2','#FFFFFF','#342D22','rgba(52,45,34,.59)','rgba(52,45,34,.1)','#EFE6D2','minimal','''Playfair Display'', Georgia, serif', 112),
  ('hair-luxury', 'Luxury Hair Salon', 'A high-end salon portfolio with editorial rhythm and a confident booking path.', 'Hair salon', array['hair-salon'], array['Services','Stylists','Portfolio','Booking'], 'salon-editorial', '#1B1718','#2A2223','#F8F0ED','rgba(248,240,237,.63)','rgba(220,168,153,.2)','#0F0D0E','luxury','''Playfair Display'', Georgia, serif', 120),
  ('hair-studio', 'Modern Hair Studio', 'A bright, direct service layout for contemporary hair studios and colourists.', 'Hair salon', array['hair-salon'], array['Services','Pricing','Portfolio','Booking'], 'salon-studio', '#F5F5F1','#FFFFFF','#20241F','rgba(32,36,31,.59)','rgba(32,36,31,.11)','#E4E9DF','minimal','Outfit, sans-serif', 121),
  ('salon-fashion', 'Editorial Fashion Salon', 'An image-first salon look for stylists, fashion teams and statement work.', 'Hair salon', array['hair-salon'], array['Services','Stylists','Portfolio','Reviews'], 'salon-fashion', '#ECE8E3','#FDFBF8','#241F1D','rgba(36,31,29,.6)','rgba(36,31,29,.12)','#DCD4CA','heritage','''Playfair Display'', Georgia, serif', 122),
  ('barber-luxe', 'Luxury Barber', 'A dark, tailored barber experience with premium service framing.', 'Barbershop', array['barbershop'], array['Services','Barbers','Pricing','Booking'], 'barber-luxe', '#151311','#25201B','#F2E5CF','rgba(242,229,207,.62)','rgba(205,157,83,.22)','#0B0A09','luxury','''Playfair Display'', Georgia, serif', 130),
  ('barbershop-modern', 'Modern Barbershop', 'A crisp, conversion-focused shopfront for modern barber teams.', 'Barbershop', array['barbershop'], array['Services','Barbers','Pricing','Location'], 'barber-modern', '#EDEFEA','#FFFFFF','#18201D','rgba(24,32,29,.6)','rgba(24,32,29,.11)','#D6E1DB','minimal','Outfit, sans-serif', 131),
  ('classic-premium-barber', 'Classic Premium Barber', 'A heritage-inspired barber chair experience with strong typography and craft.', 'Barbershop', array['barbershop'], array['Services','Barbers','Gallery','Booking'], 'barber-classic', '#3A2A20','#4A3528','#F7EBD8','rgba(247,235,216,.62)','rgba(247,209,157,.2)','#221710','heritage','''Playfair Display'', Georgia, serif', 132)
) as catalog(slug, name, description, category, supported_types, features, composition, bg, card, text_color, text_dim, border_color, hero_bg, visual_style, heading_font, sort_order)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = public.templates.config || excluded.config,
  is_builtin = true,
  is_active = true,
  sort_order = excluded.sort_order;
