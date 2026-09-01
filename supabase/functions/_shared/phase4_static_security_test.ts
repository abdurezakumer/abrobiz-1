import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 4 storage upload validates ownership, bytes, path, and rate limits', async () => {
  const source = await read('../storage-upload/index.ts')
  assert.match(source, /readBinaryBody/)
  assert.match(source, /detectAllowedFile/)
  assert.match(source, /safeStoragePath/)
  assert.match(source, /X-Business-Id/)
  assert.match(source, /X-Upload-Bucket/)
  assert.match(source, /enforceRateLimits/)
  assert.match(source, /crypto\.randomUUID\(\)/)
  assert.match(source, /upsert: false/)
  assert.match(source, /Not found or not authorized/)
  assert.doesNotMatch(source, /req\.headers\.get\('X-File-Name'/)
})

Deno.test('Phase 4 shared file validation rejects active content and Telegram uses it', async () => {
  const fileSecurity = await read('./fileSecurity.ts')
  const telegram = await read('../telegram-webhook/index.ts')
  assert.match(fileSecurity, /image\/jpeg/)
  assert.match(fileSecurity, /application\/pdf/)
  assert.doesNotMatch(fileSecurity, /image\/svg\+xml|text\/html|application\/javascript/)
  assert.match(telegram, /detectAllowedFile/)
  assert.match(telegram, /telegram-payment-photo/)
})

Deno.test('Phase 4 storage signed URLs validate private paths and expire quickly', async () => {
  const source = await read('../storage-signed-url/index.ts')
  assert.match(source, /payment-proofs/)
  assert.match(source, /validUuid/)
  assert.match(source, /storage\.foldername|match = path\.match/)
  assert.match(source, /createSignedUrl\(path, 600, \{ download: true \}\)/)
  assert.match(source, /enforceRateLimits/)
  assert.match(source, /owner_id/)
})

Deno.test('Phase 4 migration denies browser writes and rejects unsafe object paths', async () => {
  const sql = await read('../../migrations/0029_phase4_storage_security.sql')
  assert.match(sql, /revoke insert, update, delete on storage\.objects from anon, authenticated/i)
  assert.match(sql, /payment_proofs_owner_or_admin_read/)
  assert.match(sql, /array_length\(storage\.foldername\(storage\.objects\.name\), 1\) = 1/)
  assert.match(sql, /storage\.filename\(storage\.objects\.name\)/)
  assert.doesNotMatch(sql, /create policy "payment_proofs_public_read"/i)
})

Deno.test('Phase 4 application uses the validated upload/download paths', async () => {
  const businesses = await read('../../../src/lib/api/businesses.ts')
  const items = await read('../../../src/lib/api/items.ts')
  const payments = await read('../../../src/lib/api/payments.ts')
  const submitPayment = await read('../submit-payment/index.ts')
  assert.match(businesses, /functions\.invoke\('storage-upload'/)
  assert.match(items, /functions\.invoke\('storage-upload'/)
  assert.match(payments, /functions\.invoke\('storage-upload'/)
  assert.match(payments, /functions\.invoke\('storage-signed-url'/)
  assert.doesNotMatch(payments, /storage\.from\('payment-proofs'\)\.createSignedUrl/)
  assert.match(submitPayment, /proofObjects/)
  assert.match(submitPayment, /proofMatch/)
})
