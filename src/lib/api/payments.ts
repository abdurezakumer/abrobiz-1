import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'
import type { Payment } from '../../types'
import { prepareImageForUpload } from '../fileUpload'

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
  uploadId = crypto.randomUUID(),
): Promise<string> {
  const projectUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Not authenticated.')

  let accessToken = sessionData.session.access_token
  let lastError: unknown

  // A mobile connection can drop after Telegram archives the bytes. The same
  // uploadId lets the Edge Function return the original proof record without
  // posting a second receipt to the archive channel.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (signal?.aborted) throw new Error('Upload canceled.')
      // functions.invoke uses fetch, which cannot expose upload progress. XHR
      // keeps the same authenticated Edge Function contract while reporting
      // the real phone-to-Telegram transfer percentage.
      if (typeof XMLHttpRequest === 'undefined' || !projectUrl || !anonKey) {
        const { data, error } = await supabase.functions.invoke('telegram-payment-proof', {
          body: bytes,
          headers: { 'X-Business-Id': businessId, 'X-Upload-Id': uploadId, 'Content-Type': contentType },
          signal,
        })
        if (error) throw await edgeFunctionError(error)
        onProgress?.(100)
        if (!data?.proofId) throw new Error('Upload did not return a proof reference.')
        return data.proofId
      }

      return await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('POST', `${projectUrl}/functions/v1/telegram-payment-proof`)
        request.responseType = 'json'
        request.timeout = 120000
        request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        request.setRequestHeader('apikey', anonKey)
        request.setRequestHeader('X-Business-Id', businessId)
        request.setRequestHeader('X-Upload-Id', uploadId)
        request.setRequestHeader('Content-Type', contentType)
        const abortRequest = () => request.abort()
        const cleanupAbort = () => signal?.removeEventListener('abort', abortRequest)
        if (signal?.aborted) {
          reject(new Error('Upload canceled.'))
          return
        }
        signal?.addEventListener('abort', abortRequest, { once: true })
        request.upload.onprogress = event => {
          if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
        request.onload = () => {
          cleanupAbort()
          const body = request.response ?? (() => {
            try { return JSON.parse(request.responseText || '{}') } catch { return {} }
          })()
          if (request.status < 200 || request.status >= 300) {
            const error = new Error(body?.error || `Upload failed with status ${request.status}.`)
            ;(error as Error & { status?: number }).status = request.status
            reject(error)
            return
          }
          if (!body?.proofId) {
            reject(new Error('Upload did not return a proof reference.'))
            return
          }
          onProgress?.(100)
          resolve(body.proofId)
        }
        request.onerror = () => { cleanupAbort(); reject(new Error('Upload network connection was interrupted.')) }
        request.ontimeout = () => { cleanupAbort(); reject(new Error('Upload timed out while waiting for the server.')) }
        request.onabort = () => { cleanupAbort(); reject(new Error(signal?.aborted ? 'Upload canceled.' : 'Upload was interrupted before it finished.')) }
        request.send(bytes)
      })
    } catch (error) {
      lastError = error
      const status = (error as { status?: number } | null)?.status
      const message = error instanceof Error ? error.message : ''
      if (signal?.aborted || /upload canceled/i.test(message)) throw error
      const retryable = !status || status === 401 || status === 408 || status === 429 || status >= 500 || /network|timed out|temporarily unavailable|could not save|failed to fetch|gateway/i.test(message)
      if (!retryable || attempt === 2) throw error
      const refreshed = await supabase.auth.refreshSession()
      if (!refreshed.error && refreshed.data.session) accessToken = refreshed.data.session.access_token
      onProgress?.(0)
      await new Promise(resolve => window.setTimeout(resolve, 700 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The receipt upload could not be completed.')
}

export async function uploadPaymentProof(businessId: string, file: File, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  // Payment receipts are photos archived by Telegram, not Supabase Storage.
  // Large camera images are resized before the request for reliable phones.
  const uploadFile = await prepareImageForUpload(file, 5 * 1024 * 1024)
  if (uploadFile.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(uploadFile.type)) {
    throw new Error('Use a JPEG, PNG, or WebP photo up to 5 MB.')
  }
  const uploadBytes = await uploadFile.arrayBuffer()
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
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order)')
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
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

export async function adminListAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status, reviewed_by, reviewed_at, rejection_reason, created_at, plans(id, slug, name, price_etb, billing_interval, features, feature_flags, is_trial, trial_days, is_active, sort_order), businesses(name, slug)')
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
