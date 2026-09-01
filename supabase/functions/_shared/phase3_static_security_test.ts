import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 3 public functions enforce method, body, and rate controls', async () => {
  const publicFunctions = [
    '../login/index.ts',
    '../signup/index.ts',
    '../verify-signup-otp/index.ts',
    '../resend-signup-otp/index.ts',
    '../request-password-reset/index.ts',
    '../reset-password/index.ts',
    '../submit-contact/index.ts',
    '../submit-booking/index.ts',
    '../submit-review/index.ts',
    '../submit-order/index.ts',
    '../submit-payment/index.ts',
    '../send-announcement/index.ts',
    '../import-template/index.ts',
    '../notify-payment-submitted/index.ts',
    '../track-page-view/index.ts',
  ]
  for (const path of publicFunctions) {
    const source = await read(path)
    assert.match(source, /req\.method !== 'POST'/, path)
    assert.match(source, /readJsonBody\(/, path)
    assert.match(source, /enforceRateLimit/, path)
  }
  const verification = await read('../send-verification-email/index.ts')
  assert.match(verification, /req\.method !== 'POST'/)
  assert.match(verification, /enforceRateLimit/)
})

Deno.test('Phase 3 migration closes direct public write bypasses', async () => {
  const sql = await read('../../migrations/0028_phase3_abuse_hardening.sql')
  assert.match(sql, /revoke insert on public\.contact_messages, public\.bookings, public\.reviews from anon, authenticated/i)
  assert.match(sql, /revoke execute on function public\.submit_order\(/i)
  assert.match(sql, /request_idempotency/)
  assert.match(sql, /submit_order_idempotent/)
  assert.match(sql, /submit_payment_idempotent/)
  assert.match(sql, /prevent_duplicate_pending_payment/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /Gallery URLs must use HTTPS/)
  assert.match(sql, /profiles_phase3_lengths/)
  assert.match(sql, /plans_phase3_limits/)
  assert.match(sql, /templates_validate_urls/)
  assert.match(sql, /Item image URL must use HTTPS/)
})

Deno.test('Phase 3 external requests are bounded', async () => {
  const external = await read('./external.ts')
  const mailer = await read('./mailer.ts')
  const telegram = await read('./telegram.ts')
  const importer = await read('../import-template/index.ts')
  assert.match(external, /AbortController/)
  assert.match(external, /maxBytes/)
  assert.match(mailer, /fetchWithTimeout/)
  assert.match(telegram, /fetchWithTimeout/)
  assert.match(telegram, /10 \* 1024 \* 1024/)
  assert.match(importer, /readJsonResponse/)
})

Deno.test('Phase 3 frontend no longer uses direct public mutation paths', async () => {
  const messages = await read('../../../src/lib/api/messages.ts')
  const bookings = await read('../../../src/lib/api/bookings.ts')
  const reviews = await read('../../../src/lib/api/reviews.ts')
  const orders = await read('../../../src/lib/api/orders.ts')
  const payments = await read('../../../src/lib/api/payments.ts')
  assert.match(messages, /functions\.invoke\('submit-contact'/)
  assert.match(bookings, /functions\.invoke\('submit-booking'/)
  assert.match(reviews, /functions\.invoke\('submit-review'/)
  assert.match(orders, /functions\.invoke\('submit-order'/)
  assert.match(payments, /functions\.invoke\('submit-payment'/)
})
