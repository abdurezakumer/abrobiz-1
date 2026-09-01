import { RESERVED_BUSINESS_SLUGS, isValidBusinessSlug } from './slugify'

export type HostResolution =
  | { kind: 'root'; hostname: string }
  | { kind: 'tenant'; hostname: string; slug: string }
  | { kind: 'invalid'; hostname: string; reason: string }

const SAFE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Normalizes a browser/forwarded host without accepting paths or user info. */
export function normalizeHostname(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\.$/, '')
  if (!raw || /[\u0000-\u0020\u007f/\\@]/.test(raw)) return null

  let hostname = raw
  const colon = raw.lastIndexOf(':')
  if (colon !== -1) {
    const port = raw.slice(colon + 1)
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null
    hostname = raw.slice(0, colon)
  }
  if (hostname.includes(':') || hostname.length > 253) return null
  const labels = hostname.split('.')
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
  return hostname
}

function validPlatformDomain(domain: string): boolean {
  return SAFE_DOMAIN.test(domain) && !domain.includes('..')
}

/** Resolves only the configured platform domain and explicit local development hosts. */
export function resolveTenantHostname(hostname: string, platformDomain = 'abrobiz.com'): HostResolution {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return { kind: 'invalid', hostname: '', reason: 'invalid-hostname' }
  const domain = platformDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.$/, '')
  if (!validPlatformDomain(domain)) return { kind: 'invalid', hostname: normalized, reason: 'invalid-platform-domain' }

  if (normalized === domain || normalized === `www.${domain}` || normalized === 'localhost' || normalized === '127.0.0.1') {
    return { kind: 'root', hostname: normalized }
  }

  const bases = [domain, 'localhost']
  for (const base of bases) {
    if (!normalized.endsWith(`.${base}`)) continue
    const prefix = normalized.slice(0, -(base.length + 1))
    const labels = prefix.split('.')
    // Keep the existing www.<tenant> development/canonical alias, but reject
    // arbitrary multi-level hostnames and never treat www itself as a tenant.
    const slug = labels.length === 1 ? labels[0] : labels.length === 2 && labels[0] === 'www' ? labels[1] : null
    if (!slug) return { kind: 'invalid', hostname: normalized, reason: 'nested-subdomain' }
    if (RESERVED_BUSINESS_SLUGS.has(slug)) return { kind: 'invalid', hostname: normalized, reason: 'reserved-subdomain' }
    if (!isValidBusinessSlug(slug)) return { kind: 'invalid', hostname: normalized, reason: 'invalid-tenant-slug' }
    return { kind: 'tenant', hostname: normalized, slug }
  }

  return { kind: 'invalid', hostname: normalized, reason: 'untrusted-domain' }
}

/** Applies the production HTTPS requirement while preserving local HTTP dev. */
export function resolveTenantRequest(hostname: string, protocol: string, platformDomain = 'abrobiz.com'): HostResolution {
  const resolution = resolveTenantHostname(hostname, platformDomain)
  const normalizedDomain = platformDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.$/, '')
  const productionHost = resolution.hostname === normalizedDomain || resolution.hostname.endsWith(`.${normalizedDomain}`)
  if (productionHost && protocol !== 'https:') return { kind: 'invalid', hostname: resolution.hostname, reason: 'https-required' }
  return resolution
}

export function tenantHostname(slug: string, platformDomain = 'abrobiz.com'): string | null {
  const domain = platformDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.$/, '')
  if (!validPlatformDomain(domain) || !isValidBusinessSlug(slug)) return null
  return `${slug}.${domain}`
}
