/* eslint-disable @typescript-eslint/no-explicit-any, no-control-regex */
/* Shared, dependency-free helpers for Vercel's public SEO endpoints. */

export type SeoBusiness = {
  name: string
  slug: string
  description?: string
  aboutContent?: string
  logoUrl?: string
  coverUrl?: string
  phone?: string
  email?: string
  address?: string
  mapsUrl?: string
  social?: Record<string, unknown>
  openingHours?: Record<string, { open?: string; close?: string; closed?: boolean }>
  seoTitle?: string
  seoDescription?: string
  seoImageUrl?: string
  seoIndexingEnabled?: boolean
  category?: { slug?: string; label?: string }
}

export const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN || process.env.VITE_PLATFORM_DOMAIN || 'abrobiz.com').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()
export const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || `https://${PLATFORM_DOMAIN}`).replace(/\/+$/, '')
const RESERVED = new Set(['www', 'app', 'admin', 'api', 'mail', 'smtp', 'auth', 'dashboard', 'login', 'register', 'setup', 'support', 'status', 'static', 'cdn', 'ftp', 'dev', 'staging', 'test', 'billing', 'payments', 'storage', 'assets'])

export function hostOf(req: any): string {
  return String(req.headers?.host || '').toLowerCase().split(':')[0].replace(/\.$/, '')
}

export function tenantSlugOf(req: any): string | null {
  const host = hostOf(req)
  const suffix = `.${PLATFORM_DOMAIN}`
  if (!host.endsWith(suffix)) return null
  const slug = host.slice(0, -suffix.length)
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug) || RESERVED.has(slug)) return null
  return slug
}

export async function supabaseRpc(name: string, body: Record<string, unknown>): Promise<any> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SEO endpoint is not configured')
  const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`SEO data request failed: ${response.status}`)
  return response.json()
}

export function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

export function trimTo(value: string, length: number): string {
  if (value.length <= length) return value
  const shortened = value.slice(0, length - 1).replace(/\s+\S*$/, '').trim()
  return `${shortened || value.slice(0, length - 1).trim()}…`
}

export function canonical(slug: string): string {
  return `https://${slug}.${PLATFORM_DOMAIN}/`
}

export function titleFor(business: SeoBusiness): string {
  const custom = clean(business.seoTitle)
  if (custom) return trimTo(custom, 60)
  const name = clean(business.name) || 'Business'
  const category = clean(business.category?.label)
  return trimTo(category && category.toLowerCase() !== 'business' ? `${name} | ${category}` : `${name} | AbroBiz`, 60)
}

export function descriptionFor(business: SeoBusiness): string {
  const custom = clean(business.seoDescription)
  if (custom) return trimTo(custom, 160)
  const factual = clean(business.description) || clean(business.aboutContent)
  if (factual) return trimTo(factual, 160)
  return trimTo(`${clean(business.name) || 'This business'} on AbroBiz. Visit the official storefront for current information and contact details.`, 160)
}

export function imageFor(business: SeoBusiness): string | null {
  const value = clean(business.seoImageUrl) || clean(business.coverUrl) || clean(business.logoUrl)
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export function schemaTypeFor(business: SeoBusiness): string {
  const value = `${clean(business.category?.slug)} ${clean(business.category?.label)}`.toLowerCase()
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

export function schemaFor(business: SeoBusiness, url: string, description: string, image: string | null): Record<string, unknown> {
  const social = Object.values(business.social || {}).filter(value => typeof value === 'string' && /^https:\/\//i.test(value))
  const schema: Record<string, unknown> = { '@context': 'https://schema.org', '@type': schemaTypeFor(business), name: clean(business.name), description, url, ...(image ? { image } : {}), ...(clean(business.phone) ? { telephone: clean(business.phone) } : {}), ...(clean(business.email) ? { email: clean(business.email) } : {}), ...(clean(business.address) ? { address: clean(business.address) } : {}), ...(social.length ? { sameAs: [...new Set(social)] } : {}) }
  const hours = Object.entries(business.openingHours || {}).flatMap(([day, value]) => value?.closed || !value?.open || !value?.close ? [] : [{ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: value.open, closes: value.close }])
  if (hours.length) schema.openingHoursSpecification = hours
  return schema
}

export function htmlEscape(value: unknown): string {
  return clean(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

export function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function send(res: any, status: number, contentType: string, body: string, extra: Record<string, string> = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', contentType)
  Object.entries(extra).forEach(([key, value]) => res.setHeader(key, value))
  res.end(body)
}

export function xmlEscape(value: unknown): string {
  return clean(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] || char))
}

export async function publicBusinessForRequest(req: any): Promise<SeoBusiness | null> {
  const slug = tenantSlugOf(req)
  if (!slug) return null
  const data = await supabaseRpc('get_public_business_seo', { p_slug: slug })
  return data && typeof data === 'object' && !Array.isArray(data) ? data as SeoBusiness : null
}
