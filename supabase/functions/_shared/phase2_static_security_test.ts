import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 2 migration preserves tenant identity on updates', async () => {
  const sql = await read('../../migrations/0027_phase2_authorization_hardening.sql')
  for (const table of ['contact_messages', 'bookings', 'orders', 'reviews', 'business_telegram_links']) {
    assert.match(sql, new RegExp('drop policy if exists "[^"]*update[^"]*" on public\\.' + table, 'i'))
    assert.match(sql, new RegExp('create policy "[^"]*update[^"]*" on public\\.' + table + '[\\s\\S]*?with check', 'i'))
  }
  assert.match(sql, /payments_insert_own_pending/)
  assert.match(sql, /validate_payment_submission/)
  assert.match(sql, /protect_order_integrity/)
  assert.match(sql, /between 1 and 50 items/i)
  assert.match(sql, /quantity must be between 1 and 100/i)
  assert.match(sql, /file_size_limit/)
  assert.match(sql, /revoke execute on function public\\.track_page_view/)
})

Deno.test('Phase 2 privileged functions do not return raw internal errors', async () => {
  const announcement = await read('../send-announcement/index.ts')
  const template = await read('../import-template/index.ts')
  const notification = await read('../notify-payment-submitted/index.ts')
  assert.doesNotMatch(announcement, /return json\\(\\{ error: String\\(err\\)/)
  assert.doesNotMatch(template, /return json\\(\\{ error: error\\.message/)
  assert.doesNotMatch(notification, /return json\\(\\{ error: String\\(err\\)/)
})
