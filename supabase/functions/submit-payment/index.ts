import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isBearerAuthorization, isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
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
      const proofName = proofMatch?.[2] ?? ''
      const { data: proofObjects, error: proofLookupError } = await db.storage
        .from('payment-proofs')
        .list(businessId, { limit: 100, search: proofName })
      const proofExists = !proofLookupError && proofObjects?.some(object => object.name === proofName)
      if (!proofExists) return json({ error: 'Payment proof was not found.' }, 400, req)
      const { data, error } = await db.rpc('submit_payment_idempotent', {
        p_idempotency_key: idempotencyKey,
        p_business_id: businessId,
        p_plan_id: planId,
        p_billing_cycle: billingCycle,
        p_amount_etb: amountEtb,
        p_payment_method_id: paymentMethodId,
        p_proof_url: proofPath,
        p_owner_note: ownerNote,
      })
      if (error || !data) {
        logFailure(req, { function_name: 'submit-payment', operation: 'create_payment', error_category: error?.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', error_code: error?.code ?? 'unknown', status: error?.code === '23505' ? 409 : 400 })
        return json({ error: 'Could not submit your payment.' }, 400, req)
      }
      return json({ payment: data }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'submit-payment', operation: 'create_payment', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not submit your payment.' }, 500, req)
    }
  })
}
