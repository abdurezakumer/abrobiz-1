import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'
import type { Payment } from '../../types'
import { isPdfFile, prepareImageForUpload } from '../fileUpload'

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
  const uploadFile = isPdfFile(file)
    ? (file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf' }))
    : await prepareImageForUpload(file, 10 * 1024 * 1024)
  if (uploadFile.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(uploadFile.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or PDF file up to 10 MB.')
  }
  const uploadBytes = await uploadFile.arrayBuffer()
  const { data, error } = await supabase.functions.invoke('storage-upload', {
    body: uploadBytes,
    headers: { 'X-Upload-Bucket': 'payment-proofs', 'X-Business-Id': businessId, 'Content-Type': uploadFile.type },
  })
  if (error) throw await edgeFunctionError(error)
  if (!data?.path) throw new Error('Upload did not return a file path.')
  return data.path // private bucket: resolve signed URLs on read
}

export async function getPaymentProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('storage-signed-url', { body: { path } })
  if (error) throw await edgeFunctionError(error)
  if (!data?.signedUrl) throw new Error('Could not prepare the file.')
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
  idempotencyKey?: string
}): Promise<Payment> {
  const { data, error } = await supabase.functions.invoke('submit-payment', {
    headers: { 'Idempotency-Key': input.idempotencyKey ?? crypto.randomUUID() },
    body: input,
  })
  if (error) throw await edgeFunctionError(error)
  if (!data?.payment) throw new Error('Could not submit your payment.')
  return mapPayment(data.payment)
}

export async function listPaymentsForBusiness(businessId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

// ── Admin ────────────────────────────────────────────────────────────────

export async function adminListPendingPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminListAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
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
