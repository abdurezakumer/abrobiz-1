import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient, buildInlineKeyboard } from '../_shared/telegram.ts'
import { notifyAdminsOfPayment } from '../_shared/notify.ts'
import { notifyBusinessOwner } from '../_shared/ownerNotifications.ts'
import type { TelegramUpdate, TelegramMessage, TelegramCallbackQuery, TelegramPhotoSize } from '../_shared/types.ts'
import { checkSecret } from '../_shared/endpointSecurity.ts'
import { detectAllowedFile, safeStoragePath } from '../_shared/fileSecurity.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { logEvent, logFailure } from '../_shared/observability.ts'

export interface Ctx {
  db: SupabaseClient
  tg: TelegramClient
}

export async function claimTelegramUpdate(db: SupabaseClient, updateId: number): Promise<boolean> {
  const { data, error } = await db.rpc('claim_telegram_update', { p_update_id: updateId })
  if (error) throw new Error('Webhook replay protection is unavailable')
  return data === true
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

const infoKeyboard = buildInlineKeyboard([
  [
    { text: 'View plans', callback_data: 'info:plans' },
    { text: 'Contact support', callback_data: 'info:support' },
  ],
])

function supportMessage(): string {
  const email = Deno.env.get('SUPPORT_EMAIL')?.trim() || 'support@abrobiz.com'
  const username = Deno.env.get('SUPPORT_TELEGRAM_USERNAME')?.trim().replace(/^@/, '')
  const lines = [
    '🆘 AbroBiz Support',
    '',
    'Need help with your website, plan, payment, or account?',
    `Email: ${email}`,
  ]
  if (username && /^[A-Za-z0-9_]{5,32}$/.test(username)) lines.push(`Telegram: https://t.me/${username}`)
  lines.push('', 'Please include your AbroBiz subdomain and a short description. Never send your password or security codes.')
  return lines.join('\n')
}

async function handleInfoForChat(chatId: string, ctx: Ctx): Promise<void> {
  await ctx.tg.sendMessage(
    chatId,
    [
      '✨ AbroBiz',
      '',
      'Create and manage a professional business website, menu/catalog, QR code, bookings, orders, reviews, and payments in one place.',
      '',
      'Commands:',
      '/plans — view current plans and prices',
      '/pay — submit a payment after connecting your account',
      '/support — contact AbroBiz support',
      '/admin — admin tools for authorized administrators',
    ].join('\n'),
    { replyMarkup: infoKeyboard },
  )
}

async function handlePlans(chatId: string, ctx: Ctx): Promise<void> {
  const { data: plans } = await ctx.db
    .from('plans')
    .select('name, price_etb, billing_interval, features')
    .eq('is_active', true)
    .eq('is_trial', false)
    .order('sort_order', { ascending: true })
    .limit(20)

  if (!plans || plans.length === 0) {
    await ctx.tg.sendMessage(chatId, 'Plans are temporarily unavailable. Please try again later or contact /support.')
    return
  }

  const lines = ['💎 AbroBiz plans', '']
  for (const plan of plans) {
    const features = Array.isArray(plan.features) ? plan.features.slice(0, 6).join(' · ') : ''
    lines.push(`${plan.name} — ${plan.price_etb} ETB/${plan.billing_interval}`)
    if (features) lines.push(`  ${features}`)
    lines.push('')
  }
  lines.push('Start with /pay after connecting your account from the Billing page.')
  await ctx.tg.sendMessage(chatId, lines.join('\n'), { replyMarkup: infoKeyboard })
}

async function isLinkedAdmin(chatId: string, ctx: Ctx): Promise<boolean> {
  const { data: link } = await ctx.db
    .from('admin_telegram_links')
    .select('admin_id')
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .maybeSingle()
  if (!link?.admin_id) return false

  // A Telegram link must not preserve admin access after the account is
  // demoted in AbroBiz.
  const { data: profile } = await ctx.db
    .from('profiles')
    .select('id')
    .eq('id', link.admin_id)
    .in('role', ['admin', 'super_admin'])
    .maybeSingle()
  return !!profile
}

async function handleAdmin(chatId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  await ctx.tg.sendMessage(chatId, '🛡️ AbroBiz admin console\n\n/pending — view payments awaiting review\n/info — view platform information\n/support — contact AbroBiz support')
}

async function handlePending(chatId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }

  const { data: payments } = await ctx.db
    .from('payments')
    .select('id, amount_etb, created_at, plans(name), businesses(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (!payments || payments.length === 0) {
    await ctx.tg.sendMessage(chatId, '✅ There are no payments waiting for review.')
    return
  }

  await ctx.tg.sendMessage(chatId, `💳 ${payments.length} payment${payments.length === 1 ? '' : 's'} waiting for review:`)
  for (const payment of payments) {
    const businessName = (payment as any).businesses?.name ?? 'Business'
    const planName = (payment as any).plans?.name ?? 'Plan'
    await ctx.tg.sendMessage(chatId, `${businessName}\nPlan: ${planName}\nAmount: ${payment.amount_etb} ETB`, {
      replyMarkup: buildInlineKeyboard([[
        { text: '✅ Approve', callback_data: `approve:${payment.id}` },
        { text: '❌ Reject', callback_data: `reject:${payment.id}` },
      ]]),
    })
  }
}

async function handleMessage(msg: TelegramMessage, ctx: Ctx): Promise<void> {
  const chatId = String(msg.chat.id)

  if (msg.photo && msg.photo.length > 0) {
    return handlePhoto(chatId, msg.photo, ctx)
  }

  const text = msg.text?.trim()
  if (!text) return

  const [rawCommand, ...args] = text.split(/\s+/)
  const command = rawCommand.toLowerCase().split('@')[0]

  if (command === '/start') {
    const token = args[0]?.trim()
    return handleStart(chatId, msg.from?.username, token, ctx)
  }
  if (command === '/help' || command === '/info' || command === '/about') {
    return handleInfoForChat(chatId, ctx)
  }
  if (command === '/plans' || command === '/price' || command === '/prices') {
    return handlePlans(chatId, ctx)
  }
  if (command === '/support' || command === '/contact') {
    await ctx.tg.sendMessage(chatId, supportMessage())
    return
  }
  if (command === '/admin') {
    return handleAdmin(chatId, ctx)
  }
  if (command === '/pending') {
    return handlePending(chatId, ctx)
  }
  if (command === '/pay') {
    return handlePayCommand(chatId, ctx)
  }
  if (command === '/cancel') {
    await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
    await ctx.tg.sendMessage(chatId, 'Cancelled.')
    return
  }

  await ctx.tg.sendMessage(chatId, "I didn't understand that. Use /info, /plans, /support, /pay, or /cancel.")
}

async function handleStart(chatId: string, username: string | undefined, token: string | undefined, ctx: Ctx): Promise<void> {
  if (!token) {
    const { data: business } = await ctx.db.from('business_telegram_links').select('id').eq('telegram_chat_id', chatId).maybeSingle()
    const { data: admin } = await ctx.db.from('admin_telegram_links').select('id').eq('telegram_chat_id', chatId).maybeSingle()
    if (business || admin) {
      await ctx.tg.sendMessage(chatId, "You're already connected. Send /pay to submit a payment or /info to see all commands.", { replyMarkup: infoKeyboard })
    } else {
      await ctx.tg.sendMessage(chatId, "Welcome to AbroBiz! Open your dashboard and tap \u201cConnect Telegram\u201d to link your account.\n\nUse /info for platform information, /plans for pricing, or /support for help.", { replyMarkup: infoKeyboard })
    }
    return
  }

  const startsPayment = token.startsWith('pay_')
  const connectionToken = startsPayment ? token.slice(4) : token
  const { data: businessLink } = await ctx.db.from('business_telegram_links').select('id, business_id').eq('link_token', connectionToken).maybeSingle()
  if (businessLink) {
    const { data: linkedBusiness } = await ctx.db.from('business_telegram_links').select('id').eq('telegram_chat_id', chatId).not('linked_at', 'is', null).neq('id', businessLink.id).maybeSingle()
    const { data: linkedAdmin } = await ctx.db.from('admin_telegram_links').select('id').eq('telegram_chat_id', chatId).not('linked_at', 'is', null).maybeSingle()
    if (linkedBusiness || linkedAdmin) {
      await ctx.tg.sendMessage(chatId, 'This Telegram account is already connected to another AbroBiz account. Disconnect it there first, then try again.')
      return
    }
    await ctx.db
      .from('business_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', businessLink.id)
    await ctx.tg.sendMessage(chatId, startsPayment
      ? '\u2705 Connected! Let\u2019s prepare your payment submission.'
      : '\u2705 Connected! You\u2019ll get updates here when your payments are reviewed. Send /pay anytime to submit a new payment.')
    if (startsPayment) return handlePayCommand(chatId, ctx)
    return
  }

  const { data: adminLink } = await ctx.db.from('admin_telegram_links').select('id, admin_id').eq('link_token', token).maybeSingle()
  const { data: adminProfile } = adminLink?.admin_id
    ? await ctx.db.from('profiles').select('id').eq('id', adminLink.admin_id).in('role', ['admin', 'super_admin']).maybeSingle()
    : { data: null }
  if (adminLink && adminProfile) {
    const { data: linkedBusiness } = await ctx.db.from('business_telegram_links').select('id').eq('telegram_chat_id', chatId).not('linked_at', 'is', null).maybeSingle()
    const { data: linkedAdmin } = await ctx.db.from('admin_telegram_links').select('id').eq('telegram_chat_id', chatId).not('linked_at', 'is', null).neq('id', adminLink.id).maybeSingle()
    if (linkedBusiness || linkedAdmin) {
      await ctx.tg.sendMessage(chatId, 'This Telegram account is already connected to another AbroBiz account. Disconnect it there first, then try again.')
      return
    }
    await ctx.db
      .from('admin_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', adminLink.id)
    await ctx.tg.sendMessage(chatId, '\u2705 You\u2019re connected as an admin. Payment approval requests will show up here with Approve/Reject buttons. Use /admin for admin tools.', { replyMarkup: infoKeyboard })
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
  const extension = detectAllowedFile('image/jpeg', bytes)
  if (extension !== 'jpg') {
    await ctx.tg.sendMessage(chatId, 'That photo could not be validated. Please send a normal JPEG image.')
    return
  }
  const path = safeStoragePath(pending.business_id, extension)

  const { error: uploadError } = await ctx.db.storage.from('payment-proofs').upload(path, bytes, { contentType: 'image/jpeg' })
  if (uploadError) {
    logEvent('error', { service: 'abrobiz-edge', function_name: 'telegram-webhook', operation: 'upload_payment_proof', error_category: 'DEPENDENCY_ERROR', error_code: uploadError.name ?? 'unknown', provider: 'storage', outcome: 'failed' })
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
    logEvent('error', { service: 'abrobiz-edge', function_name: 'telegram-webhook', operation: 'insert_payment', error_category: 'DATABASE_ERROR', error_code: insertError?.code ?? 'unknown', outcome: 'failed' })
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
    if (data === 'info:plans') {
      await handlePlans(chatId, ctx)
    } else if (data === 'info:support') {
      await ctx.tg.sendMessage(chatId, supportMessage())
    } else if (data.startsWith('pay_plan:')) {
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
  const { data: plan } = await ctx.db.from('plans').select('name, price_etb, billing_interval').eq('id', pending.plan_id).eq('is_active', true).eq('is_trial', false).single()

  const text = [
    `Send payment via ${method.name}:`,
    `${method.account_name} \u2014 ${method.account_number}`,
    plan ? `Full payment required: ${plan.price_etb} ETB/${plan.billing_interval}` : 'Send the complete amount shown in your Billing page.',
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
  if (!await isLinkedAdmin(adminChatId, ctx)) {
    await ctx.tg.sendMessage(adminChatId, "You're not connected as an admin, so this button doesn't work here.")
    return
  }

  if (cb.message?.chat.type !== 'private' || String(cb.from.id) !== adminChatId) {
    await ctx.tg.sendMessage(adminChatId, 'This approval request is not authorized.')
    return
  }

  const rpcName = action === 'approve' ? 'admin_approve_payment' : 'admin_reject_payment'
  const rpcArgs = action === 'approve' ? { p_payment_id: paymentId } : { p_payment_id: paymentId, p_reason: 'Rejected via Telegram' }

  const { error } = await ctx.db.rpc(rpcName, rpcArgs)
  const messageId = cb.message?.message_id
  const by = cb.from.username ? `@${cb.from.username}` : 'an admin'

  if (error) {
    const alreadyReviewed = /already reviewed/i.test(error.message)
    const text = alreadyReviewed ? '\u26A0\uFE0F Already handled by another admin.' : 'Something went wrong. Please use the admin dashboard.'
    if (messageId) await ctx.tg.editMessageText(adminChatId, messageId, text).catch(() => {})
    return
  }

  const resultText = action === 'approve' ? `\u2705 Approved by ${by}` : `\u274C Rejected by ${by}`
  if (messageId) await ctx.tg.editMessageText(adminChatId, messageId, resultText).catch(() => {})

  // Best-effort owner delivery. The same helper sends both email and linked
  // Telegram updates, while the RPC remains the source of truth.
  const { data: payment } = await ctx.db.from('payments').select('business_id').eq('id', paymentId).maybeSingle()
  if (payment?.business_id) {
    await notifyBusinessOwner(ctx.db, ctx.tg, payment.business_id, {
      title: action === 'approve' ? 'Payment approved' : 'Payment rejected',
      body: action === 'approve'
        ? 'Your payment has been approved and your AbroBiz subscription is now active.'
        : 'Your payment proof was rejected. Open Billing to review the reason and submit a new proof if needed.',
      link: '/dashboard/billing',
      telegramText: action === 'approve'
        ? '\uD83C\uDF89 Your AbroBiz payment was approved. Your subscription is now active.'
        : 'Your AbroBiz payment was rejected. Check Billing for details and resubmit if needed.',
    }).catch(() => {})
  }
}

// ── HTTP entry point ─────────────────────────────────────────────────────
// Only runs when this file is executed directly by the Edge Runtime, not
// when it's imported by a test.
if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const secretStatus = checkSecret(
      req.headers.get('X-Telegram-Bot-Api-Secret-Token'),
      Deno.env.get('TELEGRAM_WEBHOOK_SECRET'),
    )
    if (secretStatus === 'missing') {
      return new Response('Service unavailable', { status: 503 })
    }
    if (secretStatus === 'invalid') {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const limited = await enforceRateLimit(req, 'telegram-webhook', 600, 60)
      if (limited) return limited
      const parsedBody = await readJsonBody(req, 128 * 1024)
      if (parsedBody.error || !isRecord(parsedBody.data)) return new Response('Bad request', { status: parsedBody.status ?? 400 })
      const update = parsedBody.data as unknown as TelegramUpdate
      if (!Number.isSafeInteger(update.update_id)) return new Response('Bad request', { status: 400 })
      const db = createAdminClient()
      const claimed = await claimTelegramUpdate(db, update.update_id)
      if (!claimed) return new Response('ok', { status: 200 })
      if (update.message?.photo?.length) {
        const photoChatId = String(update.message.chat.id)
        const photoLimited = await enforceRateLimit(req, 'telegram-payment-photo', 20, 3600, photoChatId)
        if (photoLimited) return photoLimited
      }
      const tg = new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '')
      await handleUpdate(update, { db, tg })
    } catch (err) {
      logFailure(req, { function_name: 'telegram-webhook', operation: 'process_update', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'telegram', status: 500 })
      return new Response('Webhook processing failed', { status: 500 })
    }

    // Always respond 200 quickly so Telegram doesn't retry-storm on errors.
    return new Response('ok', { status: 200 })
  })
}
