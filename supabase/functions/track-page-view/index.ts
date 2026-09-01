import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 4 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const businessId = typeof body.businessId === 'string' ? body.businessId.trim() : ''
      const path = typeof body.path === 'string' ? body.path.trim() : ''
      const referrer = typeof body.referrer === 'string' ? body.referrer.trim() : ''
      if (!validUuid(businessId)) return json({ error: 'Invalid business.' }, 400, req)
      if (!path || path.length > 200 || referrer.length > 1000) return json({ error: 'Page-view data is too long.' }, 400, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'page-view-ip', limit: 120, windowSeconds: 60 },
        { scope: 'page-view-business', limit: 60, windowSeconds: 60, identity: businessId },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: business } = await db.from('businesses').select('id').eq('id', businessId).eq('is_published', true).eq('is_blocked', false).maybeSingle()
      if (!business) return json({ ok: true }, 200, req)
      const { error } = await db.rpc('track_page_view', { p_business_id: businessId, p_path: path, p_referrer: referrer })
      if (error) {
        logFailure(req, { function_name: 'track-page-view', operation: 'insert_page_view', error_category: 'DATABASE_ERROR', error_code: error.code ?? 'unknown', status: 503 })
        return json({ error: 'Could not record the page view.' }, 500, req)
      }
      return json({ ok: true }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'track-page-view', operation: 'insert_page_view', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 503 })
      return json({ error: 'Could not record the page view.' }, 500, req)
    }
  })
}
