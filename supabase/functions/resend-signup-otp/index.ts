import { createAdminClient } from '../_shared/db.ts'
import { sendAuthOtpEmail } from '../_shared/authOtpEmail.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

const GENERIC_RESPONSE = { ok: true, message: 'If that account needs verification, a new code is on its way.' }

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json(GENERIC_RESPONSE, 200, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json(GENERIC_RESPONSE, 200, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'resend-signup-otp-ip', limit: 10, windowSeconds: 900 },
        { scope: 'resend-signup-otp-account', limit: 3, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'otp-resend')
      if (turnstileFailure) return turnstileFailure

      const adminClient = createAdminClient()
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('name')
        .eq('email', email)
        .maybeSingle()
      if (profileError || !profile) return json(GENERIC_RESPONSE, 200, req)

      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${(Deno.env.get('SITE_URL') ?? 'https://abrobiz.com').replace(/\/$/, '')}/setup` },
      })
      const code = data?.properties?.email_otp
      if (error || !code || !/^\d{6}$/.test(code)) {
        logFailure(req, { function_name: 'resend-signup-otp', operation: 'generate_otp', error_category: 'AUTHENTICATION_ERROR', error_code: error?.name ?? 'unknown', status: 200 })
        return json(GENERIC_RESPONSE, 200, req)
      }
      const emailResult = await sendAuthOtpEmail({ email, code, name: profile.name ?? '', purpose: 'signup' })
      if (!emailResult.ok) logFailure(req, { function_name: 'resend-signup-otp', operation: 'send_otp', error_category: 'DEPENDENCY_ERROR', error_code: 'email_delivery_failed', provider: 'email', status: 503 })
      return json(GENERIC_RESPONSE, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'resend-signup-otp', operation: 'resend_otp', error_category: 'AUTHENTICATION_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 400 })
      return json(GENERIC_RESPONSE, 200, req)
    }
  })
}
