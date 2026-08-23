import { RESERVED_BUSINESS_SLUGS } from './slugify'

const RESERVED_SUBDOMAINS = RESERVED_BUSINESS_SLUGS

export function platformDomain(): string {
  return (import.meta.env.VITE_PLATFORM_DOMAIN || 'abrobiz.com').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function businessSlugFromHostname(hostname: string = window.location.hostname): string | null {
  const normalized = hostname.toLowerCase().split(':')[0]
  const domain = platformDomain().toLowerCase()

  if (normalized.endsWith(`.${domain}`)) {
    const prefix = normalized.slice(0, -(domain.length + 1))
    const labels = prefix.split('.').filter(Boolean)
    const subdomain = labels.length === 1 ? labels[0] : labels[0] === 'www' && labels.length === 2 ? labels[1] : null
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) return subdomain
  }

  // Convenient local equivalent: cafe.localhost:5173.
  if (normalized.endsWith('.localhost')) {
    const prefix = normalized.slice(0, -'.localhost'.length)
    const labels = prefix.split('.').filter(Boolean)
    const subdomain = labels.length === 1 ? labels[0] : labels[0] === 'www' && labels.length === 2 ? labels[1] : null
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) return subdomain
  }

  return null
}

export function isBusinessSubdomain(hostname: string = window.location.hostname): boolean {
  return businessSlugFromHostname(hostname) !== null
}

export function storefrontPath(slug: string, path = '', hostname: string = window.location.hostname): string {
  const base = isBusinessSubdomain(hostname) ? '' : `/r/${slug}`
  const normalizedPath = path ? `/${path.replace(/^\//, '')}` : ''
  return `${base}${normalizedPath}` || '/'
}

export function publicStorefrontUrl(slug: string): string {
  const hostname = window.location.hostname.toLowerCase()
  const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:'

  if (hostname.endsWith('.localhost') || hostname === 'localhost' || hostname === '127.0.0.1') {
    const port = window.location.port ? `:${window.location.port}` : ''
    return `${protocol}//${slug}.localhost${port}/`
  }

  return `https://${slug}.${platformDomain()}/`
}
