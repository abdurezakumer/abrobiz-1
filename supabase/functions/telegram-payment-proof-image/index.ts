import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
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
      const parsed = await readJsonBody(req, 4 * 1024)
      if (parsed.error || !isRecord(parsed.data)) return json({ error: parsed.error ?? 'Invalid request.' }, parsed.status ?? 400, req)
      const paymentId = parsed.data.paymentId
      if (!validUuid(paymentId)) return json({ error: 'Invalid payment.' }, 400, req)

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
      if (!url || !anonKey || !botToken) return json({ error: 'Payment proof service is temporarily unavailable.' }, 503, req)
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'telegram-proof-image-ip', limit: 60, windowSeconds: 3600 },
        { scope: 'telegram-proof-image-user', limit: 60, windowSeconds: 3600, identity: userData.user.id },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: payment } = await db.from('payments').select('business_id, telegram_proof_id').eq('id', paymentId).maybeSingle()
      if (!payment?.telegram_proof_id) return json({ error: 'Payment proof is not available.' }, 404, req)

      const { data: ownedBusiness } = await db.from('businesses').select('id').eq('id', payment.business_id).eq('owner_id', userData.user.id).maybeSingle()
      const { data: permitted, error: permissionError } = await caller.rpc('has_admin_permission', { p_permission: 'payments.read' })
      if (!ownedBusiness && (permissionError || permitted !== true)) return json({ error: 'Not found or not authorized.' }, 403, req)

      const { data: proof } = await db
        .from('telegram_payment_proofs')
        .select('telegram_file_id, content_type')
        .eq('id', payment.telegram_proof_id)
        .eq('business_id', payment.business_id)
        .maybeSingle()
      if (!proof?.telegram_file_id) return json({ error: 'Payment proof is not available.' }, 404, req)

      const tg = new TelegramClient(botToken)
      const file = await tg.getFile(proof.telegram_file_id)
      const bytes = await tg.downloadFile(file.file_path)
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders(req),
          // Supabase FunctionsClient treats octet-stream as a Blob. The
          // browser-side caller restores the validated image MIME type.
          'Content-Type': 'application/octet-stream',
          'X-Proof-Content-Type': proof.content_type,
          'Access-Control-Expose-Headers': 'X-Proof-Content-Type',
          'Cache-Control': 'private, no-store',
          'Content-Disposition': 'inline; filename="abrobiz-payment-proof"',
        },
      })
    } catch (error) {
      logFailure(req, { function_name: 'telegram-payment-proof-image', operation: 'retrieve_payment_proof', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', provider: 'telegram', status: 500 })
      return json({ error: 'Could not retrieve the payment proof.' }, 500, req)
    }
  })
}
