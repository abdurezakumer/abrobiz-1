import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { checkBearerSecret } from '../_shared/endpointSecurity.ts'
import { readBoundedBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

export interface CronResult {
  expiredCount: number
  reminderCount: number
}

/**
 * Two jobs in one pass, run daily:
 *  1. Flip trial/active subscriptions whose end_date has passed to 'expired'
 *     and notify the owner. The storefront itself is NOT auto-unpublished —
 *     that's a deliberate choice (see SETUP.md); an admin can block a
 *     business manually if they want harder enforcement.
 *  2. Send a one-time reminder to subscriptions expiring in exactly 3 days,
 *     tracked via reminder_sent_at so it only goes out once.
 */
export async function runSubscriptionCron(db: SupabaseClient, tg: TelegramClient | null): Promise<CronResult> {
  const today = new Date().toISOString().slice(0, 10)

  const expiredCount = await expireOverdueSubscriptions(db, tg, today)
  const reminderCount = await sendUpcomingExpiryReminders(db, tg, today)

  return { expiredCount, reminderCount }
}

async function expireOverdueSubscriptions(db: SupabaseClient, tg: TelegramClient | null, today: string): Promise<number> {
  const { data: overdue } = await db
    .from('subscriptions')
    .select('id, business_id, businesses(owner_id, name)')
    .in('status', ['trial', 'active'])
    .lt('end_date', today)
    .limit(1000)

  if (!overdue || overdue.length === 0) return 0

  for (const sub of overdue) {
    const { data: claimed } = await db
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sub.id)
      .in('status', ['trial', 'active'])
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    const ownerId = (sub as any).businesses?.owner_id
    const businessName = (sub as any).businesses?.name ?? 'Your business'
    if (ownerId) {
      await db.from('notifications').insert({
        user_id: ownerId,
        type: 'subscription_expired',
        title: 'Subscription expired',
        body: `${businessName}'s subscription has expired. Renew from Billing to keep your site current.`,
        link: '/dashboard/billing',
      })
    }
    await notifyOwnerTelegram(db, tg, sub.business_id, `\u23F0 ${businessName}'s subscription just expired. Renew anytime from your dashboard\u2019s Billing page, or send /pay here.`)
  }

  return overdue.length
}

async function sendUpcomingExpiryReminders(db: SupabaseClient, tg: TelegramClient | null, today: string): Promise<number> {
  const reminderDate = addDays(today, 3)

  const { data: soonToExpire } = await db
    .from('subscriptions')
    .select('id, business_id, businesses(owner_id, name)')
    .in('status', ['trial', 'active'])
    .eq('end_date', reminderDate)
    .is('reminder_sent_at', null)
    .limit(1000)

  if (!soonToExpire || soonToExpire.length === 0) return 0

  for (const sub of soonToExpire) {
    const { data: claimed } = await db
      .from('subscriptions')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', sub.id)
      .is('reminder_sent_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    const ownerId = (sub as any).businesses?.owner_id
    const businessName = (sub as any).businesses?.name ?? 'Your business'
    if (ownerId) {
      await db.from('notifications').insert({
        user_id: ownerId,
        type: 'subscription_reminder',
        title: 'Subscription ending soon',
        body: `${businessName}'s subscription ends in 3 days. Renew from Billing to avoid interruption.`,
        link: '/dashboard/billing',
      })
    }
    await notifyOwnerTelegram(db, tg, sub.business_id, `\u23F3 Heads up \u2014 ${businessName}'s subscription ends in 3 days. Renew from your dashboard, or send /pay here anytime.`)
  }

  return soonToExpire.length
}

async function notifyOwnerTelegram(db: SupabaseClient, tg: TelegramClient | null, businessId: string, text: string): Promise<void> {
  if (!tg) return
  const { data: link } = await db
    .from('business_telegram_links')
    .select('telegram_chat_id')
    .eq('business_id', businessId)
    .not('telegram_chat_id', 'is', null)
    .maybeSingle()
  if (link?.telegram_chat_id) {
    await tg.sendMessage(link.telegram_chat_id, text).catch(() => {})
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── HTTP entry point ─────────────────────────────────────────────────────

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const authStatus = checkBearerSecret(req.headers.get('Authorization'), Deno.env.get('CRON_SECRET'))
    if (authStatus === 'missing') {
      return new Response('Service unavailable', { status: 503 })
    }
    if (authStatus === 'invalid') {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const bounded = await readBoundedBody(req, 1024)
      if (bounded.error) return new Response(JSON.stringify({ error: bounded.error }), { status: bounded.status ?? 413, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      const db = createAdminClient()
      await db.rpc('purge_phase3_request_state').catch(error => logFailure(req, { function_name: 'subscription-cron', operation: 'purge_request_state', error_category: 'DATABASE_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 }))
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
      const tg = token ? new TelegramClient(token) : null
      const result = await runSubscriptionCron(db, tg)
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    } catch (err) {
      logFailure(req, { function_name: 'subscription-cron', operation: 'subscription_maintenance', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', status: 500 })
      return new Response(JSON.stringify({ error: 'Scheduled task failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    }
  })
}
