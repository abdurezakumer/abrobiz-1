import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isBearerAuthorization, isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

function safeDatabaseError(error: { code?: string; message?: string } | null): { message: string; status: number } {
  const message = error?.message ?? ''
  if (/already awaiting review/i.test(message)) {
    return { message: 'A payment is already awaiting admin review. Please wait for confirmation before submitting another.', status: 409 }
  }
  if (/payment proof path is invalid/i.test(message)) {
    return { message: 'Payment proof is no longer available. Please upload the receipt again.', status: 400 }
  }
  if (/payment plan details are invalid/i.test(message)) {
    return { message: 'The selected payment plan is no longer available at that price. Please choose the plan again.', status: 400 }
  }
  if (/payment method is unavailable/i.test(message)) {
    return { message: 'The selected payment method is no longer available. Please choose another method.', status: 400 }
  }
  if (/request is already being processed/i.test(message)) {
    return { message: 'This payment is already being processed. Please wait a moment and check your payment history.', status: 409 }
  }
  return { message: 'Could not submit your payment.', status: error?.code === '23505' ? 409 : 400 }
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)
    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated.' }, 401, req)
      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'Payment submission is temporarily unavailable.' }, 503, req)
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)

      const idempotencyKey = req.headers.get('Idempotency-Key') ?? ''
      const parsed = await readJsonBody(req, 16 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const businessId = body.businessId
      const planId = body.planId
      const paymentMethodId = body.paymentMethodId
      const billingCycle = body.billingCycle
      const amountEtb = body.amountEtb
      const proofPath = typeof body.proofPath === 'string' ? body.proofPath : ''
      const ownerNote = typeof body.ownerNote === 'string' ? body.ownerNote.trim() : ''
      const proofMatch = typeof proofPath === 'string' && proofPath.match(/^([0-9a-f-]{36})\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/i)
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey) || !validUuid(businessId) || !validUuid(planId) || !validUuid(paymentMethodId) ||
          (billingCycle !== 'month' && billingCycle !== 'year') || typeof amountEtb !== 'number' || !Number.isFinite(amountEtb) || amountEtb < 0 ||
          proofPath.length < 3 || proofPath.length > 500 || !proofMatch || proofMatch[1].toLowerCase() !== businessId.toLowerCase() ||
          !/\.(jpg|png|webp|pdf)$/i.test(proofMatch[2]) || ownerNote.length > 2000) {
        return json({ error: 'Please check the payment details.' }, 400, req)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'payment-user', limit: 5, windowSeconds: 3600, identity: userData.user.id },
        { scope: 'payment-business', limit: 5, windowSeconds: 3600, identity: businessId },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: business } = await db.from('businesses').select('id').eq('id', businessId).eq('owner_id', userData.user.id).maybeSingle()
      if (!business) return json({ error: 'Not found or not authorized.' }, 403, req)
      // The selected plan is the financial source of truth. Never trust a
      // client-supplied deposit or partial amount; every submission must
      // cover the complete active plan price for the selected interval.
      const { data: selectedPlan } = await db
        .from('plans')
        .select('id, price_etb, billing_interval, is_active, is_trial')
        .eq('id', planId)
        .maybeSingle()
      const fullPlanAmount = Number(selectedPlan?.price_etb)
      if (!selectedPlan?.is_active || selectedPlan.is_trial || selectedPlan.billing_interval !== billingCycle || !Number.isFinite(fullPlanAmount)) {
        return json({ error: 'The selected payment plan is no longer available at that price. Please choose the plan again.' }, 400, req)
      }
      const proofName = proofMatch?.[2] ?? ''
      const { data: proofObjects, error: proofLookupError } = await db.storage
        .from('payment-proofs')
        // List the tenant folder and compare the exact object name locally.
        // Storage search behaves differently across hosted Storage versions;
        // relying on it can make a freshly uploaded proof appear missing.
        .list(businessId, { limit: 1000 })
      const proofExists = !proofLookupError && proofObjects?.some(object => object.name === proofName)
      if (!proofExists) return json({ error: 'Payment proof was not found.' }, 400, req)
      const { data, error } = await db.rpc('submit_payment_idempotent', {
        p_idempotency_key: idempotencyKey,
        p_business_id: businessId,
        p_plan_id: planId,
        p_billing_cycle: selectedPlan.billing_interval,
        p_amount_etb: fullPlanAmount,
        p_payment_method_id: paymentMethodId,
        p_proof_url: proofPath,
        p_owner_note: ownerNote,
      })
      if (error || !data) {
        logFailure(req, { function_name: 'submit-payment', operation: 'create_payment', error_category: error?.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', error_code: error?.code ?? 'unknown', status: error?.code === '23505' ? 409 : 400 })
        const safeError = safeDatabaseError(error)
        return json({ error: safeError.message }, safeError.status, req)
      }
      return json({ payment: data }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'submit-payment', operation: 'create_payment', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not submit your payment.' }, 500, req)
    }
  })
}
