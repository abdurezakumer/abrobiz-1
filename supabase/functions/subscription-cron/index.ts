import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'

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

  if (!overdue || overdue.length === 0) return 0

  for (const sub of overdue) {
    await db.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id)

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

  if (!soonToExpire || soonToExpire.length === 0) return 0

  for (const sub of soonToExpire) {
    await db.from('subscriptions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', sub.id)

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
    const expected = Deno.env.get('CRON_SECRET')
    if (expected) {
      const got = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (got !== expected) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    try {
      const db = createAdminClient()
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
      const tg = token ? new TelegramClient(token) : null
      const result = await runSubscriptionCron(db, tg)
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
      console.error('subscription-cron error', err)
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
  })
}
