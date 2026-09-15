import type { Template, TemplateConfig, TemplateComposition } from '../types'

export type TemplateCategory =
  | 'Restaurant'
  | 'Beauty'
  | 'Real estate'
  | 'Hospitality'
  | 'Healthcare'
  | 'Dental'
  | 'Spa'
  | 'Massage'
  | 'Hair salon'
  | 'Barbershop'
  | 'Professional'
  | 'Retail'
  | 'Fitness'
  | 'Events'
  | 'General'

export type { TemplateComposition } from '../types'

export interface TemplateDefinition {
  slug: string
  name: string
  category: TemplateCategory
  description: string
  supportedBusinessTypes: string[]
  features: string[]
  version: string
  config: TemplateConfig
}

const sharedFeatures = ['Responsive layout', 'Gallery', 'Catalog or services', 'Contact CTA']

function nicheTemplate(
  slug: string,
  name: string,
  category: TemplateCategory,
  description: string,
  supportedBusinessTypes: string[],
  composition: TemplateComposition,
  config: TemplateConfig,
  features: string[],
): TemplateDefinition {
  return {
    slug, name, category, description, supportedBusinessTypes, features: [...sharedFeatures, ...features], version: '1.0.0',
    config: { ...config, category, supportedBusinessTypes, features, version: '1.0.0', status: 'ACTIVE', composition },
  }
}

const PREMIUM_NICHE_TEMPLATES: TemplateDefinition[] = [
  nicheTemplate('luxury-gym', 'Luxury Gym', 'Fitness', 'A dark, elevated club experience for premium gyms and performance spaces.', ['fitness'], 'fitness-command', { bg: '#0D1110', card: '#19211D', text: '#F4F2E9', textDim: 'rgba(244,242,233,.62)', border: 'rgba(224,184,91,.2)', heroBg: '#080B0A', visualStyle: 'luxury', headingFont: "'Playfair Display', Georgia, serif" }, ['Programs', 'Membership', 'Facilities', 'Results']),
  nicheTemplate('fitness-studio', 'Modern Fitness Studio', 'Fitness', 'A clean, high-energy studio layout that puts classes and programs first.', ['fitness'], 'fitness-coach', { bg: '#F2F4F0', card: '#FFFFFF', text: '#17231E', textDim: 'rgba(23,35,30,.6)', border: 'rgba(23,35,30,.11)', heroBg: '#DDE9DD', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Classes', 'Schedule', 'Trainers', 'Membership']),
  nicheTemplate('personal-trainer', 'Personal Trainer', 'Fitness', 'A focused coaching page built around one-to-one expertise and a clear first step.', ['fitness'], 'fitness-personal', { bg: '#F9F7F2', card: '#FFFFFF', text: '#20201B', textDim: 'rgba(32,32,27,.6)', border: 'rgba(32,32,27,.11)', heroBg: '#EDE5D4', visualStyle: 'minimal', headingFont: "'Playfair Display', Georgia, serif" }, ['Coaching', 'Programs', 'Results', 'Booking']),
  nicheTemplate('athletic-training', 'Athletic Training', 'Fitness', 'A bold, modular system for CrossFit boxes and athletic training teams.', ['fitness'], 'fitness-athletic', { bg: '#111416', card: '#1D2528', text: '#F2F5F4', textDim: 'rgba(242,245,244,.62)', border: 'rgba(113,216,180,.2)', heroBg: '#090B0C', visualStyle: 'grid', headingFont: 'Outfit, sans-serif' }, ['Classes', 'Schedule', 'Coaches', 'Facilities']),
  nicheTemplate('dental-trust', 'Premium Dental Clinic', 'Dental', 'A reassuring, structured clinic experience designed around care and confidence.', ['dental'], 'clinical-trust', { bg: '#F1F7F8', card: '#FFFFFF', text: '#15343B', textDim: 'rgba(21,52,59,.61)', border: 'rgba(21,52,59,.11)', heroBg: '#DCECEF', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Treatments', 'Doctors', 'FAQ', 'Appointments']),
  nicheTemplate('dental-modern', 'Modern Dental Care', 'Dental', 'A light, approachable care page with a precise service-led information hierarchy.', ['dental'], 'clinical-smile', { bg: '#FAFCFB', card: '#FFFFFF', text: '#173D3B', textDim: 'rgba(23,61,59,.58)', border: 'rgba(23,61,59,.1)', heroBg: '#DDF2ED', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Treatments', 'Doctors', 'Payment information', 'Appointments']),
  nicheTemplate('dental-cosmetic', 'Smile Clinic', 'Dental', 'An editorial cosmetic dentistry presentation for smile design and transformations.', ['dental'], 'clinical-cosmetic', { bg: '#191718', card: '#292224', text: '#F8F2EF', textDim: 'rgba(248,242,239,.64)', border: 'rgba(239,190,180,.2)', heroBg: '#100E0F', visualStyle: 'luxury', headingFont: "'Playfair Display', Georgia, serif" }, ['Treatments', 'Before and after', 'Testimonials', 'Consultation']),
  nicheTemplate('spa-luxe', 'Luxury Spa', 'Spa', 'A quiet, cinematic spa experience for rituals, treatments and considered self-care.', ['spa'], 'spa-ritual', { bg: '#171512', card: '#25221D', text: '#F4E9D8', textDim: 'rgba(244,233,216,.62)', border: 'rgba(211,177,118,.2)', heroBg: '#0D0C0A', visualStyle: 'luxury', headingFont: "'Playfair Display', Georgia, serif" }, ['Experiences', 'Treatments', 'Packages', 'Booking']),
  nicheTemplate('wellness-retreat', 'Wellness Retreat', 'Spa', 'A calm, spacious retreat layout for restorative programs and immersive stays.', ['spa'], 'spa-wellness', { bg: '#EEF3EC', card: '#FBFDF9', text: '#23352D', textDim: 'rgba(35,53,45,.6)', border: 'rgba(35,53,45,.11)', heroBg: '#D9E8D8', visualStyle: 'minimal', headingFont: "'Playfair Display', Georgia, serif" }, ['Experiences', 'Programs', 'Therapists', 'Location']),
  nicheTemplate('beauty-wellness-spa', 'Beauty & Wellness Spa', 'Spa', 'A polished, warm service gallery for modern beauty and wellness studios.', ['spa'], 'spa-balance', { bg: '#F7F1EE', card: '#FFFDFC', text: '#392527', textDim: 'rgba(57,37,39,.6)', border: 'rgba(57,37,39,.11)', heroBg: '#EBDCD6', visualStyle: 'heritage', headingFont: "'Playfair Display', Georgia, serif" }, ['Treatments', 'Packages', 'Gallery', 'Booking']),
  nicheTemplate('massage-center', 'Premium Massage Center', 'Massage', 'A refined, tactile service page that makes restorative treatment feel considered.', ['massage'], 'massage-therapy', { bg: '#211A17', card: '#30251F', text: '#F6EBDD', textDim: 'rgba(246,235,221,.62)', border: 'rgba(224,174,119,.2)', heroBg: '#120E0C', visualStyle: 'warm', headingFont: "'Playfair Display', Georgia, serif" }, ['Massage types', 'Packages', 'Therapists', 'Booking']),
  nicheTemplate('therapeutic-massage', 'Therapeutic Massage', 'Massage', 'A clear, grounded experience for therapeutic care, benefits and consultations.', ['massage'], 'massage-flow', { bg: '#EFF4F2', card: '#FFFFFF', text: '#19332F', textDim: 'rgba(25,51,47,.6)', border: 'rgba(25,51,47,.11)', heroBg: '#D9E8E3', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Massage types', 'Benefits', 'Pricing', 'Appointments']),
  nicheTemplate('wellness-massage', 'Wellness Massage', 'Massage', 'A soft, modern treatment gallery for everyday recovery and wellbeing.', ['massage'], 'massage-wellness', { bg: '#FAF8F2', card: '#FFFFFF', text: '#342D22', textDim: 'rgba(52,45,34,.59)', border: 'rgba(52,45,34,.1)', heroBg: '#EFE6D2', visualStyle: 'minimal', headingFont: "'Playfair Display', Georgia, serif" }, ['Treatments', 'Packages', 'Testimonials', 'Booking']),
  nicheTemplate('hair-luxury', 'Luxury Hair Salon', 'Hair salon', 'A high-end salon portfolio with editorial rhythm and a confident booking path.', ['hair-salon'], 'salon-editorial', { bg: '#1B1718', card: '#2A2223', text: '#F8F0ED', textDim: 'rgba(248,240,237,.63)', border: 'rgba(220,168,153,.2)', heroBg: '#0F0D0E', visualStyle: 'luxury', headingFont: "'Playfair Display', Georgia, serif" }, ['Services', 'Stylists', 'Portfolio', 'Booking']),
  nicheTemplate('hair-studio', 'Modern Hair Studio', 'Hair salon', 'A bright, direct service layout for contemporary hair studios and colourists.', ['hair-salon'], 'salon-studio', { bg: '#F5F5F1', card: '#FFFFFF', text: '#20241F', textDim: 'rgba(32,36,31,.59)', border: 'rgba(32,36,31,.11)', heroBg: '#E4E9DF', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Services', 'Pricing', 'Portfolio', 'Booking']),
  nicheTemplate('salon-fashion', 'Editorial Fashion Salon', 'Hair salon', 'An image-first salon look for stylists, fashion teams and statement work.', ['hair-salon'], 'salon-fashion', { bg: '#ECE8E3', card: '#FDFBF8', text: '#241F1D', textDim: 'rgba(36,31,29,.6)', border: 'rgba(36,31,29,.12)', heroBg: '#DCD4CA', visualStyle: 'heritage', headingFont: "'Playfair Display', Georgia, serif" }, ['Services', 'Stylists', 'Portfolio', 'Reviews']),
  nicheTemplate('barber-luxe', 'Luxury Barber', 'Barbershop', 'A dark, tailored barber experience with premium service framing.', ['barbershop'], 'barber-luxe', { bg: '#151311', card: '#25201B', text: '#F2E5CF', textDim: 'rgba(242,229,207,.62)', border: 'rgba(205,157,83,.22)', heroBg: '#0B0A09', visualStyle: 'luxury', headingFont: "'Playfair Display', Georgia, serif" }, ['Services', 'Barbers', 'Pricing', 'Booking']),
  nicheTemplate('barbershop-modern', 'Modern Barbershop', 'Barbershop', 'A crisp, conversion-focused shopfront for modern barber teams.', ['barbershop'], 'barber-modern', { bg: '#EDEFEA', card: '#FFFFFF', text: '#18201D', textDim: 'rgba(24,32,29,.6)', border: 'rgba(24,32,29,.11)', heroBg: '#D6E1DB', visualStyle: 'minimal', headingFont: 'Outfit, sans-serif' }, ['Services', 'Barbers', 'Pricing', 'Location']),
  nicheTemplate('classic-premium-barber', 'Classic Premium Barber', 'Barbershop', 'A heritage-inspired barber chair experience with strong typography and craft.', ['barbershop'], 'barber-classic', { bg: '#3A2A20', card: '#4A3528', text: '#F7EBD8', textDim: 'rgba(247,235,216,.62)', border: 'rgba(247,209,157,.2)', heroBg: '#221710', visualStyle: 'heritage', headingFont: "'Playfair Display', Georgia, serif" }, ['Services', 'Barbers', 'Gallery', 'Booking']),
]

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  ...PREMIUM_NICHE_TEMPLATES,
  {
    slug: 'restaurant-cafe', name: 'Restaurant & Café Editorial', category: 'Restaurant',
    description: 'Warm cream, espresso and editorial typography for restaurants, cafés and bakeries.',
    supportedBusinessTypes: ['restaurant', 'cafe'], features: [...sharedFeatures, 'Reservations'], version: '1.0.0',
    config: { bg: '#FAF8F3', card: '#FFFDF9', text: '#2C1A0E', textDim: 'rgba(44,26,14,0.62)', border: '#EAD9C8', heroBg: '#1A0E07', visualStyle: 'heritage', layout: 'restaurant-cafe', composition: 'editorial', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'luxury-dining', name: 'Luxury Dining', category: 'Restaurant',
    description: 'A cinematic, spacious presentation for fine dining and destination restaurants.',
    supportedBusinessTypes: ['restaurant', 'cafe'], features: [...sharedFeatures, 'Reservations', 'Editorial hero'], version: '1.0.0',
    config: { bg: '#110F0D', card: '#1D1814', text: '#F7E9D3', textDim: 'rgba(247,233,211,0.62)', border: 'rgba(215,174,104,0.2)', heroBg: '#0A0908', visualStyle: 'luxury', composition: 'split', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'modern-cafe', name: 'Modern Café', category: 'Restaurant',
    description: 'A bright, confident layout for cafés, coffee bars and contemporary bakeries.',
    supportedBusinessTypes: ['cafe'], features: [...sharedFeatures, 'Menu highlights'], version: '1.0.0',
    config: { bg: '#F7F7F2', card: '#FFFFFF', text: '#17221F', textDim: 'rgba(23,34,31,0.58)', border: 'rgba(23,34,31,0.1)', heroBg: '#E8F0E8', visualStyle: 'minimal', composition: 'bento', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'salon-atelier', name: 'Salon Atelier', category: 'Beauty',
    description: 'An elegant, image-led studio for salons, makeup artists and beauty professionals.',
    supportedBusinessTypes: ['salon'], features: [...sharedFeatures, 'Appointment CTA'], version: '1.0.0',
    config: { bg: '#F8F3F0', card: '#FFFDFC', text: '#291E20', textDim: 'rgba(41,30,32,0.58)', border: 'rgba(41,30,32,0.1)', heroBg: '#EBDDD8', visualStyle: 'minimal', composition: 'split', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'spa-retreat', name: 'Spa Retreat', category: 'Beauty',
    description: 'Calm, tactile and spacious for spas, wellness studios and restorative services.',
    supportedBusinessTypes: ['salon'], features: [...sharedFeatures, 'Appointment CTA', 'Services grid'], version: '1.0.0',
    config: { bg: '#EFF3EE', card: '#F9FBF7', text: '#1C3028', textDim: 'rgba(28,48,40,0.58)', border: 'rgba(28,48,40,0.11)', heroBg: '#D8E5D9', visualStyle: 'minimal', composition: 'minimal', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'property-atelier', name: 'Property Atelier', category: 'Real estate',
    description: 'Editorial property storytelling with clear enquiry paths for agencies and developers.',
    supportedBusinessTypes: ['real-estate'], features: [...sharedFeatures, 'Enquiry CTA', 'Property gallery'], version: '1.0.0',
    config: { bg: '#F5F4F0', card: '#FFFFFF', text: '#202625', textDim: 'rgba(32,38,37,0.58)', border: 'rgba(32,38,37,0.1)', heroBg: '#DCE2DE', visualStyle: 'minimal', composition: 'corporate', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'boutique-hotel', name: 'Boutique Hotel', category: 'Hospitality',
    description: 'A polished hospitality experience for hotels, resorts and guest houses.',
    supportedBusinessTypes: ['hotel'], features: [...sharedFeatures, 'Room showcase', 'Booking CTA'], version: '1.0.0',
    config: { bg: '#111B1B', card: '#1B2928', text: '#F2EBDD', textDim: 'rgba(242,235,221,0.62)', border: 'rgba(242,235,221,0.15)', heroBg: '#0A1111', visualStyle: 'luxury', composition: 'hospitality', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'clinic-modern', name: 'Clinic Modern', category: 'Healthcare',
    description: 'Clear, reassuring and accessible for clinics, dental practices and pharmacies.',
    supportedBusinessTypes: ['healthcare'], features: [...sharedFeatures, 'Service list', 'Contact CTA'], version: '1.0.0',
    config: { bg: '#F3F8FA', card: '#FFFFFF', text: '#16303A', textDim: 'rgba(22,48,58,0.6)', border: 'rgba(22,48,58,0.11)', heroBg: '#DCEEF1', visualStyle: 'minimal', composition: 'corporate', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'studio-corporate', name: 'Studio Corporate', category: 'Professional',
    description: 'A focused, trust-led presence for consultants, agencies, law and accounting firms.',
    supportedBusinessTypes: ['professional'], features: [...sharedFeatures, 'Trust-focused hero', 'Enquiry CTA'], version: '1.0.0',
    config: { bg: '#101722', card: '#182333', text: '#F4F7FB', textDim: 'rgba(244,247,251,0.62)', border: 'rgba(244,247,251,0.12)', heroBg: '#0A1019', visualStyle: 'grid', composition: 'corporate', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'fashion-gallery', name: 'Fashion Gallery', category: 'Retail',
    description: 'An editorial product gallery for fashion, furniture and considered retail brands.',
    supportedBusinessTypes: ['retail'], features: [...sharedFeatures, 'Product gallery', 'Featured collection'], version: '1.0.0',
    config: { bg: '#F6F2EE', card: '#FFFCF9', text: '#261D19', textDim: 'rgba(38,29,25,0.58)', border: 'rgba(38,29,25,0.1)', heroBg: '#E9DDD3', visualStyle: 'heritage', composition: 'editorial', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'fitness-energy', name: 'Fitness Energy', category: 'Fitness',
    description: 'Bold, energetic and action-oriented for gyms, fitness studios and trainers.',
    supportedBusinessTypes: ['fitness'], features: [...sharedFeatures, 'Service cards', 'Strong CTA'], version: '1.0.0',
    config: { bg: '#101313', card: '#1A2020', text: '#F4F8F2', textDim: 'rgba(244,248,242,0.6)', border: 'rgba(244,248,242,0.12)', heroBg: '#080A0A', visualStyle: 'grid', composition: 'bento', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'event-house', name: 'Event House', category: 'Events',
    description: 'A high-impact visual home for event planners, venues and wedding specialists.',
    supportedBusinessTypes: ['events'], features: [...sharedFeatures, 'Gallery-led hero', 'Enquiry CTA'], version: '1.0.0',
    config: { bg: '#19131F', card: '#271C2D', text: '#F8F0FA', textDim: 'rgba(248,240,250,0.62)', border: 'rgba(248,240,250,0.14)', heroBg: '#0F0A13', visualStyle: 'aurora', composition: 'split', headingFont: "'Playfair Display', Georgia, serif" },
  },
  {
    slug: 'modern-dark', name: 'Modern Dark', category: 'General',
    description: 'Bold, moody and flexible for businesses that want a confident digital presence.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'real-estate', 'healthcare', 'professional', 'fitness', 'events', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#111318', card: '#191C22', text: '#F5F3EF', textDim: 'rgba(245,243,239,0.55)', border: 'rgba(255,255,255,0.08)', heroBg: '#0A0C10', visualStyle: 'grid', composition: 'bento', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'clean-minimal', name: 'Clean Minimal', category: 'General',
    description: 'Light, crisp and adaptable with a typography-led presentation.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'real-estate', 'healthcare', 'professional', 'fitness', 'events', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#FBFAF8', card: '#FFFFFF', text: '#161616', textDim: 'rgba(22,22,22,0.55)', border: 'rgba(22,22,22,0.08)', heroBg: '#F6F3EE', visualStyle: 'minimal', composition: 'minimal', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'traditional-warm', name: 'Traditional Warm', category: 'General',
    description: 'Earthy tones with a welcoming, crafted feel for distinctive local brands.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'real-estate', 'healthcare', 'professional', 'fitness', 'events', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#3E2A1C', card: '#4A3323', text: '#F5EDE0', textDim: 'rgba(245,237,224,0.6)', border: 'rgba(245,237,224,0.12)', heroBg: '#2E1F15', visualStyle: 'warm', composition: 'editorial', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'aurora-glass', name: 'Aurora Glass', category: 'General',
    description: 'Luminous glass surfaces with a calm, modern glow for creative businesses.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'real-estate', 'healthcare', 'professional', 'fitness', 'events', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#07131A', card: 'rgba(18,44,54,0.72)', text: '#E9FBF7', textDim: 'rgba(233,251,247,0.62)', border: 'rgba(164,255,231,0.16)', heroBg: '#041016', visualStyle: 'aurora', composition: 'split', headingFont: 'Outfit, sans-serif' },
  },
  {
    slug: 'luxury-editorial', name: 'Luxury Editorial', category: 'General',
    description: 'High-end editorial styling with cinematic accents and generous spacing.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'real-estate', 'healthcare', 'professional', 'fitness', 'events', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#110F0D', card: '#1D1814', text: '#F7E9D3', textDim: 'rgba(247,233,211,0.62)', border: 'rgba(215,174,104,0.2)', heroBg: '#0A0908', visualStyle: 'luxury', composition: 'editorial', headingFont: 'Georgia, serif' },
  },
  {
    slug: 'heritage-boutique', name: 'Heritage Boutique', category: 'General',
    description: 'Rich, warm and crafted for memorable independent brands.',
    supportedBusinessTypes: ['restaurant', 'cafe', 'salon', 'retail', 'hotel', 'other'], features: [...sharedFeatures, 'Flexible sections'], version: '1.0.0',
    config: { bg: '#2A1B16', card: '#3A251D', text: '#F7EBDD', textDim: 'rgba(247,235,221,0.64)', border: 'rgba(247,206,151,0.18)', heroBg: '#1C110D', visualStyle: 'heritage', composition: 'editorial', headingFont: 'Georgia, serif' },
  },
]

export const BUILTIN_TEMPLATES: Template[] = TEMPLATE_REGISTRY.map((definition, index) => ({
  id: definition.slug,
  slug: definition.slug,
  name: definition.name,
  description: definition.description,
  config: definition.config,
  isBuiltin: true,
  isActive: true,
  sortOrder: index * 10 + 10,
  createdAt: '',
}))

export function templateDefinition(slug: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY.find(template => template.slug === slug)
}

export function templateCategory(template: Template): TemplateCategory {
  return templateDefinition(template.slug)?.category ?? (template.config.category as TemplateCategory | undefined) ?? 'General'
}

export function templateSupportedTypes(template: Template): string[] {
  return templateDefinition(template.slug)?.supportedBusinessTypes ?? template.config.supportedBusinessTypes ?? []
}

export function templateComposition(slug: string, config?: TemplateConfig): TemplateComposition {
  return (config?.composition as TemplateComposition | undefined) ?? templateDefinition(slug)?.config.composition as TemplateComposition | undefined ?? 'minimal'
}

export function enrichTemplate(template: Template): Template {
  const definition = templateDefinition(template.slug)
  if (!definition) return template
  return { ...template, name: template.name || definition.name, description: template.description || definition.description, config: { ...definition.config, ...template.config } }
}
