import { supabase } from '../supabaseClient'
import type { Booking } from '../../types'

function mapBooking(row: any): Booking {
  return {
    id: row.id,
    businessId: row.business_id,
    customerName: row.customer_name,
    phone: row.phone ?? '',
    partySize: row.party_size ?? null,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time ?? '',
    notes: row.notes ?? '',
    status: row.status,
    createdAt: row.created_at,
  }
}

/** Public — only succeeds if the business is published and its plan includes bookings (enforced by RLS, not just this check). */
export async function submitBooking(input: {
  businessId: string
  customerName: string
  phone: string
  partySize?: number
  requestedDate: string
  requestedTime: string
  notes?: string
}): Promise<void> {
  const { error } = await supabase.from('bookings').insert({
    business_id: input.businessId,
    customer_name: input.customerName,
    phone: input.phone,
    party_size: input.partySize ?? null,
    requested_date: input.requestedDate,
    requested_time: input.requestedTime,
    notes: input.notes ?? '',
  })
  if (error) throw error
}

export async function listBookings(businessId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('business_id', businessId)
    .order('requested_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapBooking)
}

export async function updateBookingStatus(id: string, status: 'confirmed' | 'declined' | 'cancelled'): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
  if (error) throw error
}
