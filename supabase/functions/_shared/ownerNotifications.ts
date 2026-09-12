import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createSenderFromEnv, escapeHtml, sendEmail } from './mailer.ts'
import { TelegramClient } from './telegram.ts'
import { logEvent } from './observability.ts'

export interface OwnerNotification {
  title: string
  body: string
  link?: string
  telegramText?: string
}

interface OwnerContext {
  ownerId?: string
  businessName?: string
}

/**
 * Delivers an owner notification through every channel the owner has
 * configured. Delivery is deliberately best-effort: the database notification
 * is already committed, so an unavailable email or Telegram provider must not
 * turn a successful customer action into a failed request.
 */
export async function notifyBusinessOwner(
  db: SupabaseClient,
  tg: TelegramClient | null,
  businessId: string,
  notification: OwnerNotification,
  context: OwnerContext = {},
): Promise<{ emailSent: boolean; telegramSent: boolean }> {
  let ownerId = context.ownerId
  let businessName = context.businessName ?? 'Your business'

  if (!ownerId) {
    const { data: business } = await db
      .from('businesses')
      .select('owner_id, name')
      .eq('id', businessId)
      .maybeSingle()
    ownerId = business?.owner_id
    businessName = business?.name ?? businessName
  }
  if (!ownerId) return { emailSent: false, telegramSent: false }

  const [{ data: profile }, { data: link }] = await Promise.all([
    db.from('profiles').select('email').eq('id', ownerId).maybeSingle(),
    db.from('business_telegram_links').select('telegram_chat_id').eq('business_id', businessId).not('telegram_chat_id', 'is', null).maybeSingle(),
  ])

  let emailSent = false
  if (profile?.email) {
    try {
      const sender = createSenderFromEnv(Deno.env)
      const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://abrobiz.com').replace(/\/+$/, '')
      const href = notification.link?.startsWith('/') ? `${siteUrl}${notification.link}` : siteUrl
      const safeTitle = escapeHtml(notification.title)
      const safeBody = escapeHtml(notification.body).replace(/\n/g, '<br>')
      const result = await sendEmail(sender.sendMail, {
        from: sender.from,
        to: profile.email,
        content: {
          subject: `${notification.title} · AbroBiz`,
          html: `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,sans-serif;color:#0a0c10"><div style="max-width:620px;margin:32px auto;padding:32px;background:#fff;border-radius:18px;border:1px solid #ebe5da"><div style="font-size:20px;font-weight:700;margin-bottom:24px">AbroBiz</div><h1 style="font-size:24px;margin:0 0 12px">${safeTitle}</h1><p style="font-size:15px;line-height:1.7;color:#4b5563">${safeBody}</p><p style="font-size:13px;color:#6b7280">Business: ${escapeHtml(businessName)}</p><a href="${escapeHtml(href)}" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:10px;background:#d4a853;color:#0a0c10;text-decoration:none;font-weight:700">Open AbroBiz</a><p style="font-size:12px;color:#9ca3af;margin-top:28px">You received this message because you have an AbroBiz business account.</p></div></body></html>`,
          text: `AbroBiz\n\n${notification.title}\n\n${notification.body}\n\nBusiness: ${businessName}\nOpen: ${href}`,
        },
      })
      emailSent = result.ok
      if (!result.ok) {
        logEvent('error', { service: 'abrobiz-edge', operation: 'owner_notification_email', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'failed' })
      }
    } catch {
      logEvent('error', { service: 'abrobiz-edge', operation: 'owner_notification_email', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'not_configured' })
    }
  }

  let telegramSent = false
  if (tg && link?.telegram_chat_id) {
    const text = notification.telegramText ?? `${notification.title}\n\n${notification.body}`
    try {
      await tg.sendMessage(link.telegram_chat_id, text)
      telegramSent = true
    } catch {
      logEvent('error', { service: 'abrobiz-edge', operation: 'owner_notification_telegram', error_category: 'DEPENDENCY_ERROR', provider: 'telegram', outcome: 'failed' })
    }
  }

  return { emailSent, telegramSent }
}
