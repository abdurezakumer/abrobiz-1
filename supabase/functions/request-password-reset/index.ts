import { createAdminClient } from '../_shared/db.ts'
import { buildPasswordResetEmail } from './email.ts'
import { createSenderFromEnv, sendEmail } from '../_shared/mailer.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

// Always the same response, whether or not the email matched an account —
// deliberate, so this endpoint can't be used to discover who has an account.
const GENERIC_RESPONSE = { ok: true, message: 'If that email has an account, a reset link is on its way.' }

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json(GENERIC_RESPONSE, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json(GENERIC_RESPONSE, 200, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!email) {
        return json({ error: 'email is required' }, 400, req)
      }
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return json(GENERIC_RESPONSE, 200, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'password-reset-ip', limit: 10, windowSeconds: 900 },
        { scope: 'password-reset-account', limit: 5, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'password-reset')
      if (turnstileFailure) return turnstileFailure

      const adminClient = createAdminClient()
      const { data, error } = await adminClient.rpc('request_password_reset', { p_email: email })

      if (error) {
        logFailure(req, { function_name: 'request-password-reset', operation: 'create_reset_token', error_category: 'DATABASE_ERROR', error_code: error.code ?? 'unknown', status: 500 })
        // Still return the generic response — don't let an internal error leak whether the email matched.
        return json(GENERIC_RESPONSE, 200, req)
      }

      if (data?.token) {
        const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
        const resetUrl = `${siteUrl.replace(/\/$/, '')}/reset-password?token=${data.token}`
        const appName = Deno.env.get('APP_NAME') ?? 'AbroBiz'
        const content = buildPasswordResetEmail(data.name ?? '', resetUrl, appName)

        try {
          const sender = createSenderFromEnv(Deno.env)
          const result = await sendEmail(sender.sendMail, { from: sender.from, to: email, content })
          if (!result.ok) logFailure(req, { function_name: 'request-password-reset', operation: 'send_reset_email', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'provider_rejected', status: 502 })
        } catch (err) {
          logFailure(req, { function_name: 'request-password-reset', operation: 'send_reset_email', error_category: 'DEPENDENCY_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'email', status: 503 })
        }
      }

      return json(GENERIC_RESPONSE, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'request-password-reset', operation: 'request_reset', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', status: 500 })
      return json(GENERIC_RESPONSE, 200, req)
    }
  })
}
