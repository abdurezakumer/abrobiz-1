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
import { buildTelegramProofCaption, buildTelegramProofMetadataMessage } from '../_shared/telegramProof.ts'

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
  [{ text: 'Payment history', callback_data: 'admin:history' }],
  [{ text: 'Approved', callback_data: 'admin:history:approved' }, { text: 'Rejected', callback_data: 'admin:history:rejected' }],
  [{ text: 'Platform info', callback_data: 'admin:info' }, { text: 'Support', callback_data: 'admin:support' }],
])

const superAdminKeyboard = buildInlineKeyboard([
  [{ text: 'Overview', callback_data: 'super:overview' }, { text: 'Admins', callback_data: 'super:admins' }],
  [{ text: 'Find user', callback_data: 'super:users' }, { text: 'Payments', callback_data: 'super:payments' }],
  [{ text: 'Payment review', callback_data: 'admin:pending' }, { text: 'Payment history', callback_data: 'admin:history' }],
  [{ text: 'Audit activity', callback_data: 'super:audit' }],
  [{ text: 'Close console', callback_data: 'super:exit' }],
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
      '/payments — admin payment history with filters',
      '/superadmin — private super-admin console for authorized accounts',
      '/support — contact AbroBiz support',
      '/admin — admin tools for authorized administrators',
    ].join('\n'),
    { replyMarkup: infoKeyboard },
  )
}

async function handlePlans(chatId: string, ctx: Ctx): Promise<void> {
  const { data: plans } = await ctx.db
    .from('plans')
    .select('id, name, features')
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
    lines.pop()
    const [monthly, annual] = await Promise.all([
      ctx.db.rpc('plan_price_for_cycle', { p_plan_id: plan.id, p_billing_cycle: 'month' }),
      ctx.db.rpc('plan_price_for_cycle', { p_plan_id: plan.id, p_billing_cycle: 'year' }),
    ])
    lines.push(`${plan.name} — ${Number(monthly.data ?? 0)} ETB/month · ${Number(annual.data ?? 0)} ETB/year`)
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

async function linkedSuperAdminId(chatId: string, ctx: Ctx): Promise<string | null> {
  const { data: link } = await ctx.db
    .from('admin_telegram_links')
    .select('admin_id')
    .eq('telegram_chat_id', chatId)
    .not('linked_at', 'is', null)
    .maybeSingle()
  if (!link?.admin_id) return null
  const { data: profile } = await ctx.db
    .from('profiles')
    .select('id, role, admin_role')
    .eq('id', link.admin_id)
    .maybeSingle()
  if (!profile || (profile.role !== 'super_admin' && profile.admin_role !== 'super_admin')) return null
  return String(profile.id)
}

type SuperAdminSessionState = 'menu' | 'awaiting_user_search'

type SuperAdminSession = {
  admin_id: string
  state: SuperAdminSessionState
  payload: Record<string, unknown>
  expires_at: string
}

async function getSuperAdminSession(chatId: string, ctx: Ctx): Promise<{ adminId: string; session: SuperAdminSession } | null> {
  const adminId = await linkedSuperAdminId(chatId, ctx)
  if (!adminId) return null
  const { data: session } = await ctx.db
    .from('telegram_super_admin_sessions')
    .select('admin_id, state, payload, expires_at')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (!session || session.admin_id !== adminId || Date.parse(String(session.expires_at)) <= Date.now()) {
    await ctx.db.from('telegram_super_admin_sessions').delete().eq('telegram_chat_id', chatId)
    return null
  }
  return {
    adminId,
    session: {
      admin_id: String(session.admin_id),
      state: session.state as SuperAdminSessionState,
      payload: session.payload && typeof session.payload === 'object' && !Array.isArray(session.payload) ? session.payload : {},
      expires_at: String(session.expires_at),
    },
  }
}

async function saveSuperAdminSession(chatId: string, adminId: string, state: SuperAdminSessionState, ctx: Ctx, payload: Record<string, unknown> = {}): Promise<void> {
  // The webhook always uses the service-role client, so the short-lived FSM
  // state cannot be read or forged from the browser.
  await ctx.db.from('telegram_super_admin_sessions').upsert({
    telegram_chat_id: chatId,
    admin_id: adminId,
    state,
    payload,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })
}

async function clearSuperAdminSession(chatId: string, ctx: Ctx): Promise<void> {
  await ctx.db.from('telegram_super_admin_sessions').delete().eq('telegram_chat_id', chatId)
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
  const replyMarkup = await linkedSuperAdminId(chatId, ctx)
    ? buildInlineKeyboard([
      [{ text: 'Pending payments', callback_data: 'admin:pending' }],
      [{ text: 'Payment history', callback_data: 'admin:history' }],
      [{ text: 'Approved', callback_data: 'admin:history:approved' }, { text: 'Rejected', callback_data: 'admin:history:rejected' }],
      [{ text: 'Super admin console', callback_data: 'super:menu' }],
      [{ text: 'Platform info', callback_data: 'admin:info' }, { text: 'Support', callback_data: 'admin:support' }],
    ])
    : adminKeyboard
  await ctx.tg.sendMessage(chatId, 'AbroBiz admin console\n\nReview payment proofs, approve valid payments, or reject with a reason.\n\nUse /payments with filters for historical records.', { replyMarkup })
}

async function sendSuperAdminText(chatId: string, value: string, ctx: Ctx, replyMarkup: unknown = superAdminKeyboard): Promise<void> {
  const chunks: string[] = []
  for (let start = 0; start < value.length; start += 3800) chunks.push(value.slice(start, start + 3800))
  if (chunks.length === 0) chunks.push('')
  for (let index = 0; index < chunks.length; index += 1) {
    await ctx.tg.sendMessage(chatId, chunks[index], { replyMarkup: index === chunks.length - 1 ? replyMarkup : undefined })
  }
}

async function requireSuperAdmin(chatId: string, ctx: Ctx): Promise<string | null> {
  const adminId = await linkedSuperAdminId(chatId, ctx)
  if (!adminId) {
    await ctx.tg.sendMessage(chatId, 'This console is available only to the linked AbroBiz super administrator.')
    return null
  }
  return adminId
}

async function handleSuperAdminMenu(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'menu', ctx)
  await ctx.tg.sendMessage(chatId, 'AbroBiz Super Admin Console\n\nChoose a read-only platform operation. Payment review remains available through the existing payment workflow.', { replyMarkup: superAdminKeyboard })
}

async function handleSuperAdminOverview(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'menu', ctx)
  const [users, businesses, published, blocked, pending, approved, rejected, admins] = await Promise.all([
    ctx.db.from('profiles').select('id', { count: 'exact', head: true }),
    ctx.db.from('businesses').select('id', { count: 'exact', head: true }),
    ctx.db.from('businesses').select('id', { count: 'exact', head: true }).eq('is_published', true),
    ctx.db.from('businesses').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
    ctx.db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ctx.db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    ctx.db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ctx.db.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
  ])
  await ctx.tg.sendMessage(chatId, [
    'AbroBiz platform overview',
    '',
    `Users: ${users.count ?? 0}`,
    `Administrators: ${admins.count ?? 0}`,
    `Businesses: ${businesses.count ?? 0}`,
    `Published websites: ${published.count ?? 0}`,
    `Blocked websites: ${blocked.count ?? 0}`,
    '',
    `Payments pending: ${pending.count ?? 0}`,
    `Payments approved: ${approved.count ?? 0}`,
    `Payments rejected: ${rejected.count ?? 0}`,
  ].join('\n'), { replyMarkup: superAdminKeyboard })
}

async function handleSuperAdminAdmins(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'menu', ctx)
  const { data, error } = await ctx.db
    .from('profiles')
    .select('id, platform_id, name, email, phone, role, admin_role, created_at')
    .in('role', ['admin', 'super_admin'])
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) {
    await ctx.tg.sendMessage(chatId, 'The administrator directory is temporarily unavailable.', { replyMarkup: superAdminKeyboard })
    return
  }
  const lines = ['AbroBiz administrator directory', '']
  for (const row of data ?? []) {
    lines.push(
      `${row.name || 'Unnamed'} · ${row.admin_role || row.role}`,
      `ID: ${row.platform_id || row.id}`,
      `Email: ${row.email || '—'}${row.phone ? ` · Phone: ${row.phone}` : ''}`,
      '',
    )
  }
  if (!data?.length) lines.push('No administrators found.')
  await sendSuperAdminText(chatId, lines.join('\n'), ctx)
}

function safeSearchPattern(value: string): string {
  return `%${value.replace(/[%_]/g, '').slice(0, 100)}%`
}

async function handleSuperAdminUserPrompt(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'awaiting_user_search', ctx)
  await ctx.tg.sendMessage(chatId, 'Send a user email, phone number, platform ID, or part of the user name. Send /cancel to return.', {
    replyMarkup: buildInlineKeyboard([[{ text: 'Cancel', callback_data: 'super:cancel' }]]),
  })
}

async function handleSuperAdminUserSearch(chatId: string, value: string, ctx: Ctx): Promise<void> {
  const state = await getSuperAdminSession(chatId, ctx)
  if (!state || state.session.state !== 'awaiting_user_search') {
    await handleSuperAdminMenu(chatId, ctx)
    return
  }
  const term = value.trim().slice(0, 100)
  if (!term) {
    await ctx.tg.sendMessage(chatId, 'Enter a search value, or send /cancel to return.')
    return
  }
  await clearSuperAdminSession(chatId, ctx)
  const pattern = safeSearchPattern(term)
  const results = await Promise.all([
    ctx.db.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').ilike('name', pattern).limit(20),
    ctx.db.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').ilike('email', pattern).limit(20),
    ctx.db.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').ilike('phone', pattern).limit(20),
    ctx.db.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').ilike('platform_id', pattern).limit(20),
  ])
  const users = [...new Map(results.flatMap(result => result.data ?? []).map(row => [row.id, row])).values()]
  const businessRows = users.length
    ? (await ctx.db.from('businesses').select('owner_id, name, slug, is_published, is_blocked').in('owner_id', users.map(row => row.id))).data ?? []
    : []
  const businesses = new Map(businessRows.map(row => [row.owner_id, row]))
  const lines = [`User search: ${term}`, `Matches: ${users.length}`, '']
  for (const user of users.slice(0, 20)) {
    const business = businesses.get(user.id)
    lines.push(
      `${user.name || 'Unnamed'} · ${user.role}${user.admin_role && user.admin_role !== 'none' ? `/${user.admin_role}` : ''}`,
      `ID: ${user.platform_id || user.id}`,
      `Email: ${user.email || '—'}${user.phone ? ` · Phone: ${user.phone}` : ''}`,
      business ? `Business: ${business.name} (${business.slug}.abrobiz.com)${business.is_blocked ? ' · BLOCKED' : business.is_published ? ' · published' : ' · draft'}` : 'Business: none',
      '',
    )
  }
  if (!users.length) lines.push('No matching users found.')
  await sendSuperAdminText(chatId, lines.join('\n'), ctx)
}

async function handleSuperAdminAudit(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'menu', ctx)
  const { data: logs, error } = await ctx.db
    .from('admin_logs')
    .select('id, admin_id, action, target_table, target_id, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    await ctx.tg.sendMessage(chatId, 'The audit activity feed is temporarily unavailable.', { replyMarkup: superAdminKeyboard })
    return
  }
  const actorIds = [...new Set((logs ?? []).map(row => row.admin_id).filter(Boolean))]
  const { data: actors } = actorIds.length
    ? await ctx.db.from('profiles').select('id, name, platform_id').in('id', actorIds)
    : { data: [] }
  const actorMap = new Map((actors ?? []).map(row => [row.id, row]))
  const lines = ['Recent administrator activity', '']
  for (const log of logs ?? []) {
    const actor = actorMap.get(log.admin_id)
    lines.push(
      `${log.created_at} · ${log.action}`,
      `Actor: ${actor?.name || 'Administrator'} (${actor?.platform_id || log.admin_id || 'unknown'})`,
      log.target_table ? `Target: ${log.target_table}${log.target_id ? `/${log.target_id}` : ''}` : '',
      log.meta && Object.keys(log.meta).length ? `Details: ${JSON.stringify(log.meta).slice(0, 700)}` : '',
      '',
    )
  }
  if (!logs?.length) lines.push('No administrator activity has been recorded.')
  await sendSuperAdminText(chatId, lines.filter(line => line !== undefined).join('\n'), ctx)
}

async function handleSuperAdminPayments(chatId: string, ctx: Ctx): Promise<void> {
  const adminId = await requireSuperAdmin(chatId, ctx)
  if (!adminId) return
  await saveSuperAdminSession(chatId, adminId, 'menu', ctx)
  await handlePaymentHistory(chatId, [], ctx)
}

async function handleSuperAdminCallback(cb: TelegramCallbackQuery, ctx: Ctx): Promise<boolean> {
  const data = cb.data ?? ''
  if (!data.startsWith('super:')) return false
  const chatId = String(cb.message?.chat.id ?? cb.from.id)
  if (cb.message?.chat.type !== 'private' || String(cb.from.id) !== chatId) {
    await ctx.tg.sendMessage(chatId, 'The super-admin console is available only in the linked private chat.')
    return true
  }
  if (!await linkedSuperAdminId(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'This super-admin console is no longer authorized.')
    return true
  }
  if (data === 'super:menu') await handleSuperAdminMenu(chatId, ctx)
  else if (data === 'super:overview') await handleSuperAdminOverview(chatId, ctx)
  else if (data === 'super:admins') await handleSuperAdminAdmins(chatId, ctx)
  else if (data === 'super:users') await handleSuperAdminUserPrompt(chatId, ctx)
  else if (data === 'super:payments') await handleSuperAdminPayments(chatId, ctx)
  else if (data === 'super:audit') await handleSuperAdminAudit(chatId, ctx)
  else if (data === 'super:cancel') {
    await clearSuperAdminSession(chatId, ctx)
    await ctx.tg.sendMessage(chatId, 'Search cancelled.', { replyMarkup: superAdminKeyboard })
  } else if (data === 'super:exit') {
    await clearSuperAdminSession(chatId, ctx)
    await ctx.tg.sendMessage(chatId, 'Super-admin console closed. Send /superadmin to open it again.', { replyMarkup: adminKeyboard })
  }
  return true
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

type PaymentHistoryFilters = {
  status?: 'pending' | 'approved' | 'rejected'
  business?: string
  owner?: string
  from?: string
  to?: string
  limit: number
}

function unquoteFilter(value: string): string {
  return value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2').trim().slice(0, 100)
}

function parsePaymentHistoryFilters(args: string[]): { filters?: PaymentHistoryFilters; error?: string } {
  const filters: PaymentHistoryFilters = { limit: 10 }
  const tokens = args.join(' ').match(/(?:[^\s"]+|"[^"]*"|'[^']*')+/g) ?? []
  for (const token of tokens) {
    const separator = token.indexOf('=') >= 0 ? token.indexOf('=') : token.indexOf(':')
    if (separator < 0) {
      const status = token.toLowerCase()
      if (['pending', 'approved', 'rejected'].includes(status)) filters.status = status as PaymentHistoryFilters['status']
      else if (status !== 'all' && status !== 'help') return { error: `Unknown filter "${token}". Use status, business, owner, from, to, or limit.` }
      continue
    }
    const key = token.slice(0, separator).toLowerCase()
    const value = unquoteFilter(token.slice(separator + 1))
    if (key === 'status') {
      if (!['pending', 'approved', 'rejected'].includes(value.toLowerCase())) return { error: 'Status must be pending, approved, or rejected.' }
      filters.status = value.toLowerCase() as PaymentHistoryFilters['status']
    } else if (key === 'business' || key === 'owner') {
      if (!value) return { error: `${key} cannot be empty.` }
      filters[key] = value
    } else if (key === 'from' || key === 'to') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) return { error: `${key} must use YYYY-MM-DD.` }
      filters[key] = value
    } else if (key === 'limit') {
      const limit = Number(value)
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) return { error: 'Limit must be a whole number from 1 to 20.' }
      filters.limit = limit
    } else {
      return { error: `Unknown filter "${key}". Use status, business, owner, from, to, or limit.` }
    }
  }
  if (filters.from && filters.to && filters.from > filters.to) return { error: 'The from date cannot be after the to date.' }
  return { filters }
}

function paymentHistoryHelp(): string {
  return [
    'Payment history filters:',
    '/payments',
    '/payments status=pending',
    '/payments status=approved from=2026-01-01 to=2026-12-31',
    '/payments business="Cafe Name" limit=20',
    '/payments owner=john@example.com',
    '/payment <payment-id>',
    '',
    'Statuses: pending, approved, rejected. Results include owner contact, plan, billing cycle, payment metadata, and Telegram archive IDs.',
  ].join('\n')
}

async function findPaymentBusinessIds(filters: PaymentHistoryFilters, ctx: Ctx): Promise<string[] | null> {
  let businessIds: string[] | null = null
  if (filters.business) {
    const pattern = `%${filters.business.replace(/[%_]/g, '')}%`
    const [{ data: nameRows }, { data: slugRows }] = await Promise.all([
      ctx.db.from('businesses').select('id').ilike('name', pattern).limit(100),
      ctx.db.from('businesses').select('id').ilike('slug', pattern).limit(100),
    ])
    businessIds = [...new Set([...(nameRows ?? []), ...(slugRows ?? [])].map(row => row.id))]
  }
  if (filters.owner) {
    const pattern = `%${filters.owner.replace(/[%_]/g, '')}%`
    const [{ data: names }, { data: emails }, { data: platformIds }] = await Promise.all([
      ctx.db.from('profiles').select('id').ilike('name', pattern).limit(100),
      ctx.db.from('profiles').select('id').ilike('email', pattern).limit(100),
      ctx.db.from('profiles').select('id').ilike('platform_id', pattern).limit(100),
    ])
    const ownerIds = [...new Set([...(names ?? []), ...(emails ?? []), ...(platformIds ?? [])].map(row => row.id))]
    const { data: ownerBusinesses } = ownerIds.length
      ? await ctx.db.from('businesses').select('id').in('owner_id', ownerIds).limit(200)
      : { data: [] }
    const ownerBusinessIds = (ownerBusinesses ?? []).map(row => row.id)
    businessIds = businessIds ? businessIds.filter(id => ownerBusinessIds.includes(id)) : ownerBusinessIds
  }
  return businessIds
}

function addDateFilters(query: any, filters: PaymentHistoryFilters): any {
  let filtered = query
  if (filters.status) filtered = filtered.eq('status', filters.status)
  if (filters.from) filtered = filtered.gte('created_at', `${filters.from}T00:00:00.000Z`)
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    filtered = filtered.lt('created_at', end.toISOString())
  }
  return filtered
}

function formatPaymentRecord(payment: any, owner: any, proof: any, includeMetadata = true): string {
  const business = payment.businesses ?? {}
  const plan = payment.plans ?? {}
  const method = payment.payment_methods ?? {}
  const lines = [
    `Payment: ${payment.id}`,
    `Status: ${payment.status}`,
    `Business: ${business.name ?? 'Business'}${business.slug ? ` (${business.slug}.abrobiz.com)` : ''}`,
    `Owner: ${owner?.name ?? 'Owner'}${owner?.platform_id ? ` · ${owner.platform_id}` : ''}`,
    `Email: ${owner?.email ?? '—'}`,
    `Phone: ${owner?.phone ?? '—'}`,
    `Plan: ${plan.name ?? 'Plan'} · ${payment.billing_cycle ?? '—'}`,
    `Payment method: ${method.name ?? proof?.metadata?.payment?.method_name ?? '—'}`,
    `Amount: ${payment.amount_etb} ETB`,
    payment.owner_note ? `Owner note: ${payment.owner_note}` : '',
    `Created: ${payment.created_at}`,
    payment.reviewed_at ? `Reviewed: ${payment.reviewed_at}` : '',
    payment.rejection_reason ? `Rejection: ${payment.rejection_reason}` : '',
    proof?.telegram_channel_id ? `Archive channel: ${proof.telegram_channel_id}` : '',
    proof?.telegram_message_id ? `Archive message: ${proof.telegram_message_id}` : '',
    proof?.telegram_file_id ? `Archive file ID: ${proof.telegram_file_id}` : '',
    proof?.content_type ? `Proof type: ${proof.content_type}` : '',
    proof?.file_size ? `Proof size: ${proof.file_size} bytes` : '',
    proof?.created_at ? `Proof archived: ${proof.created_at}` : '',
    proof?.consumed_at ? `Proof linked: ${proof.consumed_at}` : '',
    includeMetadata && proof?.metadata ? `Metadata: ${JSON.stringify(proof.metadata).slice(0, 1800)}` : '',
  ]
  return lines.filter(Boolean).join('\n').slice(0, 3900)
}

async function sendPaymentRecord(chatId: string, payment: any, owner: any, proof: any, ctx: Ctx): Promise<void> {
  const caption = formatPaymentRecord(payment, owner, proof)
  const replyMarkup = payment.status === 'pending'
    ? buildInlineKeyboard([[{ text: 'Approve', callback_data: `approve:${payment.id}` }, { text: 'Reject', callback_data: `reject:${payment.id}` }]])
    : undefined
  if (proof?.telegram_file_id) {
    const business = payment.businesses ?? {}
    const mediaCaption = [
      `Payment: ${payment.id}`,
      `Status: ${payment.status}`,
      `Business: ${business.name ?? 'Business'}`,
      `Amount: ${payment.amount_etb} ETB`,
    ].join('\n')
    await ctx.tg.sendPhoto(chatId, proof.telegram_file_id, { caption: mediaCaption, replyMarkup })
    // Telegram captions are limited to 1024 characters. Send the complete
    // audit record separately so admins receive all metadata and identifiers.
    await ctx.tg.sendMessage(chatId, caption)
  } else {
    await ctx.tg.sendMessage(chatId, caption, { replyMarkup })
  }
}

async function loadPaymentContext(paymentIds: string[], ctx: Ctx): Promise<{ owners: Map<string, any>; proofs: Map<string, any> }> {
  const paymentsWithOwners = paymentIds.length
    ? await ctx.db.from('payments').select('id, businesses(owner_id)').in('id', paymentIds)
    : { data: [] }
  const ownerIds = [...new Set((paymentsWithOwners.data ?? []).map((row: any) => row.businesses?.owner_id).filter(Boolean))]
  const proofRows = paymentIds.length
    ? await ctx.db.from('telegram_payment_proofs').select('id, payment_id, telegram_channel_id, telegram_message_id, telegram_file_id, content_type, file_size, consumed_at, created_at, metadata').in('payment_id', paymentIds)
    : { data: [] }
  const { data: ownerRows } = ownerIds.length
    ? await ctx.db.from('profiles').select('id, name, email, phone, platform_id').in('id', ownerIds)
    : { data: [] }
  return {
    owners: new Map((ownerRows ?? []).map((row: any) => [row.id, row])),
    proofs: new Map((proofRows ?? []).map((row: any) => [row.payment_id, row])),
  }
}

async function handlePaymentHistory(chatId: string, args: string[], ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  const parsed = parsePaymentHistoryFilters(args)
  if (parsed.error) {
    await ctx.tg.sendMessage(chatId, `${parsed.error}\n\n${paymentHistoryHelp()}`)
    return
  }
  const filters = parsed.filters!
  if (args.some(arg => arg.toLowerCase() === 'help')) {
    await ctx.tg.sendMessage(chatId, paymentHistoryHelp())
    return
  }
  const businessIds = await findPaymentBusinessIds(filters, ctx)
  if ((filters.business || filters.owner) && !businessIds?.length) {
    await ctx.tg.sendMessage(chatId, 'No payments matched those business or owner filters.')
    return
  }
  let query = ctx.db
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, telegram_proof_id, owner_note, status, reviewed_at, rejection_reason, created_at, plans(name), payment_methods(name), businesses(id, name, slug, owner_id)')
    .order('created_at', { ascending: false })
    .limit(filters.limit)
  if (businessIds) query = query.in('business_id', businessIds)
  query = addDateFilters(query, filters)
  const { data: payments, error } = await query
  if (error) {
    await ctx.tg.sendMessage(chatId, 'Payment history is temporarily unavailable. Please try again.')
    return
  }
  if (!payments?.length) {
    await ctx.tg.sendMessage(chatId, 'No payments matched those filters.')
    return
  }
  const paymentIds = payments.map((payment: any) => payment.id)
  const context = await loadPaymentContext(paymentIds, ctx)
  await ctx.tg.sendMessage(chatId, `Found ${payments.length} payment${payments.length === 1 ? '' : 's'}${filters.status ? ` with status ${filters.status}` : ''}.`)
  for (const payment of payments) {
    const ownerId = payment.businesses?.owner_id
    await sendPaymentRecord(chatId, payment, context.owners.get(ownerId), context.proofs.get(payment.id), ctx)
  }
}

async function handlePaymentDetails(chatId: string, paymentId: string | undefined, ctx: Ctx): Promise<void> {
  if (!await isLinkedAdmin(chatId, ctx)) {
    await ctx.tg.sendMessage(chatId, 'Admin commands are available only to an authorized AbroBiz administrator.')
    return
  }
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
    await ctx.tg.sendMessage(chatId, 'Usage: /payment <payment-id>')
    return
  }
  const { data: payment, error } = await ctx.db.from('payments').select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, telegram_proof_id, owner_note, status, reviewed_at, rejection_reason, created_at, plans(name), payment_methods(name), businesses(id, name, slug, owner_id)').eq('id', paymentId).maybeSingle()
  if (error || !payment) {
    await ctx.tg.sendMessage(chatId, 'Payment not found.')
    return
  }
  const context = await loadPaymentContext([payment.id], ctx)
  await sendPaymentRecord(chatId, payment, context.owners.get(payment.businesses?.owner_id), context.proofs.get(payment.id), ctx)
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
    return handlePhoto(chatId, msg, ctx)
  }

  const text = msg.text?.trim()
  if (!text) return

  const superSession = await getSuperAdminSession(chatId, ctx)
  if (superSession?.session.state === 'awaiting_user_search' && !text.startsWith('/')) {
    await handleSuperAdminUserSearch(chatId, text, ctx)
    return
  }

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
  if (command === '/superadmin' || command === '/sa') {
    if (msg.chat.type !== 'private') {
      await ctx.tg.sendMessage(chatId, 'For security, open the super-admin console from the linked private chat.')
      return
    }
    return handleSuperAdminMenu(chatId, ctx)
  }
  if (command === '/admin') {
    return handleAdmin(chatId, ctx)
  }
  if (command === '/pending') {
    return handlePending(chatId, ctx)
  }
  if (command === '/payments' || command === '/history') {
    return handlePaymentHistory(chatId, args, ctx)
  }
  if (command === '/payment') {
    return handlePaymentDetails(chatId, args[0]?.trim(), ctx)
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
    await clearSuperAdminSession(chatId, ctx)
    await ctx.tg.sendMessage(chatId, 'Cancelled.')
    return
  }

  await ctx.tg.sendMessage(chatId, "I didn't understand that. Use /info, /plans, /support, /pay, or /cancel.")
}

async function handleStart(chatId: string, username: string | undefined, token: string | undefined, ctx: Ctx): Promise<void> {
  if (!token) {
    const { data: business } = await ctx.db.from('business_telegram_links').select('id').eq('telegram_chat_id', chatId).maybeSingle()
    const { data: admin } = await ctx.db.from('admin_telegram_links').select('id, admin_id').eq('telegram_chat_id', chatId).maybeSingle()
    if (admin) {
      const superAdmin = Boolean(await linkedSuperAdminId(chatId, ctx))
      const paymentAdmin = await isLinkedAdmin(chatId, ctx)
      await ctx.tg.sendMessage(chatId, superAdmin
        ? 'You are connected as the AbroBiz Super Admin. Open the platform console below or use /superadmin.'
        : paymentAdmin
          ? 'You are connected as an AbroBiz administrator. Payment approvals and admin tools are available below.'
          : 'You are connected to AbroBiz. Your current administrator role does not include payment-review tools.',
      { replyMarkup: superAdmin ? superAdminKeyboard : paymentAdmin ? adminKeyboard : infoKeyboard })
    } else if (business) {
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
    ? await ctx.db.from('profiles').select('id, role, admin_role').eq('id', adminLink.admin_id).in('role', ['admin', 'super_admin']).maybeSingle()
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
    const superAdmin = adminProfile.role === 'super_admin' || adminProfile.admin_role === 'super_admin'
    const paymentAdmin = await isLinkedAdmin(chatId, ctx)
    await ctx.tg.sendMessage(chatId, superAdmin
      ? '\u2705 You\u2019re connected as the AbroBiz Super Admin. Use the console below to manage the platform, administrators, users, payments, and audit activity.'
      : paymentAdmin
        ? '\u2705 You\u2019re connected as an AbroBiz administrator. Payment approval requests will show up here with Approve/Reject buttons.'
        : '\u2705 You\u2019re connected to AbroBiz. Your current administrator role does not include payment-review tools.',
    { replyMarkup: superAdmin ? superAdminKeyboard : paymentAdmin ? adminKeyboard : infoKeyboard })
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

async function handlePhoto(chatId: string, msg: TelegramMessage, ctx: Ctx): Promise<void> {
  const photos = msg.photo ?? []
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending || pending.state !== 'awaiting_proof' || !pending.business_id || !pending.plan_id || !pending.payment_method_id || !pending.billing_cycle) {
    await ctx.tg.sendMessage(chatId, 'Send /pay first to choose a plan and payment method, then send your proof photo.')
    return
  }

  const paymentChannel = configuredPaymentChannel(ctx)
  if (!paymentChannel) {
    await ctx.tg.sendMessage(chatId, 'Payment proof submission is temporarily unavailable. Please contact /support.')
    return
  }
  const { data: plan } = await ctx.db.from('plans').select('id, name').eq('id', pending.plan_id).eq('is_active', true).eq('is_trial', false).single()
  const { data: method } = await ctx.db.from('payment_methods').select('id, name').eq('id', pending.payment_method_id).eq('is_active', true).maybeSingle()
  const { data: business } = await ctx.db.from('businesses').select('id, name, slug, owner_id').eq('id', pending.business_id).maybeSingle()
  const { data: owner } = business?.owner_id
    ? await ctx.db.from('profiles').select('id, name, email, phone, platform_id').eq('id', business.owner_id).maybeSingle()
    : { data: null }
  const { data: calculatedAmount } = plan ? await ctx.db.rpc('plan_price_for_cycle', { p_plan_id: pending.plan_id, p_billing_cycle: pending.billing_cycle }) : { data: null }
  const amountEtb = Number(calculatedAmount)
  if (!plan || !method || !business || !owner || !Number.isFinite(amountEtb)) {
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
  const metadata: Record<string, unknown> = {
    schema_version: 1,
    source: 'telegram_bot',
    client_upload_id: archiveReference,
    content_type: 'image/jpeg',
    file_size: largest.file_size ?? null,
    uploaded_at: new Date().toISOString(),
    business: { id: business.id, name: business.name, slug: business.slug },
    owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, platform_id: owner.platform_id },
    plan: { id: plan.id, name: plan.name },
    payment: { billing_cycle: pending.billing_cycle, amount_etb: amountEtb, payment_method_id: method.id, method_name: method.name, status: 'pending' },
    telegram: {
      chat_id: chatId,
      username: msg.from?.username ?? null,
      message_id: msg.message_id,
      photo_file_id: largest.file_id,
      width: largest.width,
      height: largest.height,
      available_sizes: photos.length,
    },
    archive: { channel_id: paymentChannel },
  }
  const archived = await ctx.tg.sendPhoto(paymentChannel, largest.file_id, {
    caption: buildTelegramProofCaption(metadata),
  })
  const archivedMessage = archived.result as { message_id?: number; photo?: Array<{ file_id?: string }> } | undefined
  const telegramMessageId = archivedMessage?.message_id
  const telegramFileId = archivedMessage?.photo?.at(-1)?.file_id ?? largest.file_id
  if (!Number.isSafeInteger(telegramMessageId) || !telegramFileId) {
    await ctx.tg.sendMessage(chatId, 'Telegram did not confirm the archived receipt. Please send the photo again or contact /support.')
    return
  }
  metadata.archive = { channel_id: paymentChannel, message_id: telegramMessageId, file_id: telegramFileId }
  const metadataMessage = await ctx.tg.sendMessage(paymentChannel, buildTelegramProofMetadataMessage(metadata)).catch(() => null)
  const metadataMessageId = (metadataMessage?.result as { message_id?: number } | undefined)?.message_id
  if (Number.isSafeInteger(metadataMessageId)) {
    metadata.archive = { ...metadata.archive, metadata_message_id: metadataMessageId }
    await ctx.tg.editMessageText(paymentChannel, metadataMessageId as number, buildTelegramProofMetadataMessage(metadata)).catch(() => {})
  }
  const { data: proof, error: proofError } = await ctx.db
    .from('telegram_payment_proofs')
    .insert({
      business_id: pending.business_id,
      client_upload_id: archiveReference,
      telegram_channel_id: paymentChannel,
      telegram_message_id: telegramMessageId,
      telegram_file_id: telegramFileId,
      content_type: 'image/jpeg',
      uploaded_by: owner.id,
      metadata,
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
    p_billing_cycle: pending.billing_cycle,
    p_amount_etb: amountEtb,
    p_payment_method_id: pending.payment_method_id,
    p_telegram_proof_id: proof.id,
    p_owner_note: '',
  })
  if (insertError || !payment?.id) {
    logEvent('error', { service: 'abrobiz-edge', function_name: 'telegram-webhook', operation: 'insert_payment', error_category: 'DATABASE_ERROR', error_code: insertError?.code ?? 'unknown', outcome: 'failed' })
    await ctx.tg.sendMessage(chatId, `The receipt was archived, but the payment could not be submitted. Please contact /support with reference ${archiveReference}.`)
    return
  }

  const paymentMetadata = metadata.payment && typeof metadata.payment === 'object' && !Array.isArray(metadata.payment)
    ? metadata.payment as Record<string, unknown>
    : {}
  metadata.payment = { ...paymentMetadata, id: payment.id, status: 'pending' }
  await ctx.tg.editMessageCaption(paymentChannel, telegramMessageId, buildTelegramProofCaption(metadata, String(payment.id))).catch(() => {})
  if (Number.isSafeInteger(metadataMessageId)) {
    await ctx.tg.editMessageText(paymentChannel, metadataMessageId as number, buildTelegramProofMetadataMessage(metadata)).catch(() => {})
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
  await ctx.db.from('telegram_pending_actions').update({ plan_id: plan.id, billing_cycle: null, payment_method_id: null, state: 'awaiting_cycle', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
  await ctx.tg.sendMessage(chatId, `Plan selected: ${plan.name}. Choose a billing cycle:`, {
    replyMarkup: buildInlineKeyboard([
      [{ text: 'Monthly', callback_data: `pay_cycle:${plan.id}:month` }],
      [{ text: 'Annual', callback_data: `pay_cycle:${plan.id}:year` }],
      [{ text: 'Cancel', callback_data: 'pay:cancel' }],
    ]),
  })
  return
  const { data: methods } = await ctx.db.from('payment_methods').select('id, name').eq('is_active', true).order('sort_order', { ascending: true })
  if (!methods || methods.length === 0) {
    await ctx.tg.sendMessage(chatId, 'No payment methods are configured yet — please contact /support.')
    return
  }
  await ctx.tg.sendMessage(chatId, `Plan selected: ${plan.name} — ${plan.price_etb} ETB/${plan.billing_interval}. How are you paying?`, {
    replyMarkup: buildInlineKeyboard(methods.map(method => [{ text: method.name, callback_data: `pay_method:${method.id}` }])),
  })
}

async function handleCycleSelected(chatId: string, planId: string, cycle: string, ctx: Ctx): Promise<void> {
  if (cycle !== 'month' && cycle !== 'year') {
    await ctx.tg.sendMessage(chatId, 'Please choose a valid billing cycle or send /pay to start again.')
    return
  }
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending?.business_id || pending.state !== 'awaiting_cycle' || pending.plan_id !== planId) {
    await ctx.tg.sendMessage(chatId, 'This payment session has expired. Send /pay to start again.')
    return
  }
  const { data: plan } = await ctx.db.from('plans').select('id, name').eq('id', planId).eq('is_active', true).eq('is_trial', false).maybeSingle()
  const { data: calculatedAmount } = plan ? await ctx.db.rpc('plan_price_for_cycle', { p_plan_id: planId, p_billing_cycle: cycle }) : { data: null }
  if (!plan || !Number.isFinite(Number(calculatedAmount))) {
    await ctx.tg.sendMessage(chatId, 'That plan is no longer available. Send /pay to choose another plan.')
    return
  }
  await ctx.db.from('telegram_pending_actions').update({ billing_cycle: cycle, state: 'awaiting_method', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
  const { data: methods } = await ctx.db.from('payment_methods').select('id, name').eq('is_active', true).order('sort_order', { ascending: true })
  if (!methods || methods.length === 0) {
    await ctx.tg.sendMessage(chatId, 'No payment methods are configured yet — please contact /support.')
    return
  }
  await ctx.tg.sendMessage(chatId, `Plan selected: ${plan.name} — ${Number(calculatedAmount)} ETB/${cycle}. How are you paying?`, {
    replyMarkup: buildInlineKeyboard(methods.map(method => [{ text: method.name, callback_data: `pay_method:${method.id}` }])),
  })
}

async function handleMethodSelected(chatId: string, methodId: string, ctx: Ctx): Promise<void> {
  const { data: pending } = await ctx.db.from('telegram_pending_actions').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  if (!pending?.business_id || pending.state !== 'awaiting_method' || !pending.plan_id || !pending.billing_cycle) {
    await ctx.tg.sendMessage(chatId, 'This payment session has expired. Send /pay to start again.')
    return
  }
  const { data: method } = await ctx.db.from('payment_methods').select('id, name, account_name, account_number, instructions').eq('id', methodId).eq('is_active', true).maybeSingle()
  const { data: plan } = await ctx.db.from('plans').select('name, price_etb, billing_interval').eq('id', pending.plan_id).eq('is_active', true).eq('is_trial', false).maybeSingle()
  const { data: calculatedAmount } = plan ? await ctx.db.rpc('plan_price_for_cycle', { p_plan_id: pending.plan_id, p_billing_cycle: pending.billing_cycle }) : { data: null }
  if (!method || !plan || !Number.isFinite(Number(calculatedAmount))) {
    await ctx.tg.sendMessage(chatId, 'That payment option is no longer available. Send /pay to start again.')
    return
  }
  await ctx.db.from('telegram_pending_actions').update({ payment_method_id: method.id, state: 'awaiting_proof', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId)
  const paymentText = [
    `Send payment via ${method.name}:`,
    `${method.account_name} — ${method.account_number}`,
    `Full payment required: ${Number(calculatedAmount)} ETB/${pending.billing_cycle}`,
    method.instructions,
    '',
    'Then send one clear photo of your receipt here. Use /cancel to stop.',
  ].filter(Boolean).join('\n')
  await ctx.tg.sendMessage(chatId, paymentText, { replyMarkup: buildInlineKeyboard([[{ text: 'Cancel', callback_data: 'pay:cancel' }]]) })
  return
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
    if (await handleSuperAdminCallback(cb, ctx)) {
      return
    } else if (data === 'pay:cancel') {
      await ctx.db.from('telegram_pending_actions').delete().eq('telegram_chat_id', chatId)
      await ctx.db.from('telegram_admin_pending_actions').delete().eq('telegram_chat_id', chatId)
      await clearSuperAdminSession(chatId, ctx)
      await ctx.tg.sendMessage(chatId, 'Payment session cancelled.')
    } else if (data === 'admin:pending') {
      await handlePending(chatId, ctx)
    } else if (data === 'admin:history') {
      await handlePaymentHistory(chatId, [], ctx)
    } else if (data.startsWith('admin:history:')) {
      await handlePaymentHistory(chatId, [`status=${data.slice('admin:history:'.length)}`], ctx)
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
    } else if (data.startsWith('pay_cycle:')) {
      const [, planId, cycle] = data.split(':')
      await handleCycleSelected(chatId, planId ?? '', cycle ?? '', ctx)
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
