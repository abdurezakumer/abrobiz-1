import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const baseUrl = Deno.env.get('PHASE5_TEST_FUNCTION_BASE_URL')
const anonKey = Deno.env.get('PHASE5_TEST_SUPABASE_ANON_KEY')
const userToken = Deno.env.get('PHASE5_TEST_USER_TOKEN')
const otherBusinessId = Deno.env.get('PHASE5_TEST_OTHER_BUSINESS_ID')

function enabled(): boolean {
  return Boolean(baseUrl && anonKey && userToken && otherBusinessId)
}

async function call(name: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}/functions/v1/${name}`, {
    ...options,
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
}

Deno.test('Phase 5 rejects missing authentication on privileged functions', async () => {
  if (!baseUrl || !anonKey) return
  const response = await fetch(`${baseUrl}/functions/v1/send-verification-email`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: '{}',
  })
  assertEquals(response.status, 401)
})

Deno.test('Phase 5 rejects malformed bearer headers', async () => {
  if (!baseUrl || !anonKey) return
  const response = await fetch(`${baseUrl}/functions/v1/storage-signed-url`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Basic not-a-bearer', 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'not-a-valid-path' }),
  })
  assertEquals(response.status, 401)
})

Deno.test('Phase 5 rejects wrong methods and content types', async () => {
  if (!baseUrl || !anonKey) return
  const getResponse = await fetch(`${baseUrl}/functions/v1/submit-contact`, { method: 'GET', headers: { apikey: anonKey } })
  assertEquals(getResponse.status, 405)
  const contentResponse = await fetch(`${baseUrl}/functions/v1/submit-contact`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'text/plain' },
    body: 'not-json',
  })
  assertEquals(contentResponse.status, 415)
})

Deno.test('Phase 5 rejects tenant spoofing on authenticated storage upload', async () => {
  if (!enabled()) return
  const response = await call('storage-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg', 'X-Upload-Bucket': 'logos', 'X-Business-Id': otherBusinessId! },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  })
  assertEquals(response.status, 403)
})

Deno.test('Phase 5 cron rejects missing and incorrect secrets', async () => {
  if (!baseUrl || !anonKey) return
  const missing = await fetch(`${baseUrl}/functions/v1/subscription-cron`, { method: 'POST', headers: { apikey: anonKey } })
  assertEquals(missing.status, 503)
  const invalid = await fetch(`${baseUrl}/functions/v1/subscription-cron`, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer invalid' } })
  assertEquals(invalid.status, 401)
})
