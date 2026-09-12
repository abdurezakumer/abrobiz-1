import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { TelegramClient, buildInlineKeyboard } from './telegram.ts'
import { createSenderFromEnv, escapeHtml, sendEmail } from './mailer.ts'
import { logEvent } from './observability.ts'

export async function notifyAdminsOfPayment(db: SupabaseClient, tg: TelegramClient | null, paymentId: string): Promise<void> {
  const { data: payment } = await db
    .from('payments')
    .select('id, amount_etb, owner_note, proof_url, plans(name), businesses(name, slug)')
    .eq('id', paymentId)
    .single()

  if (!payment) return

  const { data: admins } = await db
    .from('admin_telegram_links')
    .select('telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  let photoUrl: string | undefined
  if (payment.proof_url) {
    const { data: signed } = await db.storage.from('payment-proofs').createSignedUrl(payment.proof_url, 600)
    photoUrl = signed?.signedUrl
  }

  const businessName = (payment as any).businesses?.name ?? 'A business'
  const planName = (payment as any).plans?.name ?? 'Plan'
  const lines = [
    '\uD83D\uDCB3 New payment awaiting review',
    '',
    businessName,
    `Plan: ${planName}`,
    `Amount: ${payment.amount_etb} ETB`,
  ]
  if (payment.owner_note) lines.push(`Note: ${payment.owner_note}`)
  const caption = lines.join('\n')

  const { data: adminProfiles } = await db.from('profiles').select('email').in('role', ['admin', 'super_admin']).not('email', 'is', null)
  if (adminProfiles && adminProfiles.length > 0) {
    try {
      const sender = createSenderFromEnv(Deno.env)
      const html = `<h2>New payment awaiting review</h2><p><strong>${escapeHtml(businessName)}</strong></p><p>Plan: ${escapeHtml(planName)}<br>Amount: ${escapeHtml(String(payment.amount_etb))} ETB</p><p>Open AbroBiz Admin &rarr; Payments to review the proof.</p>`
      for (const admin of adminProfiles) {
        if (!admin.email) continue
        await sendEmail(sender.sendMail, {
          from: sender.from,
          to: admin.email,
          content: {
            subject: `Payment awaiting review · ${businessName}`,
            html,
            text: `New payment awaiting review\n\n${businessName}\nPlan: ${planName}\nAmount: ${payment.amount_etb} ETB\n\nOpen AbroBiz Admin > Payments to review it.`,
          },
        })
      }
    } catch {
      logEvent('error', { service: 'abrobiz-edge', function_name: 'notify-payment-submitted', operation: 'email_notify', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'not_configured' })
    }
  }

  const keyboard = buildInlineKeyboard([
    [
      { text: '\u2705 Approve', callback_data: `approve:${payment.id}` },
      { text: '\u274C Reject', callback_data: `reject:${payment.id}` },
    ],
  ])

  for (const admin of admins ?? []) {
    const chatId = admin.telegram_chat_id as string | null
    if (!chatId) continue
    if (!tg) continue
    try {
      if (photoUrl) {
        await tg.sendPhoto(chatId, photoUrl, { caption, replyMarkup: keyboard })
      } else {
        await tg.sendMessage(chatId, caption, { replyMarkup: keyboard })
      }
    } catch (err) {
      logEvent('error', { service: 'abrobiz-edge', function_name: 'notify-payment-submitted', operation: 'telegram_notify', error_category: 'DEPENDENCY_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', outcome: 'failed' })
    }
  }

  if ((!admins || admins.length === 0) && (!adminProfiles || adminProfiles.length === 0)) {
    logEvent('info', { service: 'abrobiz-edge', function_name: 'notify-payment-submitted', operation: 'notify_admins', outcome: 'no_recipients' })
  }
}
