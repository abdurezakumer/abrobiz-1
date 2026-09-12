import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validEmail, validUuid } from '../_shared/requestSecurity.ts'
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
      const parsed = await readJsonBody(req, 12 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const businessId = body.businessId
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!validUuid(businessId) || name.length < 1 || name.length > 120 || (email && !validEmail(email)) || phone.length > 40 || message.length < 1 || message.length > 5000) {
        return json({ error: 'Please check the message details.' }, 400, req)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'contact-ip', limit: 20, windowSeconds: 900 },
        { scope: 'contact-business', limit: 10, windowSeconds: 900, identity: businessId },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'contact')
      if (turnstileFailure) return turnstileFailure

      const db = createAdminClient()
      const { data: business } = await db.from('businesses').select('id').eq('id', businessId).eq('is_published', true).eq('is_blocked', false).maybeSingle()
      if (!business) return json({ error: 'Business is not available.' }, 404, req)
      const { data: entitlement } = await db.rpc('get_business_entitlements', { p_business_id: businessId })
      if (!entitlement?.siteActive) return json({ error: 'This website is temporarily unavailable.' }, 403, req)
      const { error } = await db.from('contact_messages').insert({ business_id: businessId, name, email, phone, message })
      if (error) {
        logFailure(req, { function_name: 'submit-contact', operation: 'create_contact_message', error_category: 'DATABASE_ERROR', error_code: error.code ?? 'unknown', status: 400 })
        return json({ error: 'Could not send your message.' }, 500, req)
      }
      const tg = Deno.env.get('TELEGRAM_BOT_TOKEN') ? new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!) : null
      await notifyBusinessOwner(db, tg, businessId, {
        title: `New message from ${name}`,
        body: message.slice(0, 140),
        link: '/dashboard/messages',
        telegramText: `New message from ${name}${email ? ` (${email})` : ''}\n\n${message.slice(0, 700)}`,
      }).catch(() => {})
      return json({ ok: true }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'submit-contact', operation: 'create_contact_message', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not send your message.' }, 500, req)
    }
  })
}
