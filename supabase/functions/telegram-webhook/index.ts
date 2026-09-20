import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient, buildInlineKeyboard } from '../_shared/telegram.ts'
import { notifyAdminsOfPayment } from '../_shared/notify.ts'
import { notifyBusinessOwner } from '../_shared/ownerNotifications.ts'
import type { TelegramUpdate, TelegramMessage, TelegramCallbackQuery, TelegramPhotoSize } from '../_shared/types.ts'
import { checkSecret } from '../_shared/endpointSecurity.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { logEvent, logFailure } from '../_shared/observability.ts'

export interface Ctx {
  db: SupabaseClient
  tg: TelegramClient
  paymentChannelId?: string
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

const adminKeyboard = buildInlineKeyboard([
  [{ text: 'Pending payments', callback_data: 'admin:pending' }],
  [{ text: 'Platform info', callback_data: 'admin:info' }, { text: 'Support', callback_data: 'admin:support' }],
])

const accountKeyboard = buildInlineKeyboard([
  [{ text: 'Disconnect Telegram', callback_data: 'account:disconnect' }],
  [{ text: 'View plans', callback_data: 'info:plans' }, { text: 'Contact support', callback_data: 'info:support' }],
])

function configuredPaymentChannel(ctx: Ctx): string | null {
  const value = ctx.paymentChannelId ?? Deno.env.get('TELEGRAM_PAYMENT_CHANNEL_ID')?.trim() ?? ''
  return /^-?[0-9]{5,32}$/.test(value) ? value : null
}

function supportMessage(): string {
  const email = Deno.env.get('SUPPORT_EMAIL')?.trim() || 'abdurezak4525@gmail.com'
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

async function disconnectChat(chatId: string, ctx: Ctx): Promise<boolean> {
  const rotatedToken = () => ({
    telegram_chat_id: null,
    telegram_username: null,
    linked_at: null,
    link_token: encodeRandomToken(),
  })
  const business = await ctx.db
    .from('business_telegram_links')
    .update(rotatedToken())
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .select('id')
  const admin = await ctx.db
    .from('admin_telegram_links')
    .update(rotatedToken())
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .select('id')
  await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
  await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
  return (business.data?.length ?? 0) > 0 || (admin.data?.length ?? 0) > 0
}

function encodeRandomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
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
      '/connect <token> — connect using the secure dashboard token',
      '/disconnect — disconnect this Telegram account',
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
  return Boolean(await linkedAdminId(chatId, ctx))
}

async function linkedAdminId(chatId: string, ctx: Ctx): Promise<string | null> {
  const { data: link } = await ctx.db
    .from('admin_telegram_links')
    .select('admin_id')
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .maybeSingle()
  if (!link?.admin_id) return null

  // A Telegram link must not preserve admin access after the account is
  // demoted in AbroBiz.
  const { data: profile } = await ctx.db
    .from('profiles')
    .select('id, role, admin_role')
    .eq('id', link.admin_id)
    .in('role', ['admin', 'super_admin'])
    .maybeSingle()
  // The webhook uses a service-role client, so auth.uid()/MFA-based
  // has_admin_permission cannot evaluate the linked administrator. Mirror
  // only the payment-review permission matrix here: super admins, operations,
  // and finance admins may review payments; support/content admins may not.
  if (!profile) return null
  const canReviewPayments = (
    profile.role === 'super_admin' ||
    profile.admin_role === 'super_admin' ||
    profile.admin_role === 'operations' ||
    profile.admin_role === 'finance'
  )
  return canReviewPayments ? String(profile.id) : null
}

async function handleAdminLegacy(chatId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  await ctx.tg.sendMessage(chatId, '🛡️ AbroBiz admin console\n\n/pending — view payments awaiting review\n/info — view platform information\n/support — contact AbroBiz support')
}

async function handleAdmin(chatId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  await ctx.tg.sendMessage(chatId, 'AbroBiz admin console\n\nReview payment proofs, approve valid payments, or reject with a reason.', { replyMarkup: adminKeyboard })
}

async function handlePendingLegacy(chatId: string, ctx: Ctx): Promise<void> {
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

async function handlePending(chatId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  const { data: payments } = await ctx.db
    .from('payments')
    .select('id, amount_etb, created_at, telegram_proof_id, plans(name), businesses(name)')
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
    const caption = `${businessName}\nPlan: ${planName}\nAmount: ${payment.amount_etb} ETB`
    const keyboard = buildInlineKeyboard([[
      { text: '✅ Approve', callback_data: `approve:${payment.id}` },
      { text: '❌ Reject', callback_data: `reject:${payment.id}` },
    ]])
    let fileId: string | undefined
    if ((payment as any).telegram_proof_id) {
      const { data: proof } = await ctx.db.from('telegram_payment_proofs').select('telegram_file_id').eq('id', (payment as any).telegram_proof_id).maybeSingle()
      fileId = proof?.telegram_file_id ?? undefined
    }
    if (fileId) await ctx.tg.sendPhoto(chatId, fileId, { caption, replyMarkup: keyboard })
    else await ctx.tg.sendMessage(chatId, `${caption}\n\nOpen the AbroBiz admin dashboard to view the legacy proof.`, { replyMarkup: keyboard })
  }
}

async function handleConnectCommand(chatId: string, username: string | undefined, token: string | undefined, ctx: Ctx): Promise<void> {
  if (!token) {
    await ctx.tg.sendMessage(chatId, 'Open AbroBiz Dashboard → Billing → Connect Telegram, then open the secure link. You can also send /connect followed by the token from that link.')
    return
  }
  if (!/^(?:pay_)?[A-Fa-f0-9]{32}$/.test(token)) {
    await ctx.tg.sendMessage(chatId, 'That connection token is invalid or expired. Generate a fresh Connect Telegram link from your AbroBiz dashboard.')
    return
  }
  await handleStart(chatId, username, token, ctx)
}

async function handleDisconnectCommand(chatId: string, ctx: Ctx): Promise<void> {
  const disconnected = await disconnectChat(chatId, ctx)
  await ctx.tg.sendMessage(chatId, disconnected
    ? '✅ Telegram has been disconnected from AbroBiz. Your old connection link was invalidated.'
    : 'This Telegram account is not currently connected to AbroBiz.', { replyMarkup: infoKeyboard })
}

async function handleMessage(msg: TelegramMessage, ctx: Ctx): Promise<void> {
  const chatId = String(msg.chat.id)

  if (msg.photo && msg.photo.length > 0) {
    return handlePhoto(chatId, msg.photo, ctx)
  }

  const text = msg.text?.trim()
  if (!text) return

  const { data: adminPending } = await ctx.db.from('telegram_admin_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (adminPending?.state === 'awaiting_custom_reason' && !text.startsWith('/')) {
    await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
    const syntheticCallback: TelegramCallbackQuery = {
      id: `text-${msg.message_id}`,
      from: msg.from ?? { id: Number(chatId) },
      message: { message_id: msg.message_id, chat: msg.chat, from: msg.from },
      data: `reject:${adminPending.payment_id}`,
    }
    await handleApproval(chatId, syntheticCallback, adminPending.payment_id, 'reject', ctx, text)
    return
  }

  const [rawCommand, ...args] = text.split(/\s+/)
  const command = rawCommand.toLowerCase().split('@')[0]

  if (command === '/start') {
    const token = args[0]?.trim()
    if (token && msg.chat.type !== 'private') {
      await ctx.tg.sendMessage(chatId, 'For account security, open this bot in a private chat before connecting AbroBiz.')
      return
    }
    return handleStart(chatId, msg.from?.username, token, ctx)
  }
  if (command === '/connect') {
    if (msg.chat.type !== 'private') {
      await ctx.tg.sendMessage(chatId, 'For account security, connect AbroBiz from a private chat with this bot.')
      return
    }
    return handleConnectCommand(chatId, msg.from?.username, args[0]?.trim(), ctx)
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
  if (command === '/disconnect') {
    if (msg.chat.type !== 'private') {
      await ctx.tg.sendMessage(chatId, 'For account security, disconnect AbroBiz from a private chat with this bot.')
      return
    }
    return handleDisconnectCommand(chatId, ctx)
  }
  if (command === '/cancel') {
    await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
    await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
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
      await ctx.tg.sendMessage(chatId, "You're already connected. Send /pay to submit a payment or /info to see all commands.", { replyMarkup: accountKeyboard })
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
    const { error: businessLinkError } = await ctx.db
      .from('business_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', businessLink.id)
    if (businessLinkError) {
      await ctx.tg.sendMessage(chatId, 'This Telegram account is already connected elsewhere. Disconnect that connection first, then try again.')
      return
    }
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
    const { error: adminLinkError } = await ctx.db
      .from('admin_telegram_links')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null, linked_at: new Date().toISOString() })
      .eq('id', adminLink.id)
    if (adminLinkError) {
      await ctx.tg.sendMessage(chatId, 'This Telegram account is already connected elsewhere. Disconnect that connection first, then try again.')
      return
    }
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

  await ctx.db.from('telegram_pending_actions').upsert({ telegram_chat_id: chatId, business_id: link.business_id, plan_id: null, payment_method_id: null, state: 'awaiting_plan', updated_at: new Date().toISOString() })

  const keyboard = buildInlineKeyboard(
    plans.map(p => [{ text: `${p.name} \u2014 ${p.price_etb} ETB/${p.billing_interval}`, callback_data: `pay_plan:${p.id}` }])
  )
  await ctx.tg.sendMessage(chatId, 'Choose a plan:', { replyMarkup: keyboard })
}

// ── Callback (inline button) queries ────────────────────────────────────

async function handlePhoto(chatId: string, photos: TelegramPhotoSize[], ctx: Ctx): Promise<void> {
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending || pending.state !== 'awaiting_proof' || !pending.business_id || !pending.plan_id || !pending.payment_method_id) {
    await ctx.tg.sendMessage(chatId, 'Send /pay first to choose a plan and payment method, then send your proof photo.')
    return
  }

  const paymentChannel = configuredPaymentChannel(ctx)
  if (!paymentChannel) {
    await ctx.tg.sendMessage(chatId, 'Payment proof submission is temporarily unavailable. Please contact /support.')
    return
  }
  const { data: plan } = await ctx.db.from('plans').select('id, price_etb, billing_interval').eq('id', pending.plan_id).eq('is_active', true).eq('is_trial', false).single()
  if (!plan) {
    await ctx.tg.sendMessage(chatId, "That plan isn't available anymore — send /pay to start over.")
    return
  }
  const { data: existingPending } = await ctx.db.from('payments').select('id').eq('business_id', pending.business_id).eq('status', 'pending').maybeSingle()
  if (existingPending?.id) {
    await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
    await ctx.tg.sendMessage(chatId, 'A payment is already waiting for admin review. Please wait for the confirmation message.')
    return
  }

  const largest = photos[photos.length - 1]
  const archiveReference = crypto.randomUUID()
  const archived = await ctx.tg.sendPhoto(paymentChannel, largest.file_id, {
    caption: ['AbroBiz payment proof', `Business ID: ${pending.business_id}`, `Reference: ${archiveReference}`].join('\\n'),
  })
  const archivedMessage = archived.result as { message_id?: number; photo?: Array<{ file_id?: string }> } | undefined
  const telegramMessageId = archivedMessage?.message_id
  const telegramFileId = archivedMessage?.photo?.at(-1)?.file_id ?? largest.file_id
  if (!Number.isSafeInteger(telegramMessageId) || !telegramFileId) {
    await ctx.tg.sendMessage(chatId, 'Telegram did not confirm the archived receipt. Please send the photo again or contact /support.')
    return
  }

  const { data: owner } = await ctx.db.from('businesses').select('owner_id').eq('id', pending.business_id).single()
  const { data: proof, error: proofError } = await ctx.db
    .from('telegram_payment_proofs')
    .insert({
      business_id: pending.business_id,
      client_upload_id: archiveReference,
      telegram_channel_id: paymentChannel,
      telegram_message_id: telegramMessageId,
      telegram_file_id: telegramFileId,
      content_type: 'image/jpeg',
      uploaded_by: owner?.owner_id,
    })
    .select('id')
    .single()
  if (proofError || !proof?.id) {
    logEvent('error', { service: 'abrobiz-edge', function_name: 'telegram-webhook', operation: 'record_payment_proof', error_category: 'DATABASE_ERROR', error_code: proofError?.code ?? 'unknown', outcome: 'failed' })
    await ctx.tg.sendMessage(chatId, `The receipt was archived, but the payment record could not be created. Please contact /support with reference ${archiveReference}.`)
    return
  }

  const { data: payment, error: insertError } = await ctx.db.rpc('submit_telegram_payment_idempotent', {
    p_idempotency_key: `tg_${archiveReference}`,
    p_business_id: pending.business_id,
    p_plan_id: pending.plan_id,
    p_billing_cycle: plan.billing_interval,
    p_amount_etb: plan.price_etb,
    p_payment_method_id: pending.payment_method_id,
    p_telegram_proof_id: proof.id,
    p_owner_note: '',
  })
  if (insertError || !payment?.id) {
    logEvent('error', { service: 'abrobiz-edge', function_name: 'telegram-webhook', operation: 'insert_payment', error_category: 'DATABASE_ERROR', error_code: insertError?.code ?? 'unknown', outcome: 'failed' })
    await ctx.tg.sendMessage(chatId, `The receipt was archived, but the payment could not be submitted. Please contact /support with reference ${archiveReference}.`)
    return
  }

  await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
  await ctx.tg.sendMessage(chatId, '✅ Submitted! Your receipt is archived securely. We will review it and let you know here.')
  await notifyAdminsOfPayment(ctx.db, ctx.tg, payment.id)
}

async function handlePlanSelected(chatId: string, planId: string, ctx: Ctx): Promise<void> {
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending?.business_id || pending.state !== 'awaiting_plan') {
    await ctx.tg.sendMessage(chatId, 'This payment session has expired. Send /pay to start again.')
    return
  }
  const { data: plan } = await ctx.db.from('plans').select('id, name, price_etb, billing_interval').eq('id', planId).eq('is_active', true).eq('is_trial', false).maybeSingle()
  if (!plan) {
    await ctx.tg.sendMessage(chatId, 'That plan is no longer available. Send /pay to choose another plan.')
    return
  }
  await ctx.db.from('telegram_pending_actions').update({ plan_id: plan.id, payment_method_id: null, state: 'awaiting_method', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
  const { data: methods } = await ctx.db.from('payment_methods').select('id, name').eq('is_active', true).order('sort_order', { ascending: true })
  if (!methods || methods.length === 0) {
    await ctx.tg.sendMessage(chatId, 'No payment methods are configured yet — please contact /support.')
    return
  }
  await ctx.tg.sendMessage(chatId, `Plan selected: ${plan.name} — ${plan.price_etb} ETB/${plan.billing_interval}. How are you paying?`, {
    replyMarkup: buildInlineKeyboard(methods.map(method => [{ text: method.name, callback_data: `pay_method:${method.id}` }])),
  })
}

async function handleMethodSelected(chatId: string, methodId: string, ctx: Ctx): Promise<void> {
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending?.business_id || pending.state !== 'awaiting_method' || !pending.plan_id) {
    await ctx.tg.sendMessage(chatId, 'This payment session has expired. Send /pay to start again.')
    return
  }
  const { data: method } = await ctx.db.from('payment_methods').select('id, name, account_name, account_number, instructions').eq('id', methodId).eq('is_active', true).maybeSingle()
  const { data: plan } = await ctx.db.from('plans').select('name, price_etb, billing_interval').eq('id', pending.plan_id).eq('is_active', true).eq('is_trial', false).maybeSingle()
  if (!method || !plan) {
    await ctx.tg.sendMessage(chatId, 'That payment option is no longer available. Send /pay to start again.')
    return
  }
  await ctx.db.from('telegram_pending_actions').update({ payment_method_id: method.id, state: 'awaiting_proof', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
  const text = [
    `Send payment via ${method.name}:`,
    `${method.account_name} — ${method.account_number}`,
    `Full payment required: ${plan.price_etb} ETB/${plan.billing_interval}`,
    method.instructions,
    '',
    'Then send one clear photo of your receipt here. Use /cancel to stop.',
  ].filter(Boolean).join('\n')
  await ctx.tg.sendMessage(chatId, text, { replyMarkup: buildInlineKeyboard([[{ text: 'Cancel', callback_data: 'pay:cancel' }]]) })
}

async function handleCallback(cb: TelegramCallbackQuery, ctx: Ctx): Promise<void> {
  const chatId = String(cb.message?.chat.id ?? cb.from.id)
  const data = cb.data ?? ''

  try {
    if (data === 'pay:cancel') {
      await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
      await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
      await ctx.tg.sendMessage(chatId, 'Payment session cancelled.')
    } else if (data === 'admin:pending') {
      await handlePending(chatId, ctx)
    } else if (data === 'admin:info') {
      if (await isLinkedAdmin(chatId, ctx)) await handleInfoForChat(chatId, ctx)
      else await ctx.tg.sendMessage(chatId, 'This admin menu is no longer authorized.')
    } else if (data === 'admin:support') {
      if (await isLinkedAdmin(chatId, ctx)) await ctx.tg.sendMessage(chatId, supportMessage())
      else await ctx.tg.sendMessage(chatId, 'This admin menu is no longer authorized.')
    } else if (data === 'account:disconnect') {
      if (cb.message?.chat.type !== 'private' || String(cb.from.id) !== chatId) {
        await ctx.tg.sendMessage(chatId, 'This account control is only available from your private AbroBiz chat.')
      } else {
        await handleDisconnectCommand(chatId, ctx)
      }
    } else if (data === 'info:plans') {
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
      await handleRejectStart(chatId, cb, data.slice('reject:'.length), ctx)
    } else if (data.startsWith('reject_reason:')) {
      const [, paymentId, reasonCode] = data.split(':')
      await handleRejectReason(chatId, cb, paymentId ?? '', reasonCode ?? '', ctx)
    }
  } finally {
    await ctx.tg.answerCallbackQuery(cb.id).catch(() => {})
  }
}

async function handleRejectStart(chatId: string, cb: TelegramCallbackQuery, paymentId: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, "You're not connected as an admin, so this button doesn't work here.")
    return
  }
  if (cb.message?.chat.type !== 'private' || String(cb.from.id) !== chatId) {
    await ctx.tg.sendMessage(chatId, 'This approval request is not authorized.')
    return
  }
  const { data: payment } = await ctx.db.from('payments').select('id').eq('id', paymentId).eq('status', 'pending').maybeSingle()
  if (!payment) {
    await ctx.tg.sendMessage(chatId, 'This payment has already been handled.')
    return
  }
  await ctx.db.from('telegram_admin_pending_actions').upsert({ telegram_chat_id: chatId, payment_id: paymentId, state: 'awaiting_rejection_reason', updated_at: new Date().toISOString() })
  await ctx.tg.sendMessage(chatId, 'Choose a rejection reason:', {
    replyMarkup: buildInlineKeyboard([
      [{ text: 'Receipt unclear', callback_data: `reject_reason:${paymentId}:unclear` }],
      [{ text: 'Wrong amount', callback_data: `reject_reason:${paymentId}:amount` }],
      [{ text: 'Invalid receipt', callback_data: `reject_reason:${paymentId}:invalid` }],
      [{ text: 'Other reason', callback_data: `reject_reason:${paymentId}:other` }],
      [{ text: 'Cancel', callback_data: 'pay:cancel' }],
    ]),
  })
}

async function handleRejectReason(chatId: string, cb: TelegramCallbackQuery, paymentId: string, reasonCode: string, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx) || cb.message?.chat.type !== 'private' || String(cb.from.id) !== chatId) {
    await ctx.tg.sendMessage(chatId, 'This approval request is not authorized.')
    return
  }
  const { data: pending } = await ctx.db.from('telegram_admin_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending || pending.payment_id !== paymentId || pending.state !== 'awaiting_rejection_reason') {
    await ctx.tg.sendMessage(chatId, 'This rejection session has expired. Use /pending to load the payment again.')
    return
  }
  if (reasonCode === 'other') {
    await ctx.db.from('telegram_admin_pending_actions').update({ state: 'awaiting_custom_reason', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
    await ctx.tg.sendMessage(chatId, 'Send a short rejection reason, or use /cancel to stop.')
    return
  }
  const reasons: Record<string, string> = {
    unclear: 'The receipt is unclear or unreadable.',
    amount: 'The receipt amount does not match the selected plan.',
    invalid: 'The receipt could not be verified.',
  }
  await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
  await handleApproval(chatId, cb, paymentId, 'reject', ctx, reasons[reasonCode] ?? 'Rejected via Telegram')
}

async function handleApproval(
  adminChatId: string,
  cb: TelegramCallbackQuery,
  paymentId: string,
  action: 'approve' | 'reject',
  ctx: Ctx,
  rejectionReason = 'Rejected via Telegram',
): Promise<void> {
  const adminId = await linkedAdminId(adminChatId, ctx)
  if (!adminId) {
    await ctx.tg.sendMessage(adminChatId, "You're not connected as an admin, so this button doesn't work here.")
    return
  }

  if (cb.message?.chat.type !== 'private' || String(cb.from.id) !== adminChatId) {
    await ctx.tg.sendMessage(adminChatId, 'This approval request is not authorized.')
    return
  }

  const rpcName = action === 'approve' ? 'telegram_admin_approve_payment' : 'telegram_admin_reject_payment'
  const rpcArgs = action === 'approve'
    ? { p_payment_id: paymentId, p_admin_id: adminId }
    : { p_payment_id: paymentId, p_admin_id: adminId, p_reason: rejectionReason.slice(0, 1000) }

  const { error } = await ctx.db.rpc(rpcName, rpcArgs)
  const messageId = cb.message?.message_id
  const by = cb.from.username ? `@${cb.from.username}` : 'an admin'

  if (error) {
    const alreadyReviewed = /already reviewed/i.test(error.message)
    const text = alreadyReviewed ? '\u26A0\uFE0F Already handled by another admin.' : 'Something went wrong. Please use the admin dashboard.'
    if (messageId) {
      const edit = cb.message?.photo?.length ? ctx.tg.editMessageCaption(adminChatId, messageId, text) : ctx.tg.editMessageText(adminChatId, messageId, text)
      await edit.catch(() => {})
    }
    return
  }

  const resultText = action === 'approve' ? `\u2705 Approved by ${by}` : `\u274C Rejected by ${by}`
  if (messageId) {
    const edit = cb.message?.photo?.length ? ctx.tg.editMessageCaption(adminChatId, messageId, resultText) : ctx.tg.editMessageText(adminChatId, messageId, resultText)
    await edit.catch(() => {})
  }

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
