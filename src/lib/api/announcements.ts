import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'

export interface Announcement {
  id: string
  subject: string
  body: string
  recipientCount: number
  createdAt: string
}

function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    recipientCount: row.recipient_count,
    createdAt: row.created_at,
  }
}

export async function sendAnnouncement(subject: string, body: string): Promise<{ sent: number; failed: number; total: number }> {
  const { data, error } = await supabase.functions.invoke('send-announcement', { body: { subject, body } })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return { sent: data.sent, failed: data.failed, total: data.total }
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAnnouncement)
}
