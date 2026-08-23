import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient, buildInlineKeyboard } from '../_shared/telegram.ts'
import { notifyAdminsOfPayment } from '../_shared/notify.ts'
import type { TelegramUpdate, TelegramMessage, TelegramCallbackQuery, TelegramPhotoSize } from '../_shared/types.ts'

export interface Ctx {
  db: SupabaseClient
  tg: TelegramClient
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function handleUpdate(update: TelegramUpdate, ctx: Ctx): Promise<void> {
  if (update.message) {
    await handleMessage(update.message, ctx)
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, ctx)
  }
}

// ── Messages ─────────────────────────────────────────────────────────────

async function handleMessage(msg: TelegramMessage, ctx: Ctx): Promise<void> {
  const chatId = String(msg.chat.id)

  if (msg.photo && msg.photo.length > 0) {
    return handlePhoto(chatId, msg.photo, ctx)
  }

  const text = msg.text?.trim()
  if (!text) return

  if (text.startsWith('/start')) {
    const token = text.split(' ')[1]?.trim()
    return handleStart(chatId, msg.from?.username, token, ctx)
  }
  if (text === '/pay') {
    return handlePayCommand(chatId, ctx)
  }
  if (text === '/cancel') {
    await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
    await ctx.tg.sendMessage(chatId, 'Cancelled.')
    return
  }

  await ctx.tg.sendMessage(chatId, "I didn't understand that. Send /pay to submit a payment, or /cancel to stop.")
}

async function handleStart(chatId: string, username: string | undefined, token: string | undefined, ctx: Ctx): Promise<void> {
  if (!token) {
    const { data: business } = await ctx.db.from('business_telegram_links').select('id').eq('telegram_chat_id', chatId).maybeSingle()
    const { data: admin } = await ctx.db.from('admin_telegram_links').select('id').eq('telegram_chat_id', chatId).maybeSingle()
    if (business || admin) {
      await ctx.tg.sendMessage(chatId, "You're already connected. Send /pay to submit a payment.")
    } else {
      await ctx.tg.sendMessage(chatId, "Welcome! To connect your account, open your dashboard and tap \u201cConnect Telegram\u201d — that link brings you back here.")
    }
    return
  }

  const { data: businessLink } = await ctx.db.from('business_telegram_links').select('id, business_id').eq('link_token', token).maybeSingle()
  if (businessLink) {
    await ctx.db
      .from('business_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', businessLink.id)
    await ctx.tg.sendMessage(chatId, '\u2705 Connected! You\u2019ll get updates here when your payments are reviewed. Send /pay anytime to submit a new payment.')
    return
  }

  const { data: adminLink } = await ctx.db.from('admin_telegram_links').select('id').eq('link_token', token).maybeSingle()
  if (adminLink) {
    await ctx.db
      .from('admin_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', adminLink.id)
    await ctx.tg.sendMessage(chatId, '\u2705 You\u2019re connected as an admin. Payment approval requests will show up here with Approve/Reject buttons.')
    return
  }

  await ctx.tg.sendMessage(chatId, "That link looks invalid or expired. Generate a fresh one from your dashboard.")
}

async function handlePayCommand(chatId: string, ctx: Ctx): Promise<void> {
  const { data: link } = await ctx.db
    .from('business_telegram_links')
    .select('business_id')
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .maybeSingle()

  if (!link) {
    await ctx.tg.sendMessage(chatId, "Please connect your account first \u2014 open your dashboard\u2019s Billing page and tap \u201cConnect Telegram\u201d.")
    return
  }

  const { data: plans } = await ctx.db
    .from('plans')
    .select('id, name, price_etb, billing_interval')
    .eq('is_active', true)
    .eq('is_trial', false)
    .order('sort_order', { ascending: true })

  if (!plans || plans.length === 0) {
    await ctx.tg.sendMessage(chatId, 'No plans are available right now \u2014 please try again later.')
    return
  }

  await ctx.db.from('telegram_pending_actions').upsert({ telegram_chat_id: chatId, business_id: link.business_id, plan_id: null, payment_method_id: null })

  const keyboard = buildInlineKeyboard(
    plans.map(p => [{ text: `${p.name} \u2014 ${p.price_etb} ETB/${p.billing_interval}`, callback_data: `pay_plan:${p.id}` }])
  )
  await ctx.tg.sendMessage(chatId, 'Choose a plan:', { replyMarkup: keyboard })
}

async function handlePhoto(chatId: string, photos: TelegramPhotoSize[], ctx: Ctx): Promise<void> {
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()

  if (!pending || !pending.business_id || !pending.plan_id || !pending.payment_method_id) {
    await ctx.tg.sendMessage(chatId, 'Send /pay first to choose a plan and payment method \u2014 then send your proof photo.')
    return
  }

  const { data: plan } = await ctx.db.from('plans').select('id, price_etb, billing_interval').eq('id', pending.plan_id).single()
  if (!plan) {
    await ctx.tg.sendMessage(chatId, "That plan isn't available anymore \u2014 send /pay to start over.")
    return
  }

  const largest = photos[photos.length - 1]
  const file = await ctx.tg.getFile(largest.file_id)
  const bytes = await ctx.tg.downloadFile(file.file_path)
  const path = `${pending.business_id}/${Date.now()}.jpg`

  const { error: uploadError } = await ctx.db.storage.from('payment-proofs').upload(path, bytes, { contentType: 'image/jpeg' })
  if (uploadError) {
    console.error('Proof upload failed', uploadError)
    await ctx.tg.sendMessage(chatId, "Something went wrong saving your photo \u2014 please try again.")
    return
  }

  const { data: payment, error: insertError } = await ctx.db
    .from('payments')
    .insert({
      business_id: pending.business_id,
      plan_id: pending.plan_id,
      billing_cycle: plan.billing_interval,
      amount_etb: plan.price_etb,
      payment_method_id: pending.payment_method_id,
      proof_url: path,
      status: 'pending',
    })
    .select('id')
    .single()

  await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)

  if (insertError || !payment) {
    console.error('Payment insert failed', insertError)
    await ctx.tg.sendMessage(chatId, "Something went wrong submitting your payment \u2014 please try again or use the dashboard.")
    return
  }

  await ctx.tg.sendMessage(chatId, '\u2705 Submitted! We\u2019ll review it and let you know here.')
  await notifyAdminsOfPayment(ctx.db, ctx.tg, payment.id)
}

// ── Callback (inline button) queries ────────────────────────────────────

async function handleCallback(cb: TelegramCallbackQuery, ctx: Ctx): Promise<void> {
  const chatId = String(cb.message?.chat.id ?? cb.from.id)
  const data = cb.data ?? ''

  try {
    if (data.startsWith('pay_plan:')) {
      await handlePlanSelected(chatId, data.slice('pay_plan:'.length), ctx)
    } else if (data.startsWith('pay_method:')) {
      await handleMethodSelected(chatId, data.slice('pay_method:'.length), ctx)
    } else if (data.startsWith('approve:')) {
      await handleApproval(chatId, cb, data.slice('approve:'.length), 'approve', ctx)
    } else if (data.startsWith('reject:')) {
      await handleApproval(chatId, cb, data.slice('reject:'.length), 'reject', ctx)
    }
  } finally {
    await ctx.tg.answerCallbackQuery(cb.id).catch(() => {})
  }
}

async function handlePlanSelected(chatId: string, planId: string, ctx: Ctx): Promise<void> {
  await ctx.db.from('telegram_pending_actions').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)

  const { data: methods } = await ctx.db.from('payment_methods').select('id, name').eq('is_active', true).order('sort_order', { ascending: true })
  if (!methods || methods.length === 0) {
    await ctx.tg.sendMessage(chatId, 'No payment methods are configured yet \u2014 please contact support.')
    return
  }
  const keyboard = buildInlineKeyboard(methods.map(m => [{ text: m.name, callback_data: `pay_method:${m.id}` }]))
  await ctx.tg.sendMessage(chatId, 'How are you paying?', { replyMarkup: keyboard })
}

async function handleMethodSelected(chatId: string, methodId: string, ctx: Ctx): Promise<void> {
  await ctx.db.from('telegram_pending_actions').update({ payment_method_id: methodId, updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)

  const { data: method } = await ctx.db.from('payment_methods').select('name, account_name, account_number, instructions').eq('id', methodId).single()
  if (!method) return

  const text = [
    `Send payment via ${method.name}:`,
    `${method.account_name} \u2014 ${method.account_number}`,
    method.instructions,
    '',
    'Then send a photo of your receipt/screenshot right here.',
  ].filter(Boolean).join('\n')
  await ctx.tg.sendMessage(chatId, text)
}

async function handleApproval(
  adminChatId: string,
  cb: TelegramCallbackQuery,
  paymentId: string,
  action: 'approve' | 'reject',
  ctx: Ctx
): Promise<void> {
  const { data: adminLink } = await ctx.db.from('admin_telegram_links').select('id').eq('telegram_chat_id', adminChatId).not('linked_at', 'is', null).maybeSingle()
  if (!adminLink) {
    await ctx.tg.sendMessage(adminChatId, "You're not connected as an admin, so this button doesn't work here.")
    return
  }

  const rpcName = action === 'approve' ? 'admin_approve_payment' : 'admin_reject_payment'
  const rpcArgs = action === 'approve' ? { p_payment_id: paymentId } : { p_payment_id: paymentId, p_reason: 'Rejected via Telegram' }

  const { error } = await ctx.db.rpc(rpcName, rpcArgs)
  const messageId = cb.message?.message_id
  const by = cb.from.username ? `@${cb.from.username}` : 'an admin'

  if (error) {
    const alreadyReviewed = /already reviewed/i.test(error.message)
    const text = alreadyReviewed ? '\u26A0\uFE0F Already handled by another admin.' : `Something went wrong: ${error.message}`
    if (messageId) await ctx.tg.editMessageText(adminChatId, messageId, text).catch(() => {})
    return
  }

  const resultText = action === 'approve' ? `\u2705 Approved by ${by}` : `\u274C Rejected by ${by}`
  if (messageId) await ctx.tg.editMessageText(adminChatId, messageId, resultText).catch(() => {})

  // Best-effort notify the owner directly in Telegram too (in-app notification already happened inside the RPC)
  const { data: payment } = await ctx.db.from('payments').select('business_id').eq('id', paymentId).maybeSingle()
  if (payment?.business_id) {
    const { data: ownerLink } = await ctx.db.from('business_telegram_links').select('telegram_chat_id').eq('business_id', payment.business_id).not('telegram_chat_id', 'is', null).maybeSingle()
    if (ownerLink?.telegram_chat_id) {
      const ownerText = action === 'approve'
        ? '\uD83C\uDF89 Your payment was approved! Your subscription is now active.'
        : 'Your payment was rejected. Check your dashboard\u2019s Billing page for details, or resubmit.'
      await ctx.tg.sendMessage(ownerLink.telegram_chat_id, ownerText).catch(() => {})
    }
  }
}

// ── HTTP entry point ─────────────────────────────────────────────────────
// Only runs when this file is executed directly by the Edge Runtime, not
// when it's imported by a test.
if (import.meta.main) {
  Deno.serve(async req => {
    const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (expectedSecret) {
      const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (got !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    try {
      const update = (await req.json()) as TelegramUpdate
      const db = createAdminClient()
      const tg = new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '')
      await handleUpdate(update, { db, tg })
    } catch (err) {
      console.error('telegram-webhook error', err)
    }

    // Always respond 200 quickly so Telegram doesn't retry-storm on errors.
    return new Response('ok', { status: 200 })
  })
}
