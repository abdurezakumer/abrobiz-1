import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { notifyBusinessOwner } from '../_shared/ownerNotifications.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)
    try {
      const parsed = await readJsonBody(req, 8 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const businessId = body.businessId
      const name = typeof body.customerName === 'string' ? body.customerName.trim() : ''
      const rating = body.rating
      const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
      if (!validUuid(businessId) || name.length < 1 || name.length > 120 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) {
        return json({ error: 'Please check the review details.' }, 400, req)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'review-ip', limit: 10, windowSeconds: 900 },
        { scope: 'review-business', limit: 5, windowSeconds: 900, identity: businessId },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'review')
      if (turnstileFailure) return turnstileFailure

      const db = createAdminClient()
      const { data: business } = await db.from('businesses').select('id').eq('id', businessId).eq('is_published', true).eq('is_blocked', false).maybeSingle()
      if (!business) return json({ error: 'Business is not available.' }, 404, req)
      const { data: entitlement } = await db.rpc('get_business_entitlements', { p_business_id: businessId })
      if (!entitlement?.reviews) return json({ error: 'Reviews are not available for this business.' }, 403, req)
      const { error } = await db.from('reviews').insert({ business_id: businessId, customer_name: name, rating, comment, is_approved: false })
      if (error) {
        logFailure(req, { function_name: 'submit-review', operation: 'create_review', error_category: error.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', error_code: error.code ?? 'unknown', status: error.code === '23505' ? 409 : 400 })
        return json({ error: 'Could not submit your review.' }, 500, req)
      }
      const tg = Deno.env.get('TELEGRAM_BOT_TOKEN') ? new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!) : null
      await notifyBusinessOwner(db, tg, businessId, {
        title: `${name} left a ${rating}-star review`,
        body: comment.slice(0, 140),
        link: '/dashboard/reviews',
        telegramText: `New ${rating}-star review from ${name}\n\n${comment.slice(0, 500)}`,
      }).catch(() => {})
      return json({ ok: true }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'submit-review', operation: 'create_review', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not submit your review.' }, 500, req)
    }
  })
}
