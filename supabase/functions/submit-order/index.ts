import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)
    try {
      const idempotencyKey = req.headers.get('Idempotency-Key') ?? ''
      const parsed = await readJsonBody(req, 32 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const businessId = body.businessId
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
      const fulfillmentType = body.fulfillmentType
      const address = typeof body.address === 'string' ? body.address.trim() : ''
      const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
      const items = body.items
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey) || !validUuid(businessId) || customerName.length < 1 || customerName.length > 120 || phone.length > 40 ||
          (fulfillmentType !== 'pickup' && fulfillmentType !== 'delivery') || address.length > 500 || notes.length > 2000 || !Array.isArray(items) || items.length < 1 || items.length > 50) {
        return json({ error: 'Please check the order details.' }, 400, req)
      }

      const seen = new Set<string>()
      for (const item of items) {
        if (!isRecord(item) || !validUuid(item.itemId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || seen.has(item.itemId)) {
          return json({ error: 'One or more order items are invalid.' }, 400, req)
        }
        seen.add(item.itemId)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'order-ip', limit: 20, windowSeconds: 900 },
        { scope: 'order-business', limit: 10, windowSeconds: 900, identity: businessId },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'order')
      if (turnstileFailure) return turnstileFailure

      const db = createAdminClient()
      const { data, error } = await db.rpc('submit_order_idempotent', {
        p_idempotency_key: idempotencyKey,
        p_business_id: businessId,
        p_customer_name: customerName,
        p_phone: phone,
        p_fulfillment_type: fulfillmentType,
        p_address: address,
        p_notes: notes,
        p_items: items.map(item => ({ item_id: item.itemId, quantity: item.quantity })),
      })
      if (error || !data) {
        logFailure(req, { function_name: 'submit-order', operation: 'create_order', error_category: error?.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', error_code: error?.code ?? 'unknown', status: error?.code === '23505' ? 409 : 400 })
        return json({ error: 'Could not submit your order.' }, error?.code === '23505' ? 409 : 400, req)
      }
      return json({ id: data.id, total_etb: data.total_etb }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'submit-order', operation: 'create_order', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not submit your order.' }, 500, req)
    }
  })
}
