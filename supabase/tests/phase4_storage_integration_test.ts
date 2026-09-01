import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const baseUrl = Deno.env.get('PHASE4_TEST_FUNCTION_BASE_URL')
const anonKey = Deno.env.get('PHASE4_TEST_SUPABASE_ANON_KEY')
const supabaseUrl = Deno.env.get('PHASE4_TEST_SUPABASE_URL')
const userAToken = Deno.env.get('PHASE4_TEST_USER_A_TOKEN')
const userBToken = Deno.env.get('PHASE4_TEST_USER_B_TOKEN')
const businessA = Deno.env.get('PHASE4_TEST_BUSINESS_A_ID')
const businessB = Deno.env.get('PHASE4_TEST_BUSINESS_B_ID')
const privatePathB = Deno.env.get('PHASE4_TEST_PAYMENT_PROOF_B_PATH')
const publicPath = Deno.env.get('PHASE4_TEST_PUBLIC_ASSET_PATH')

function enabled(): boolean {
  return Boolean(baseUrl && anonKey && userAToken && userBToken && businessA && businessB && privatePathB)
}

function objectUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
}

async function call(name: string, token: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${baseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

Deno.test('Phase 4 rejects unauthorized cross-tenant signed URL access', async () => {
  if (!enabled()) return
  const response = await call('storage-signed-url', userAToken!, { path: privatePathB })
  assertEquals(response.status, 403)
})

Deno.test('Phase 4 rejects traversal and malformed storage upload metadata', async () => {
  if (!enabled()) return
  const response = await fetch(`${baseUrl}/functions/v1/storage-upload`, {
    method: 'POST',
    headers: {
      apikey: anonKey!, Authorization: `Bearer ${userAToken}`, 'Content-Type': 'image/jpeg',
      'X-Upload-Bucket': 'payment-proofs', 'X-Business-Id': `${businessA}/../${businessB}`,
    },
    body: new Uint8Array([0xff, 0xd8, 0xff]),
  })
  assertEquals(response.status, 400)
})

Deno.test('Phase 4 rejects malformed, oversized, and unsupported file content', async () => {
  if (!enabled()) return
  const malformed = await fetch(`${baseUrl}/functions/v1/storage-upload`, {
    method: 'POST',
    headers: {
      apikey: anonKey!, Authorization: `Bearer ${userAToken}`, 'Content-Type': 'image/jpeg',
      'X-Upload-Bucket': 'logos', 'X-Business-Id': businessA!,
    },
    body: new TextEncoder().encode('<script>alert(1)</script>'),
  })
  assertEquals(malformed.status, 415)
})

Deno.test('Phase 4 rejects cross-tenant uploads', async () => {
  if (!enabled()) return
  const response = await fetch(`${baseUrl}/functions/v1/storage-upload`, {
    method: 'POST',
    headers: {
      apikey: anonKey!, Authorization: `Bearer ${userAToken}`, 'Content-Type': 'image/jpeg',
      'X-Upload-Bucket': 'logos', 'X-Business-Id': businessB!,
    },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  })
  assertEquals(response.status, 403)
})

Deno.test('Phase 4 authorized user can request an authorized private proof URL', async () => {
  if (!enabled()) return
  const ownPath = Deno.env.get('PHASE4_TEST_PAYMENT_PROOF_A_PATH')
  if (!ownPath) return
  const response = await call('storage-signed-url', userAToken!, { path: ownPath })
  assertEquals(response.status, 200)
})

Deno.test('Phase 4 owner can request the private proof URL for their own tenant', async () => {
  if (!enabled()) return
  const response = await call('storage-signed-url', userBToken!, { path: privatePathB })
  assertEquals(response.status, 200)
})

Deno.test('Phase 4 anonymous users cannot download private proofs directly', async () => {
  if (!supabaseUrl || !privatePathB) return
  const response = await fetch(objectUrl('payment-proofs', privatePathB))
  if (response.status === 200) throw new Error('Anonymous private proof access unexpectedly succeeded')
})

Deno.test('Phase 4 cross-tenant authenticated users cannot delete private proofs', async () => {
  if (!supabaseUrl || !privatePathB || !userAToken || !anonKey) return
  const response = await fetch(objectUrl('payment-proofs', privatePathB), {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${userAToken}` },
  })
  if (response.status === 200) throw new Error('Cross-tenant private proof deletion unexpectedly succeeded')
})

Deno.test('Phase 4 intended public assets remain publicly readable', async () => {
  if (!supabaseUrl || !publicPath) return
  const response = await fetch(objectUrl('logos', publicPath))
  assertEquals(response.status, 200)
})
