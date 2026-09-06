import { createAdminClient } from '../_shared/db.ts'
import { sendAuthOtpEmail } from '../_shared/authOtpEmail.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { validatePassword } from '../_shared/passwordPolicy.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

const GENERIC_RESPONSE = { ok: true, requiresVerification: true, message: 'If the account can be created, a verification code is on its way.' }

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 16 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const email = normalizeEmail(body.email)
      const password = body.password
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

      if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400, req)
      if (!body?.termsAccepted || !body?.privacyAccepted) return json({ error: 'Accept the Terms of Service and Privacy Policy to continue.' }, 400, req)
      const passwordCheck = validatePassword(password)
      if (!passwordCheck.valid) return json({ error: passwordCheck.error }, 400, req)
      if (!name || name.length > 120 || !phone || phone.length > 40) return json({ error: 'Enter your name and phone number.' }, 400, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'signup-ip', limit: 10, windowSeconds: 900 },
        { scope: 'signup-account', limit: 5, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'signup')
      if (turnstileFailure) return turnstileFailure

      const adminClient = createAdminClient()
      // Generate the Auth OTP without asking Supabase to send its own email.
      // The returned code is delivered by the AbroBiz mailer below.
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: {
            name,
            phone,
          },
          redirectTo: `${(Deno.env.get('SITE_URL') ?? 'https://abrobiz.com').replace(/\/$/, '')}/setup`,
        },
      })

      if (error) {
        // Keep duplicate-account and Auth-provider details out of the response.
        logFailure(req, { function_name: 'signup', operation: 'auth_signup', error_category: 'AUTHENTICATION_ERROR', status: 200 })
        return json(GENERIC_RESPONSE, 200, req)
      }

      const code = data?.properties?.email_otp
      if (!code || !/^\d{6}$/.test(code)) {
        logFailure(req, { function_name: 'signup', operation: 'generate_signup_otp', error_category: 'DEPENDENCY_ERROR', provider: 'supabase-auth', status: 503 })
        return json({ error: 'AbroBiz verification is temporarily unavailable.' }, 503, req)
      }

      const emailResult = await sendAuthOtpEmail({ email, code, name, purpose: 'signup' })
      if (!emailResult.ok) {
        logFailure(req, { function_name: 'signup', operation: 'send_signup_otp', error_category: 'DEPENDENCY_ERROR', error_code: 'email_delivery_failed', provider: 'email', status: 503 })
        return json({ error: 'AbroBiz verification email could not be sent.' }, 503, req)
      }

      return json({ ...GENERIC_RESPONSE, session: null, user: data.user ? { id: data.user.id, email: data.user.email } : null }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'signup', operation: 'auth_signup', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 503 })
      return json({ error: 'AbroBiz sign-up is temporarily unavailable.' }, 503, req)
    }
  })
}
