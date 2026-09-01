import { supabase } from '../supabaseClient'
import type { Review } from '../../types'

function mapReview(row: any): Review {
  return {
    id: row.id,
    businessId: row.business_id,
    customerName: row.customer_name,
    rating: row.rating,
    comment: row.comment ?? '',
    isApproved: row.is_approved,
    createdAt: row.created_at,
  }
}

/** Public. Always lands unapproved — the business owner moderates before it's visible to anyone else. */
export async function submitReview(input: { businessId: string; customerName: string; rating: number; comment: string; turnstileToken?: string | null }): Promise<void> {
  const { error } = await supabase.functions.invoke('submit-review', {
    body: input,
  })
  if (error) throw error
}

/** Public — RLS only returns approved rows to non-owners. */
export async function listApprovedReviews(businessId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, business_id, customer_name, rating, comment, is_approved, created_at')
    .eq('business_id', businessId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map(mapReview)
}

/** Owner/admin — sees pending + approved. */
export async function listAllReviewsForOwner(businessId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, business_id, customer_name, rating, comment, is_approved, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapReview)
}

export async function approveReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').update({ is_approved: true }).eq('id', id)
  if (error) throw error
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error
}
