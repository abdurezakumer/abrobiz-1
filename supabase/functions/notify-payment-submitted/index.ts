import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { notifyAdminsOfPayment } from '../_shared/notify.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

    try {
      const { paymentId } = await req.json()
      if (!paymentId || typeof paymentId !== 'string') {
        return json({ error: 'paymentId is required' }, 400, req)
      }

      // Verify the caller actually owns this payment by querying it with
      // THEIR OWN JWT (not the service role) — RLS naturally restricts this
      // to the payment's own business owner or an admin, reusing the exact
      // same authorization rules as everywhere else in the app.
      const authHeader = req.headers.get('Authorization') ?? ''
      const limited = await enforceRateLimit(req, 'payment-notification', 10, 900)
      if (limited) return limited
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: owned } = await anonClient.from('payments').select('id').eq('id', paymentId).maybeSingle()
      if (!owned) {
        return json({ error: 'Not found or not authorized' }, 403, req)
      }

      const db = createAdminClient()
      const tg = new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '')
      await notifyAdminsOfPayment(db, tg, paymentId)

      return json({ ok: true }, 200, req)
    } catch (err) {
      console.error('notify-payment-submitted error', err)
      return json({ error: String(err) }, 500, req)
    }
  })
}
