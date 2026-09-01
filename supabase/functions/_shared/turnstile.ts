import { corsHeaders } from './cors.ts'
import { readJsonResponse } from './external.ts'
import { logFailure } from './observability.ts'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000
const MAX_TOKEN_LENGTH = 2048
const MAX_RESPONSE_BYTES = 32 * 1024

export type TurnstileReason =
  | 'ok'
  | 'disabled'
  | 'missing-token'
  | 'invalid-token'
  | 'expired-or-duplicate'
  | 'wrong-action'
  | 'wrong-hostname'
  | 'unavailable'
  | 'misconfigured'

export type TurnstileResult = { ok: boolean; reason: TurnstileReason }
type Env = { get(name: string): string | undefined }
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function enabled(env: Env): boolean {
  return /^(1|true|yes|on)$/i.test(env.get('TURNSTILE_ENFORCE')?.trim() ?? '')
}

function safeAction(action: string): boolean {
  return /^[a-z0-9:_-]{1,64}$/.test(action)
}

function allowedHostnames(env: Env): string[] {
  return (env.get('TURNSTILE_ALLOWED_HOSTNAMES') ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase().replace(/\.$/, ''))
    .filter(value => /^(\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value))
}

function hostnameMatches(hostname: unknown, allowed: string[]): boolean {
  if (typeof hostname !== 'string') return false
  const value = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!value || value.includes(':') || value.includes('/')) return false
  return allowed.some(pattern => {
    if (pattern === value) return true
    if (!pattern.startsWith('*.')) return false
    const suffix = pattern.slice(1)
    const prefix = value.endsWith(suffix) ? value.slice(0, -suffix.length) : ''
    return prefix.length > 1 && prefix.endsWith('.') && !prefix.slice(0, -1).includes('.')
  })
}

function safeFailureCode(value: unknown): string {
  if (typeof value !== 'string') return 'unknown'
  return /^[a-z0-9-]{1,64}$/.test(value) ? value : 'unknown'
}

function resultForProviderFailure(errorCodes: unknown): TurnstileResult {
  const codes = Array.isArray(errorCodes) ? errorCodes.filter((code): code is string => typeof code === 'string') : []
  const expired = codes.some(code => /timeout-or-duplicate|timeout|duplicate/i.test(code))
  return { ok: false, reason: expired ? 'expired-or-duplicate' : 'invalid-token' }
}

async function verifyWithProvider(secret: string, token: string, fetcher: Fetcher): Promise<{ data?: any; reason?: TurnstileReason }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: controller.signal,
    })
    if (!response.ok) return { reason: 'unavailable' }
    try {
      return { data: await readJsonResponse(response, MAX_RESPONSE_BYTES) }
    } catch {
      return { reason: 'unavailable' }
    }
  } catch {
    return { reason: 'unavailable' }
  } finally {
    clearTimeout(timeout)
  }
}

/** Verify one Turnstile token exactly once. The token is never logged or persisted. */
export async function verifyTurnstile(
  req: Request,
  token: unknown,
  expectedAction: string,
  env: Env = Deno.env,
  fetcher: Fetcher = fetch,
): Promise<TurnstileResult> {
  if (!enabled(env)) return { ok: true, reason: 'disabled' }
  const secret = env.get('TURNSTILE_SECRET_KEY')?.trim() ?? ''
  const allowed = allowedHostnames(env)
  if (!secret || !safeAction(expectedAction) || allowed.length === 0) {
    logFailure(req, { function_name: 'shared-turnstile', operation: 'siteverify', error_category: 'CONFIGURATION_ERROR', error_code: 'misconfigured', status: 503 })
    return { ok: false, reason: 'misconfigured' }
  }
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'missing-token' }
  if (token.length > MAX_TOKEN_LENGTH || /[\u0000-\u001f\u007f]/.test(token)) return { ok: false, reason: 'invalid-token' }

  const provider = await verifyWithProvider(secret, token, fetcher)
  if (provider.reason) {
    if (provider.reason === 'unavailable') {
      logFailure(req, { function_name: 'shared-turnstile', operation: 'siteverify', error_category: 'DEPENDENCY_ERROR', provider: 'cloudflare-turnstile', outcome: 'unavailable', status: 503 })
    }
    return { ok: false, reason: provider.reason }
  }
  const data = provider.data
  if (!data || data.success !== true) {
    const result = resultForProviderFailure(data?.['error-codes'])
    logFailure(req, { function_name: 'shared-turnstile', operation: 'siteverify', error_category: 'AUTHENTICATION_ERROR', error_code: safeFailureCode(Array.isArray(data?.['error-codes']) ? data['error-codes'][0] : undefined), provider: 'cloudflare-turnstile', outcome: result.reason, status: 403 })
    return result
  }
  if (data.action !== expectedAction) return { ok: false, reason: 'wrong-action' }
  if (!hostnameMatches(data.hostname, allowed)) return { ok: false, reason: 'wrong-hostname' }
  return { ok: true, reason: 'ok' }
}

/** Return a generic response for a failed high-risk anonymous request. */
export async function requireTurnstile(req: Request, token: unknown, action: string): Promise<Response | null> {
  const result = await verifyTurnstile(req, token, action)
  if (result.ok) return null
  return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
    status: result.reason === 'misconfigured' || result.reason === 'unavailable' ? 503 : 403,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
