import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'
import type { Payment } from '../../types'
import { createClientUuid, prepareImageForUpload, readFileAsArrayBuffer } from '../fileUpload'
import { uploadBinaryToFunction } from '../uploadClient'

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
            aiCopy: !!row.plans.feature_flags?.aiCopy,
          },
          isTrial: row.plans.is_trial,
          trialDays: row.plans.trial_days ?? undefined,
          isActive: row.plans.is_active,
          sortOrder: row.plans.sort_order,
          monthlyPriceEtb: row.plans.monthly_price_etb == null ? undefined : Number(row.plans.monthly_price_etb),
          annualPriceEtb: row.plans.annual_price_etb == null ? undefined : Number(row.plans.annual_price_etb),
          discountType: row.plans.discount_type ?? 'none',
          discountValue: Number(row.plans.discount_value ?? 0),
          discountLabel: row.plans.discount_label ?? '',
          discountStartsAt: row.plans.discount_starts_at ?? null,
          discountEndsAt: row.plans.discount_ends_at ?? null,
        }
      : undefined,
    billingCycle: row.billing_cycle,
    amountEtb: Number(row.amount_etb),
    paymentMethodId: row.payment_method_id,
    proofUrl: row.proof_url ?? undefined,
    telegramProofId: row.telegram_proof_id ?? undefined,
    ownerNote: row.owner_note ?? '',
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    business: row.businesses ? { name: row.businesses.name, slug: row.businesses.slug } : undefined,
  }
}

async function uploadPaymentBytes(
  businessId: string,
  bytes: ArrayBuffer,
  contentType: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
  uploadId?: string,
): Promise<string> {
  const clientUploadId = uploadId ?? createClientUuid()
  // A mobile connection can drop after Telegram archives the bytes. The same
  // uploadId lets the Edge Function return the original proof record without
  // posting a second receipt to the archive channel.
  const data = await uploadBinaryToFunction({
    functionName: 'telegram-payment-proof',
    bytes,
    contentType,
    headers: { 'X-Business-Id': businessId, 'X-Upload-Id': clientUploadId },
    onProgress,
    signal,
  })
  const proofId = typeof data.proofId === 'string' ? data.proofId : ''
  if (!proofId) throw new Error('Upload did not return a proof reference.')
  return proofId
}

export async function uploadPaymentProof(businessId: string, file: File, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  // Payment receipts are photos archived by Telegram, not Supabase Storage.
  // Large camera images are resized before the request for reliable phones.
  // Telegram's sendPhoto endpoint is most reliable with JPEG. Phone camera
  // images are often HEIC or oversized JPEGs, so normalize the proof to a
  // bounded JPEG before sending it to the archive channel.
  const uploadFile = await prepareImageForUpload(file, 5 * 1024 * 1024, 'image/jpeg')
  if (uploadFile.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(uploadFile.type)) {
    throw new Error('Use a JPEG, PNG, or WebP photo up to 5 MB.')
  }
  const uploadBytes = await readFileAsArrayBuffer(uploadFile)
  return uploadPaymentBytes(businessId, uploadBytes, uploadFile.type, onProgress, signal) // returns an opaque Telegram proof record ID
}

export async function getPaymentProofUrl(path?: string, paymentId?: string): Promise<string> {
  if (paymentId && !path) {
    const { data, error, response } = await supabase.functions.invoke('telegram-payment-proof-image', { body: { paymentId } })
    if (error) throw await edgeFunctionError(error)
    if (!(data instanceof Blob)) throw new Error('Could not prepare the file.')
    const contentType = response?.headers.get('X-Proof-Content-Type') ?? 'image/jpeg'
    return URL.createObjectURL(new Blob([data], { type: contentType }))
  }
  if (!path) throw new Error('Could not prepare the file.')
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
  const { proofPath, ...paymentInput } = input
  const { data, error } = await supabase.functions.invoke('submit-payment', {
    headers: { 'Idempotency-Key': input.idempotencyKey ?? crypto.randomUUID() },
    body: { ...paymentInput, proofId: proofPath },
  })
  if (error) throw await edgeFunctionError(error)
  if (!data?.payment) throw new Error('Could not submit your payment.')
  return mapPayment(data.payment)
}

export async function listPaymentsForBusiness(businessId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, monthly_price_etb, annual_price_etb, discount_type, discount_value, discount_label, discount_starts_at, discount_ends_at, features, feature_flags, is_trial, trial_days, is_active, sort_order)')
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
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, monthly_price_etb, annual_price_etb, discount_type, discount_value, discount_label, discount_starts_at, discount_ends_at, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminListAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, monthly_price_etb, annual_price_etb, discount_type, discount_value, discount_label, discount_starts_at, discount_ends_at, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminApprovePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_payment', { p_payment_id: paymentId })
  if (error) throw error
  await supabase.functions.invoke('notify-payment-reviewed', { body: { paymentId, action: 'approved' } }).catch(() => {})
}

export async function adminRejectPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reject_payment', { p_payment_id: paymentId, p_reason: reason })
  if (error) throw error
  await supabase.functions.invoke('notify-payment-reviewed', { body: { paymentId, action: 'rejected' } }).catch(() => {})
}
