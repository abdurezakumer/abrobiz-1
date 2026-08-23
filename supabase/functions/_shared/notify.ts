import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { TelegramClient, buildInlineKeyboard } from './telegram.ts'

export async function notifyAdminsOfPayment(db: SupabaseClient, tg: TelegramClient, paymentId: string): Promise<void> {
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

  if (!admins || admins.length === 0) {
    console.log('No linked admin Telegram chats — payment', paymentId, 'still visible in the web admin panel')
    return
  }

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

  const keyboard = buildInlineKeyboard([
    [
      { text: '\u2705 Approve', callback_data: `approve:${payment.id}` },
      { text: '\u274C Reject', callback_data: `reject:${payment.id}` },
    ],
  ])

  for (const admin of admins) {
    const chatId = admin.telegram_chat_id as string | null
    if (!chatId) continue
    try {
      if (photoUrl) {
        await tg.sendPhoto(chatId, photoUrl, { caption, replyMarkup: keyboard })
      } else {
        await tg.sendMessage(chatId, caption, { replyMarkup: keyboard })
      }
    } catch (err) {
      console.error('Failed to notify admin chat', chatId, err)
    }
  }
}
