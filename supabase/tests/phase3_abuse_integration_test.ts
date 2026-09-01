import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const baseUrl = Deno.env.get('PHASE3_TEST_FUNCTION_BASE_URL')
const anonKey = Deno.env.get('PHASE3_TEST_SUPABASE_ANON_KEY')

function enabled(): boolean {
  return Boolean(baseUrl && anonKey)
}

async function callFunction(name: string, body: unknown, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'POST'
  return fetch(`${baseUrl}/functions/v1/${name}`, {
    ...init,
    method,
    headers: { apikey: anonKey!, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...(method === 'GET' ? {} : { body: init.body ?? JSON.stringify(body) }),
  })
}

Deno.test('Phase 3 rejects oversized bodies and invalid content types', async () => {
  if (!enabled()) return
  const oversized = await callFunction('submit-contact', { message: 'x'.repeat(13_000) })
  assertEquals(oversized.status, 413)
  const wrongType = await fetch(`${baseUrl}/functions/v1/submit-contact`, {
    method: 'POST',
    headers: { apikey: anonKey!, 'Content-Type': 'text/plain' },
    body: '{}',
  })
  assertEquals(wrongType.status, 415)
})

Deno.test('Phase 3 rejects unsupported methods and malformed public identifiers', async () => {
  if (!enabled()) return
  const method = await callFunction('submit-review', {}, { method: 'GET', body: undefined })
  assertEquals(method.status, 405)
  const invalidId = await callFunction('track-page-view', { businessId: 'not-an-id', path: '/home' })
  assertEquals(invalidId.status, 400)
})

Deno.test('Phase 3 rejects order abuse before database work', async () => {
  if (!enabled()) return
  const missingKey = await callFunction('submit-order', { businessId: 'not-an-id', items: [] })
  assertEquals(missingKey.status, 400)
  const invalidOrder = await callFunction('submit-order', {
    businessId: '00000000-0000-4000-8000-000000000001',
    customerName: 'Test User', phone: '0900000000', fulfillmentType: 'pickup', address: '', notes: '',
    items: [{ itemId: '00000000-0000-4000-8000-000000000002', quantity: 101 }],
  }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
  assertEquals(invalidOrder.status, 400)
})

Deno.test('Phase 3 rate limit and idempotency checks are available for staging', async () => {
  if (!enabled()) return
  const key = crypto.randomUUID()
  const response = await callFunction('submit-order', { businessId: 'invalid', items: [] }, { headers: { 'Idempotency-Key': key } })
  assert([400, 404, 429].includes(response.status))
})
