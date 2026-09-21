import type { Business, OpeningHours, WeeklyHours } from '../types'
import { safeHttpsUrl, safeImageUrl } from './safeUrl'

export type SeoFieldSource = 'automatic' | 'owner_customized' | 'ai_generated' | 'admin_managed'

export interface SeoContext {
  categoryLabel?: string
  categorySlug?: string
  canonicalUrl: string
  siteName?: string
}

export interface TenantSeo {
  title: string
  description: string
  canonicalUrl: string
  robots: 'index,follow' | 'noindex,nofollow'
  imageUrl?: string
  schema: Record<string, unknown>
  indexable: boolean
}

const MAX_TITLE_LENGTH = 60
const MAX_DESCRIPTION_LENGTH = 160
const DAY_NAMES: Record<keyof WeeklyHours, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function cleanText(value: unknown): string {
  // The control-character range is intentional: user-entered business text
  // must never reach metadata or structured-data output as raw controls.
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

function trimTo(value: string, length: number): string {
  if (value.length <= length) return value
  const shortened = value.slice(0, length - 1).replace(/\s+\S*$/, '').trim()
  return `${shortened || value.slice(0, length - 1).trim()}…`
}

function schemaTypeFor(categorySlug = '', categoryLabel = ''): string {
  const value = `${categorySlug} ${categoryLabel}`.toLowerCase()
  if (/restaurant|dining|fast[- ]?food/.test(value)) return 'Restaurant'
  if (/cafe|coffee|bakery|patisserie/.test(value)) return 'CafeOrCoffeeShop'
  if (/dental|dentist/.test(value)) return 'Dentist'
  if (/clinic|health|medical|pharmacy/.test(value)) return 'MedicalBusiness'
  if (/beauty|salon|hair|makeup/.test(value)) return 'BeautySalon'
  if (/spa|wellness|massage/.test(value)) return 'HealthAndBeautyBusiness'
  if (/hotel|resort|guest[- ]?house|hospitality/.test(value)) return 'Hotel'
  if (/real[- ]?estate|property/.test(value)) return 'RealEstateAgent'
  if (/professional|consult|law|account|agency|corporate/.test(value)) return 'ProfessionalService'
  if (/gym|fitness|trainer|crossfit|athletic/.test(value)) return 'SportsActivityLocation'
  if (/barber|barbershop/.test(value)) return 'BarberShop'
  return 'LocalBusiness'
}

function openingHoursSchema(hours: WeeklyHours | undefined): Record<string, unknown>[] | undefined {
  if (!hours) return undefined
  const result: Record<string, unknown>[] = []
  ;(Object.keys(DAY_NAMES) as (keyof WeeklyHours)[]).forEach(day => {
    const entry: OpeningHours | undefined = hours[day]
    if (!entry || entry.closed || !entry.open || !entry.close) return
    result.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_NAMES[day],
      opens: entry.open,
      closes: entry.close,
    })
  })
  return result.length > 0 ? result : undefined
}

function publicSocialLinks(business: Business): string[] | undefined {
  const links = [business.social.facebookUrl, business.social.instagramUrl, business.social.tiktokUrl]
    .map(value => safeHttpsUrl(value))
    .filter((value): value is string => Boolean(value))
  return links.length > 0 ? [...new Set(links)] : undefined
}

export function canonicalTenantUrl(slug: string, platformDomain = 'abrobiz.com'): string {
  const normalizedDomain = platformDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()
  return `https://${encodeURIComponent(slug.toLowerCase())}.${normalizedDomain}/`
}

export function generatedTenantTitle(business: Pick<Business, 'name' | 'seoTitle'>, categoryLabel?: string): string {
  const custom = cleanText(business.seoTitle)
  if (custom) return trimTo(custom, MAX_TITLE_LENGTH)
  const name = cleanText(business.name) || 'Business'
  const category = cleanText(categoryLabel)
  return trimTo(category && category.toLowerCase() !== 'business' ? `${name} | ${category}` : `${name} | AbroBiz`, MAX_TITLE_LENGTH)
}

export function generatedTenantDescription(
  business: Pick<Business, 'name' | 'description' | 'aboutContent' | 'seoDescription'>,
  categoryLabel?: string,
): string {
  const custom = cleanText(business.seoDescription)
  if (custom) return trimTo(custom, MAX_DESCRIPTION_LENGTH)
  const factual = cleanText(business.description) || cleanText(business.aboutContent)
  if (factual) return trimTo(factual, MAX_DESCRIPTION_LENGTH)
  const name = cleanText(business.name) || 'This business'
  const category = cleanText(categoryLabel)
  const suffix = category && category.toLowerCase() !== 'business' ? ` ${category.toLowerCase()}` : ''
  return trimTo(`${name} is a${/^[aeiou]/i.test(suffix.trim()) ? 'n' : ''}${suffix} on AbroBiz. Visit the official storefront for current information and contact details.`, MAX_DESCRIPTION_LENGTH)
}

export function isTenantIndexable(
  business: Pick<Business, 'isPublished' | 'isBlocked' | 'seoIndexingEnabled'>,
  siteActive: boolean,
): boolean {
  return business.isPublished && !business.isBlocked && siteActive && business.seoIndexingEnabled !== false
}

export function buildTenantSeo(
  business: Business,
  context: SeoContext,
  siteActive = false,
): TenantSeo {
  const title = generatedTenantTitle(business, context.categoryLabel)
  const description = generatedTenantDescription(business, context.categoryLabel)
  const indexable = isTenantIndexable(business, siteActive)
  const imageUrl = safeImageUrl(business.seoImageUrl) ?? safeImageUrl(business.coverUrl) ?? safeImageUrl(business.logoUrl) ?? undefined
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaTypeFor(context.categorySlug, context.categoryLabel),
    name: cleanText(business.name),
    description,
    url: context.canonicalUrl,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(cleanText(business.phone) ? { telephone: cleanText(business.phone) } : {}),
    ...(cleanText(business.email) ? { email: cleanText(business.email) } : {}),
    ...(cleanText(business.address) ? { address: cleanText(business.address) } : {}),
    ...(business.mapsUrl && safeHttpsUrl(business.mapsUrl) ? { hasMap: safeHttpsUrl(business.mapsUrl) } : {}),
    ...(publicSocialLinks(business) ? { sameAs: publicSocialLinks(business) } : {}),
    ...(openingHoursSchema(business.openingHours) ? { openingHoursSpecification: openingHoursSchema(business.openingHours) } : {}),
  }

  return {
    title,
    description,
    canonicalUrl: context.canonicalUrl,
    robots: indexable ? 'index,follow' : 'noindex,nofollow',
    imageUrl,
    schema,
    indexable,
  }
}

export interface PlatformSeo {
  title: string
  description: string
  canonicalUrl: string
  robots: 'index,follow' | 'noindex,nofollow'
  schema?: Record<string, unknown> | Record<string, unknown>[]
}

export function platformSeoForPath(pathname: string, siteUrl = 'https://abrobiz.com'): PlatformSeo {
  const base = siteUrl.replace(/\/+$/, '')
  const pages: Record<string, Omit<PlatformSeo, 'canonicalUrl'>> = {
    '/': {
      title: 'AbroBiz — Digital storefronts for every business',
      description: 'Create a polished business website, showcase your offerings, and connect with customers through AbroBiz.',
      robots: 'index,follow',
      schema: [
        { '@context': 'https://schema.org', '@type': 'Organization', name: 'AbroBiz', url: `${base}/`, logo: `${base}/favicon_io/android-chrome-192x192.png`, email: 'abdurezak4525@gmail.com' },
        { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AbroBiz', url: `${base}/`, description: 'Digital storefronts for growing businesses.' },
        { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'AbroBiz', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${base}/` },
      ],
    },
    '/about': { title: 'About AbroBiz — Bring your business online', description: 'Learn how AbroBiz helps businesses create, customize, and publish digital storefronts.', robots: 'index,follow' },
    '/contact': { title: 'Contact AbroBiz — Support for your storefront', description: 'Contact the AbroBiz support team for help with your account, website, and digital storefront.', robots: 'index,follow' },
    '/privacy': { title: 'Privacy Policy — AbroBiz', description: 'Read how AbroBiz handles account, business, storefront, and support information.', robots: 'index,follow' },
    '/terms': { title: 'Terms of Service — AbroBiz', description: 'Read the terms that apply to AbroBiz accounts, websites, plans, and storefronts.', robots: 'index,follow' },
  }
  const page = pages[pathname] ?? { title: 'Page not found — AbroBiz', description: 'The requested AbroBiz page could not be found.', robots: 'noindex,nofollow' as const }
  return { ...page, canonicalUrl: `${base}${pathname === '/' ? '/' : pathname}` }
}
