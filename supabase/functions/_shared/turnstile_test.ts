import { assert, assertEquals } from 'jsr:@std/assert@1'
import { verifyTurnstile } from './turnstile.ts'

const request = new Request('https://abrobiz.com/functions/v1/test', { method: 'POST' })
const env = (values: Record<string, string>): { get: (name: string) => string | undefined } => ({ get: name => values[name] })
const configured = env({ TURNSTILE_ENFORCE: 'true', TURNSTILE_SECRET_KEY: 'test-only-secret', TURNSTILE_ALLOWED_HOSTNAMES: 'abrobiz.com,*.abrobiz.com' })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.test('Turnstile is disabled without enforcement', async () => {
  const result = await verifyTurnstile(request, undefined, 'signup', env({ TURNSTILE_ENFORCE: 'false' }), () => Promise.reject(new Error('must not call provider')))
  assertEquals(result, { ok: true, reason: 'disabled' })
})

Deno.test('Turnstile fails closed for missing or oversized tokens', async () => {
  assertEquals(await verifyTurnstile(request, undefined, 'signup', configured, () => Promise.reject(new Error('must not call provider'))), { ok: false, reason: 'missing-token' })
  assertEquals(await verifyTurnstile(request, 'x'.repeat(2049), 'signup', configured, () => Promise.reject(new Error('must not call provider'))), { ok: false, reason: 'invalid-token' })
})

Deno.test('Turnstile accepts a provider success only for the expected action and tenant hostname', async () => {
  const fetcher = async () => response({ success: true, action: 'signup', hostname: 'cafe.abrobiz.com' })
  assertEquals(await verifyTurnstile(request, 'valid-token', 'signup', configured, fetcher), { ok: true, reason: 'ok' })
  assertEquals(await verifyTurnstile(request, 'valid-token', 'login', configured, fetcher), { ok: false, reason: 'wrong-action' })
  assertEquals(await verifyTurnstile(request, 'valid-token', 'signup', configured, async () => response({ success: true, action: 'signup', hostname: 'evil.example' })), { ok: false, reason: 'wrong-hostname' })
})

Deno.test('Turnstile maps provider rejection and malformed/failed requests safely', async () => {
  assertEquals(await verifyTurnstile(request, 'expired', 'signup', configured, async () => response({ success: false, 'error-codes': ['timeout-or-duplicate'] })), { ok: false, reason: 'expired-or-duplicate' })
  assertEquals(await verifyTurnstile(request, 'invalid', 'signup', configured, async () => response({ success: false, 'error-codes': ['invalid-input-response'] })), { ok: false, reason: 'invalid-token' })
  assertEquals(await verifyTurnstile(request, 'bad-json', 'signup', configured, async () => new Response('{', { status: 200 })), { ok: false, reason: 'unavailable' })
  assertEquals(await verifyTurnstile(request, 'down', 'signup', configured, async () => { throw new Error('timeout') }), { ok: false, reason: 'unavailable' })
  assert(await verifyTurnstile(request, 'server-error', 'signup', configured, async () => response({}, 503)).then(result => result.reason === 'unavailable'))
})

Deno.test('Turnstile requires server configuration when enforcement is enabled', async () => {
  const result = await verifyTurnstile(request, 'valid-token', 'signup', env({ TURNSTILE_ENFORCE: 'true' }), () => Promise.reject(new Error('must not call provider')))
  assertEquals(result, { ok: false, reason: 'misconfigured' })
})
