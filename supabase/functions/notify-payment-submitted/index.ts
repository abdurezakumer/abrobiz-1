import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { notifyAdminsOfPayment } from '../_shared/notify.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
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
      const parsedBody = await readJsonBody(req, 4 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const paymentId = body.paymentId
      if (!validUuid(paymentId)) {
        return json({ error: 'paymentId is required' }, 400, req)
      }

      // Verify the caller actually owns this payment by querying it with
      // THEIR OWN JWT (not the service role) — RLS naturally restricts this
      // to the payment's own business owner or an admin, reusing the exact
      // same authorization rules as everywhere else in the app.
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated' }, 401, req)
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await anonClient.auth.getUser()
      if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'payment-notification-ip', limit: 20, windowSeconds: 900 },
        { scope: 'payment-notification-user', limit: 10, windowSeconds: 900, identity: userData.user.id },
      ])
      if (limited) return limited
      const { data: owned } = await anonClient.from('payments').select('id').eq('id', paymentId).maybeSingle()
      if (!owned) {
        return json({ error: 'Not found or not authorized' }, 403, req)
      }

      const db = createAdminClient()
      const tg = Deno.env.get('TELEGRAM_BOT_TOKEN') ? new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!) : null
      await notifyAdminsOfPayment(db, tg, paymentId)

      return json({ ok: true }, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'notify-payment-submitted', operation: 'notify_payment', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'telegram', status: 500 })
      return json({ error: 'Could not send the payment notification.' }, 500, req)
    }
  })
}
