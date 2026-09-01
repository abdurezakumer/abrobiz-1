import { requestId } from './observability.ts'

const PLATFORM_DOMAIN = 'abrobiz.com'
const defaultOrigins = [
  'https://abrobiz.com',
  'https://www.abrobiz.com',
]

function configuredOrigins(): string[] {
  const configured = Deno.env.get('CORS_ALLOWED_ORIGINS')
  const values = configured?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  // A wildcard is never accepted as a trusted origin.
  return values.filter(value => value !== '*')
}

function isStrictOrigin(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.origin === value && parsed.pathname === '/' && parsed.search === '' && parsed.hash === ''
  } catch {
    return false
  }
}

function isSafeConfiguredOrigin(value: string): boolean {
  if (!isStrictOrigin(value)) return false
  const parsed = new URL(value)
  if (parsed.protocol === 'https:') return true
  return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
}

/** Tenant CORS is limited to one HTTPS DNS label under the platform domain. */
export function isAllowedTenantOrigin(origin: string): boolean {
  if (!isStrictOrigin(origin)) return false
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:') return false
  const suffix = `.${PLATFORM_DOMAIN}`
  if (!parsed.hostname.endsWith(suffix)) return false
  const label = parsed.hostname.slice(0, -suffix.length)
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !label.includes('.')
}

export function isAllowedOrigin(origin: string | null, configured = configuredOrigins()): boolean {
  if (!origin || !isStrictOrigin(origin)) return false
  if ([...defaultOrigins, ...configured.filter(isSafeConfiguredOrigin)].includes(origin)) return true
  return isAllowedTenantOrigin(origin)
}

/** Return a browser-safe CORS policy for the requesting origin. */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin')
  const configured = configuredOrigins()
  const responseOrigin = !origin
    ? defaultOrigins[0]
    : isAllowedOrigin(origin, configured)
      ? origin
      : undefined
  return {
    ...(responseOrigin ? { 'Access-Control-Allow-Origin': responseOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-business-id, x-upload-bucket',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...(req ? { 'X-Request-ID': requestId(req) } : {}),
  }
}
