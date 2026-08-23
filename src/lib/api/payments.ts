import { supabase } from '../supabaseClient'
import type { Payment } from '../../types'

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    businessId: row.business_id,
    planId: row.plan_id,
    plan: row.plans
      ? {
          id: row.plans.id,
          slug: row.plans.slug,
          name: row.plans.name,
          priceEtb: Number(row.plans.price_etb),
          billingInterval: row.plans.billing_interval,
          features: row.plans.features ?? [],
          featureFlags: {
            bookings: !!row.plans.feature_flags?.bookings,
            ordering: !!row.plans.feature_flags?.ordering,
            reviews: !!row.plans.feature_flags?.reviews,
          },
          isTrial: row.plans.is_trial,
          trialDays: row.plans.trial_days ?? undefined,
          isActive: row.plans.is_active,
          sortOrder: row.plans.sort_order,
        }
      : undefined,
    billingCycle: row.billing_cycle,
    amountEtb: Number(row.amount_etb),
    paymentMethodId: row.payment_method_id,
    proofUrl: row.proof_url ?? undefined,
    ownerNote: row.owner_note ?? '',
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    business: row.businesses ? { name: row.businesses.name, slug: row.businesses.slug } : undefined,
  }
}

export async function uploadPaymentProof(businessId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${businessId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file)
  if (error) throw error
  return path // private bucket: store the path, resolve signed URLs on read
}

export async function getPaymentProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function submitPayment(input: {
  businessId: string
  planId: string
  billingCycle: 'month' | 'year'
  amountEtb: number
  paymentMethodId: string
  proofPath: string
  ownerNote?: string
}): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      business_id: input.businessId,
      plan_id: input.planId,
      billing_cycle: input.billingCycle,
      amount_etb: input.amountEtb,
      payment_method_id: input.paymentMethodId,
      proof_url: input.proofPath,
      owner_note: input.ownerNote ?? '',
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return mapPayment(data)
}

export async function listPaymentsForBusiness(businessId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, plans(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

// ── Admin ────────────────────────────────────────────────────────────────

export async function adminListPendingPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, plans(*), businesses(name, slug)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminListAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, plans(*), businesses(name, slug)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminApprovePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_payment', { p_payment_id: paymentId })
  if (error) throw error
}

export async function adminRejectPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reject_payment', { p_payment_id: paymentId, p_reason: reason })
  if (error) throw error
}
