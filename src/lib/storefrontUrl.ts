import { resolveTenantRequest } from './tenantHostname'

export function platformDomain(): string {
  return (import.meta.env.VITE_PLATFORM_DOMAIN || 'abrobiz.com').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function businessSlugFromHostname(hostname: string = window.location.hostname): string | null {
  const protocol = hostname === window.location.hostname ? window.location.protocol : 'https:'
  const resolution = resolveTenantRequest(hostname, protocol, platformDomain())
  return resolution.kind === 'tenant' ? resolution.slug : null
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
