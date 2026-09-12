import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { isBearerAuthorization, isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { notifyBusinessOwner } from '../_shared/ownerNotifications.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    const authorization = req.headers.get('Authorization') ?? ''
    if (!isBearerAuthorization(authorization)) return json({ error: 'Not authenticated.' }, 401, req)

    try {
      const sessionClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
      const { data: userData, error: userError } = await sessionClient.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)
      const { data: permitted } = await sessionClient.rpc('has_admin_permission', { p_permission: 'payments.review' })
      if (!permitted) return json({ error: 'Payment reviewers only.' }, 403, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'payment-reviewed-ip', limit: 60, windowSeconds: 3600 },
        { scope: 'payment-reviewed-admin', limit: 30, windowSeconds: 3600, identity: userData.user.id },
      ])
      if (limited) return limited

      const parsed = await readJsonBody(req, 8 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const data = isRecord(parsed.data) ? parsed.data : {}
      const paymentId = typeof data.paymentId === 'string' ? data.paymentId : ''
      const action = data.action
      if (!validUuid(paymentId) || (action !== 'approved' && action !== 'rejected')) return json({ error: 'Invalid payment review.' }, 400, req)

      const db = createAdminClient()
      const { data: payment } = await db.from('payments').select('business_id').eq('id', paymentId).maybeSingle()
      if (!payment?.business_id) return json({ error: 'Payment not found.' }, 404, req)

      const tg = Deno.env.get('TELEGRAM_BOT_TOKEN') ? new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!) : null
      const approved = action === 'approved'
      await notifyBusinessOwner(db, tg, payment.business_id, {
        title: approved ? 'Payment approved' : 'Payment rejected',
        body: approved
          ? 'Your payment has been approved and your AbroBiz subscription is now active.'
          : 'Your payment proof was rejected. Open Billing to review the reason and submit a new proof if needed.',
        link: '/dashboard/billing',
        telegramText: approved
          ? '🎉 Your AbroBiz payment was approved. Your subscription is now active.'
          : 'Your AbroBiz payment was rejected. Check Billing for details and resubmit if needed.',
      })
      return json({ ok: true }, 200, req)
    } catch {
      return json({ error: 'Could not deliver the payment update.' }, 500, req)
    }
  })
}
