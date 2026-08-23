import { supabase } from '../supabaseClient'
import type { ContactMessage } from '../../types'

function mapMessage(row: any): ContactMessage {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}

/** Called from the public Contact page — works for anonymous visitors on a published business. */
export async function submitContactMessage(input: { businessId: string; name: string; email: string; phone: string; message: string }): Promise<void> {
  const { error } = await supabase.from('contact_messages').insert({
    business_id: input.businessId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
  })
  if (error) throw error
}

export async function listMessages(businessId: string): Promise<ContactMessage[]> {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapMessage)
}

export async function markMessageRead(id: string): Promise<void> {
  const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id)
  if (error) throw error
}
