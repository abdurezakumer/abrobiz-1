/* OAuth 2.1 helpers for the AbroBiz MCP connector. Server-side only. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const MCP_RESOURCE = 'https://abrobiz.com/api/mcp'
export const OAUTH_SCOPES = ['mcp:tools', 'mcp:read', 'mcp:drafts:write'] as const
export type OAuthScope = typeof OAUTH_SCOPES[number]

export function appOrigin(): string {
  const candidate = process.env.SITE_URL || process.env.APP_URL || 'https://abrobiz.com'
  const parsed = new URL(candidate)
  const dev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test'
  if (parsed.protocol !== 'https:' && !(dev && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('OAuth site URL must use HTTPS')
  }
  if (!dev && !['abrobiz.com', 'www.abrobiz.com'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('OAuth site URL host is not permitted')
  }
  return parsed.origin
}

export function oauthResource(): string {
  return `${appOrigin()}/api/mcp`
}

export function oauthAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('OAuth service is not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function newOpaqueToken(prefix = 'abz_mcp_'): string {
  return `${prefix}${randomBytes(32).toString('hex')}`
}

export function validRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  if (value === 'https://claude.ai/api/mcp/auth_callback') return true
  try {
    const uri = new URL(value)
    if (uri.username || uri.password || uri.hash) return false
    const dev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test'
    return dev && uri.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)
  } catch {
    return false
  }
}

export function requestedScopes(value: unknown): OAuthScope[] | null {
  if (value === undefined || value === null || value === '') return ['mcp:read']
  if (typeof value !== 'string' || value.length > 200) return null
  const parts = [...new Set(value.split(/[\s,]+/).filter(Boolean))]
  if ((!parts.includes('mcp:read') && !parts.includes('mcp:tools')) || parts.length > OAUTH_SCOPES.length || parts.some(scope => !OAUTH_SCOPES.includes(scope as OAuthScope))) return null
  return parts as OAuthScope[]
}

export function validPkceChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value)
}

export function verifyPkce(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false
  const actual = createHash('sha256').update(verifier, 'utf8').digest('base64url')
  return actual.length === challenge.length && timingSafeTextEqual(actual, challenge)
}

function timingSafeTextEqual(a: string, b: string): boolean {
  // Compare fixed-length SHA-256-derived values without leaking the first
  // mismatching character via timing. Length is checked before this helper.
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

export function appendAuthorizationResult(redirectUri: string, params: Record<string, string>): string {
  const target = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value)
  return target.toString()
}

export function readString(value: unknown, maxLength = 2048): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null
}

export function readRequestBody(req: any, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  return (async () => {
    const body = req.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) throw new Error('Request body too large')
      return body as Record<string, unknown>
    }
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const raw = body.toString()
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('Request body too large')
      return parseBody(raw, String(req.headers?.['content-type'] ?? ''))
    }
    if (typeof req[Symbol.asyncIterator] === 'function') {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length
        if (size > maxBytes) throw new Error('Request body too large')
        chunks.push(buffer)
      }
      return parseBody(Buffer.concat(chunks).toString('utf8'), String(req.headers?.['content-type'] ?? ''))
    }
    return {}
  })()
}

function parseBody(raw: string, contentType: string): Record<string, unknown> {
  if (!raw) return {}
  if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries())
  }
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

export function rateLimitKey(req: any, suffix: string): string {
  const raw = String(req.headers?.['x-real-ip'] ?? '').trim().slice(0, 80) || 'unknown'
  return `mcp-oauth:${suffix}:${sha256(raw).slice(0, 32)}`
}

export async function enforceOAuthRateLimit(db: any, req: any, suffix: string, limit: number, windowSeconds: number) {
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_key: rateLimitKey(req, suffix),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error || data !== true) throw new Error('OAuth request limit reached')
}

export function setOAuthHeaders(res: any, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

export function preflight(res: any) {
  setOAuthHeaders(res, 204)
  res.end()
}

export function sendJson(res: any, status: number, body: unknown) {
  setOAuthHeaders(res, status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(body)
}

export function requestUrl(req: any): URL {
  const host = String(req.headers?.host ?? 'abrobiz.com').split(',')[0].trim()
  const proto = String(req.headers?.['x-forwarded-proto'] ?? 'https').split(',')[0].trim()
  return new URL(String(req.url ?? '/'), `${proto}://${host}`)
}

export function requestHostAllowed(req: any): boolean {
  const host = String(req.headers?.host ?? '').toLowerCase().split(':')[0].replace(/\.$/, '')
  const configured = (process.env.MCP_ALLOWED_HOSTS || 'abrobiz.com,www.abrobiz.com').split(',').map(value => value.trim().toLowerCase())
  const dev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test'
  return configured.includes(host) || (dev && ['localhost', '127.0.0.1'].includes(host))
}

export function requestOriginAllowed(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    if (parsed.origin === appOrigin() || ['https://abrobiz.com', 'https://www.abrobiz.com'].includes(parsed.origin)) return true
    const dev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test'
    return dev && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

export function userIdFromJwtPayload(accessToken: string): string | null {
  try {
    const segment = accessToken.split('.')[1]
    if (!segment) return null
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export function assuranceLevelFromJwtPayload(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.aal === 'string' ? payload.aal : null
  } catch {
    return null
  }
}

export type ResolvedAuthorizationRequest = {
  clientId: string
  clientName: string
  clientUri: string | null
  redirectUri: string
  resource: string
  state: string
  codeChallenge: string
  scopes: OAuthScope[]
}

export async function resolveAuthorizationRequest(db: any, input: Record<string, unknown>): Promise<ResolvedAuthorizationRequest> {
  const clientId = readString(input.client_id, 80)
  const redirectUri = readString(input.redirect_uri, 2048)
  const state = readString(input.state, 1024)
  const codeChallenge = readString(input.code_challenge, 128)
  const scopes = requestedScopes(input.scope)
  if (!clientId || !redirectUri || !state || !codeChallenge || !scopes) throw new Error('Invalid OAuth authorization request')
  if (input.response_type !== 'code' || input.code_challenge_method !== 'S256' || !validPkceChallenge(codeChallenge)) {
    throw new Error('Unsupported OAuth authorization request')
  }
  if (!validRedirectUri(redirectUri)) throw new Error('Invalid OAuth redirect URI')
  const resource = readString(input.resource, 2048) ?? oauthResource()
  if (resource !== oauthResource()) throw new Error('Invalid OAuth resource')
  const { data: client, error } = await db.from('mcp_oauth_clients')
    .select('id, client_name, client_uri, redirect_uris, revoked_at')
    .eq('id', clientId)
    .is('revoked_at', null)
    .maybeSingle()
  if (error || !client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    throw new Error('OAuth client or redirect URI is not registered')
  }
  return {
    clientId: client.id,
    clientName: String(client.client_name || 'MCP connector').slice(0, 120),
    clientUri: typeof client.client_uri === 'string' ? client.client_uri : null,
    redirectUri,
    resource,
    state,
    codeChallenge,
    scopes,
  }
}
