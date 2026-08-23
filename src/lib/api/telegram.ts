import { supabase } from '../supabaseClient'

export interface TelegramLinkStatus {
  linkToken: string
  telegramUsername: string | null
  linkedAt: string | null
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined

export function telegramDeepLink(linkToken: string): string | null {
  if (!BOT_USERNAME) return null
  return `https://t.me/${BOT_USERNAME}?start=${linkToken}`
}

export async function getOrCreateBusinessTelegramLink(businessId: string): Promise<TelegramLinkStatus> {
  const { data: existing } = await supabase
    .from('business_telegram_links')
    .select('link_token, telegram_username, linked_at')
    .eq('business_id', businessId)
    .maybeSingle()
  if (existing) return { linkToken: existing.link_token, telegramUsername: existing.telegram_username, linkedAt: existing.linked_at }

  const { data: created, error } = await supabase
    .from('business_telegram_links')
    .insert({ business_id: businessId })
    .select('link_token, telegram_username, linked_at')
    .single()
  if (error) throw error
  return { linkToken: created.link_token, telegramUsername: created.telegram_username, linkedAt: created.linked_at }
}

export async function getOrCreateAdminTelegramLink(adminId: string): Promise<TelegramLinkStatus> {
  const { data: existing } = await supabase
    .from('admin_telegram_links')
    .select('link_token, telegram_username, linked_at')
    .eq('admin_id', adminId)
    .maybeSingle()
  if (existing) return { linkToken: existing.link_token, telegramUsername: existing.telegram_username, linkedAt: existing.linked_at }

  const { data: created, error } = await supabase
    .from('admin_telegram_links')
    .insert({ admin_id: adminId })
    .select('link_token, telegram_username, linked_at')
    .single()
  if (error) throw error
  return { linkToken: created.link_token, telegramUsername: created.telegram_username, linkedAt: created.linked_at }
}

/** Fire-and-forget: pings linked admins on Telegram. The payment already exists either way. */
export async function notifyAdminsOfPayment(paymentId: string): Promise<void> {
  try {
    await supabase.functions.invoke('notify-payment-submitted', { body: { paymentId } })
  } catch (err) {
    console.warn('Telegram notification failed (payment still submitted normally):', err)
  }
}
