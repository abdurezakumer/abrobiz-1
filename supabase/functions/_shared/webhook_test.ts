import assert from 'node:assert/strict'
import { handleUpdate } from '../telegram-webhook/index.ts'
import { MockSupabase, MockTelegram } from './test_mocks.ts'
import type { TelegramUpdate } from './types.ts'

function assertEquals(actual: unknown, expected: unknown) {
  assert.deepStrictEqual(actual, expected)
}
function assertStringIncludes(actual: string, expected: string) {
  assert.ok(actual.includes(expected), `Expected "${actual}" to include "${expected}"`)
}

function freshCtx() {
  const db = new MockSupabase()
  const tg = new MockTelegram()
  return { db, tg }
}

Deno.test('/start with a valid business token links the chat', async () => {
  const { db, tg } = freshCtx()
  db.seed('business_telegram_links', [{ id: 'link1', business_id: 'biz1', link_token: 'tok123', telegram_chat_id: null, linked_at: null }])

  const update: TelegramUpdate = {
    update_id: 1,
    message: { message_id: 1, chat: { id: 555, type: 'private' }, from: { id: 555, username: 'alice' }, text: '/start tok123' },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })

  const link = db.tables['business_telegram_links'].rows[0]
  assertEquals(link.telegram_chat_id, '555')
  assertEquals(link.telegram_username, 'alice')
  assertEquals(tg.sent.length, 1)
  assertStringIncludes(tg.sent[0].text!, 'Connected')
})

Deno.test('/start with an invalid token tells the user', async () => {
  const { db, tg } = freshCtx()
  const update: TelegramUpdate = {
    update_id: 2,
    message: { message_id: 2, chat: { id: 999, type: 'private' }, text: '/start bogus' },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })
  assertStringIncludes(tg.sent[0].text!, 'invalid or expired')
})

Deno.test('/pay from an unlinked chat asks the owner to connect first', async () => {
  const { db, tg } = freshCtx()
  const update: TelegramUpdate = {
    update_id: 3,
    message: { message_id: 3, chat: { id: 111, type: 'private' }, text: '/pay' },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })
  assertStringIncludes(tg.sent[0].text!, 'connect')
})

Deno.test('/pay from a linked chat sends the plan picker', async () => {
  const { db, tg } = freshCtx()
  db.seed('business_telegram_links', [{ id: 'link1', business_id: 'biz1', telegram_chat_id: '222', linked_at: '2026-01-01' }])
  db.seed('plans', [
    { id: 'p1', name: 'Basic', price_etb: 300, billing_interval: 'month', is_active: true, is_trial: false, sort_order: 0 },
    { id: 'p2', name: 'Business', price_etb: 700, billing_interval: 'month', is_active: true, is_trial: false, sort_order: 1 },
    { id: 'trial', name: 'Trial', price_etb: 0, billing_interval: 'month', is_active: true, is_trial: true, sort_order: -1 },
  ])

  const update: TelegramUpdate = {
    update_id: 4,
    message: { message_id: 4, chat: { id: 222, type: 'private' }, text: '/pay' },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })

  const sent = tg.sent[0]
  assertStringIncludes(sent.text!, 'Choose a plan')
  const keyboard = sent.replyMarkup as { inline_keyboard: { text: string; callback_data: string }[][] }
  // Trial plan must NOT appear as a payable option
  const allButtons = keyboard.inline_keyboard.flat()
  assertEquals(allButtons.length, 2)
  assertEquals(allButtons.some(b => b.text.includes('Trial')), false)
})

Deno.test('approve callback from a non-admin chat is refused, RPC never called', async () => {
  const { db, tg } = freshCtx()
  db.seed('payments', [{ id: 'pay1', business_id: 'biz1', status: 'pending' }])
  // no admin_telegram_links rows -> chat is not a recognized admin

  const update: TelegramUpdate = {
    update_id: 5,
    callback_query: {
      id: 'cbq1',
      from: { id: 777, username: 'randomguy' },
      message: { message_id: 10, chat: { id: 777, type: 'private' } },
      data: 'approve:pay1',
    },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })

  assertEquals(db.rpcCalls.length, 0)
  assertStringIncludes(tg.sent[0].text!, "not connected as an admin")
})

Deno.test('approve callback from a linked admin calls the RPC and edits the message', async () => {
  const { db, tg } = freshCtx()
  db.seed('admin_telegram_links', [{ id: 'a1', admin_id: 'admin1', telegram_chat_id: '888', linked_at: '2026-01-01' }])
  db.seed('payments', [{ id: 'pay1', business_id: 'biz1', status: 'pending' }])
  db.seed('business_telegram_links', []) // owner not linked -> no owner DM attempted, should not throw

  const update: TelegramUpdate = {
    update_id: 6,
    callback_query: {
      id: 'cbq2',
      from: { id: 888, username: 'theadmin' },
      message: { message_id: 20, chat: { id: 888, type: 'private' } },
      data: 'approve:pay1',
    },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })

  assertEquals(db.rpcCalls.length, 1)
  assertEquals(db.rpcCalls[0].name, 'admin_approve_payment')
  assertEquals(db.rpcCalls[0].args.p_payment_id, 'pay1')
  const edit = tg.sent.find(s => s.method === 'editMessageText')
  assertStringIncludes(edit!.text!, 'Approved by @theadmin')
})

Deno.test('a payment already reviewed by someone else shows a graceful message, not a crash', async () => {
  const { db, tg } = freshCtx()
  db.seed('admin_telegram_links', [{ id: 'a1', admin_id: 'admin1', telegram_chat_id: '888', linked_at: '2026-01-01' }])
  db.rpcImpl = () => ({ error: { message: 'Payment already reviewed' } })

  const update: TelegramUpdate = {
    update_id: 7,
    callback_query: {
      id: 'cbq3',
      from: { id: 888, username: 'theadmin' },
      message: { message_id: 30, chat: { id: 888, type: 'private' } },
      data: 'reject:pay1',
    },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })

  const edit = tg.sent.find(s => s.method === 'editMessageText')
  assertStringIncludes(edit!.text!, 'Already handled')
})

Deno.test('a photo with no pending action tells the owner to /pay first', async () => {
  const { db, tg } = freshCtx()
  const update: TelegramUpdate = {
    update_id: 8,
    message: { message_id: 8, chat: { id: 333, type: 'private' }, photo: [{ file_id: 'f1', width: 100, height: 100 }] },
  }
  await handleUpdate(update, { db: db as any, tg: tg as any })
  assertStringIncludes(tg.sent[0].text!, '/pay first')
})

Deno.test('full happy path: /pay -> pick plan -> pick method -> send photo creates a payment', async () => {
  const { db, tg } = freshCtx()
  db.seed('business_telegram_links', [{ id: 'link1', business_id: 'biz1', telegram_chat_id: '444', linked_at: '2026-01-01' }])
  db.seed('plans', [{ id: 'p1', name: 'Basic', price_etb: 300, billing_interval: 'month', is_active: true, is_trial: false, sort_order: 0 }])
  db.seed('payment_methods', [{ id: 'm1', name: 'Telebirr', account_name: 'Biz', account_number: '0911', instructions: 'Send exact amount', is_active: true, sort_order: 0 }])

  const ctx = { db: db as any, tg: tg as any }

  await handleUpdate({ update_id: 9, message: { message_id: 9, chat: { id: 444, type: 'private' }, text: '/pay' } }, ctx)
  await handleUpdate({
    update_id: 10,
    callback_query: { id: 'c1', from: { id: 444 }, message: { message_id: 11, chat: { id: 444, type: 'private' } }, data: 'pay_plan:p1' },
  }, ctx)
  await handleUpdate({
    update_id: 11,
    callback_query: { id: 'c2', from: { id: 444 }, message: { message_id: 12, chat: { id: 444, type: 'private' } }, data: 'pay_method:m1' },
  }, ctx)
  await handleUpdate({
    update_id: 12,
    message: { message_id: 13, chat: { id: 444, type: 'private' }, photo: [{ file_id: 'f1', width: 800, height: 600 }] },
  }, ctx)

  const payments = db.tables['payments'].rows
  assertEquals(payments.length, 1)
  assertEquals(payments[0].business_id, 'biz1')
  assertEquals(payments[0].plan_id, 'p1')
  assertEquals(payments[0].payment_method_id, 'm1')
  assertEquals(payments[0].amount_etb, 300)
  assertEquals(payments[0].status, 'pending')
  assertEquals(db.storageUploads.length, 1)
  assertEquals(db.tables['telegram_pending_actions'].rows.length, 0) // cleared after submission

  const confirmMsg = tg.sent.find(s => s.text?.includes('Submitted'))
  assertEquals(!!confirmMsg, true)
})
