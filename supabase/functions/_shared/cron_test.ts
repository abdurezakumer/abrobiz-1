import assert from 'node:assert/strict'
import { runSubscriptionCron } from '../subscription-cron/index.ts'
import { MockSupabase, MockTelegram } from './test_mocks.ts'

function assertEquals(actual: unknown, expected: unknown) {
  assert.deepStrictEqual(actual, expected)
}

const TODAY = '2026-08-15'

Deno.test('expires a trial past its end_date and notifies the owner', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'trial', end_date: '2026-08-10', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'Cafe One' } },
  ])
  const tg = new MockTelegram()

  const result = await runCronAt(db, tg, TODAY)

  assertEquals(result.expiredCount, 1)
  assertEquals(db.tables['subscriptions'].rows[0].status, 'expired')
  const notif = db.tables['notifications'].rows[0]
  assertEquals(notif.user_id, 'u1')
  assertEquals(notif.type, 'subscription_expired')
})

Deno.test('does not touch subscriptions that are not yet overdue', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'active', end_date: '2026-09-01', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'Cafe One' } },
  ])
  const tg = new MockTelegram()

  const result = await runCronAt(db, tg, TODAY)

  assertEquals(result.expiredCount, 0)
  assertEquals(db.tables['subscriptions'].rows[0].status, 'active')
})

Deno.test('already-expired or cancelled subscriptions are left alone (no double notification)', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'expired', end_date: '2026-08-01', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'X' } },
    { id: 's2', business_id: 'b2', status: 'cancelled', end_date: '2026-08-01', reminder_sent_at: null, businesses: { owner_id: 'u2', name: 'Y' } },
  ])
  const tg = new MockTelegram()

  const result = await runCronAt(db, tg, TODAY)

  assertEquals(result.expiredCount, 0)
  assertEquals(db.tables['notifications']?.rows.length ?? 0, 0)
})

Deno.test('sends exactly one reminder 3 days before expiry, and only once', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    // TODAY + 3 days = 2026-08-18
    { id: 's1', business_id: 'b1', status: 'active', end_date: '2026-08-18', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'Cafe One' } },
  ])
  const tg = new MockTelegram()

  const first = await runCronAt(db, tg, TODAY)
  assertEquals(first.reminderCount, 1)
  assertEquals(db.tables['subscriptions'].rows[0].reminder_sent_at != null, true)

  // Running again the same day should NOT send a second reminder
  const second = await runCronAt(db, tg, TODAY)
  assertEquals(second.reminderCount, 0)
  assertEquals(db.tables['notifications'].rows.filter((n: any) => n.type === 'subscription_reminder').length, 1)
})

Deno.test('a subscription 3 days out but already reminded is skipped', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'active', end_date: '2026-08-18', reminder_sent_at: '2026-08-14T00:00:00Z', businesses: { owner_id: 'u1', name: 'X' } },
  ])
  const tg = new MockTelegram()

  const result = await runCronAt(db, tg, TODAY)
  assertEquals(result.reminderCount, 0)
})

Deno.test('notifies the owner on Telegram too when their business is linked', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'trial', end_date: '2026-08-10', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'Cafe One' } },
  ])
  db.seed('business_telegram_links', [{ id: 'l1', business_id: 'b1', telegram_chat_id: '999', linked_at: '2026-01-01' }])
  const tg = new MockTelegram()

  await runCronAt(db, tg, TODAY)

  assertEquals(tg.sent.length, 1)
  assertEquals(tg.sent[0].chatId, '999')
})

Deno.test('works fine with tg=null (bot not configured yet) — no crash, just no Telegram DM', async () => {
  const db = new MockSupabase()
  db.seed('subscriptions', [
    { id: 's1', business_id: 'b1', status: 'trial', end_date: '2026-08-10', reminder_sent_at: null, businesses: { owner_id: 'u1', name: 'Cafe One' } },
  ])

  const result = await runCronAt(db, null, TODAY)
  assertEquals(result.expiredCount, 1) // still works
})

// Helper: run the cron logic pretending "today" is a fixed date, without
// depending on the actual system clock.
async function runCronAt(db: MockSupabase, tg: MockTelegram | null, today: string) {
  const RealDate = Date
  // @ts-ignore - test-only Date override
  globalThis.Date = class extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(`${today}T00:00:00Z`)
      } else {
        // @ts-ignore
        super(...args)
      }
    }
  } as any
  try {
    return await runSubscriptionCron(db as any, tg as any)
  } finally {
    globalThis.Date = RealDate
  }
}
