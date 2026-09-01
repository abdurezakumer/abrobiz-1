import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 6 migration adds evidence-backed tenant and cleanup indexes', async () => {
  const sql = await read('../../migrations/0030_phase6_database_scalability.sql')
  for (const indexName of [
    'subscriptions_status_end_date_idx',
    'payments_business_created_at_idx',
    'payments_status_created_at_idx',
    'reviews_business_approved_created_at_idx',
    'business_telegram_links_chat_idx',
    'admin_telegram_links_chat_idx',
    'page_views_created_at_id_idx',
    'email_verification_tokens_expires_at_idx',
    'password_reset_tokens_expires_at_idx',
  ]) assert.match(sql, new RegExp(indexName), indexName)
  assert.match(sql, /limit 5000/)
  assert.match(sql, /purge_page_views/)
  assert.match(sql, /purge_expired_security_state/)
  assert.match(sql, /auth\.role\(\) <> 'service_role'/)
})

Deno.test('Phase 6 high-growth client lists use explicit columns and bounds', async () => {
  const files = [
    '../../../src/lib/api/announcements.ts',
    '../../../src/lib/api/bookings.ts',
    '../../../src/lib/api/items.ts',
    '../../../src/lib/api/messages.ts',
    '../../../src/lib/api/orders.ts',
    '../../../src/lib/api/payments.ts',
    '../../../src/lib/api/reviews.ts',
    '../../../src/lib/api/subscriptions.ts',
  ]
  for (const path of files) {
    const source = await read(path)
    assert.doesNotMatch(source, /\.select\('\*'/, path)
    assert.doesNotMatch(source, /\.select\('\*,/, path)
    assert.match(source, /\.limit\(/, path)
  }
})

Deno.test('Phase 6 retains RLS and avoids offset-based deep pagination', async () => {
  const policies = await read('../../migrations/0027_phase2_authorization_hardening.sql')
  const phase4 = await read('../../migrations/0029_phase4_storage_security.sql')
  const phase6 = await read('../../migrations/0030_phase6_database_scalability.sql')
  assert.match(policies, /businesses.*owner_id|owner_id.*businesses/s)
  assert.match(phase4, /revoke insert, update, delete on storage\.objects from anon, authenticated/i)
  assert.doesNotMatch(phase6, /offset\s+\d+/i)
})

Deno.test('Phase 6 cron and idempotency maintenance are bounded', async () => {
  const cron = await read('../subscription-cron/index.ts')
  const phase3 = await read('../../migrations/0028_phase3_abuse_hardening.sql')
  const phase6 = await read('../../migrations/0030_phase6_database_scalability.sql')
  assert.match(cron, /\.limit\(1000\)/)
  assert.match(phase3, /request_idempotency_expires_at_idx/)
  assert.match(phase6, /from public\.request_idempotency[\s\S]*limit 5000/)
  assert.match(phase6, /from public\.rate_limits[\s\S]*limit 5000/)
})
