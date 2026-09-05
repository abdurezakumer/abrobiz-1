import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validEmail } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

const GENERIC_SEND_RESPONSE = { ok: true, requiresOtp: true, message: 'If the account is eligible, a verification code is on its way.' }

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsed = await readJsonBody(req, 8 * 1024)
      if (parsed.error) return json({ error: 'Unable to sign in with those credentials.' }, 401, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const mode = body.mode
      if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400, req)

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'AbroBiz sign-in is temporarily unavailable.' }, 503, req)

      const client = createClient(url, anonKey, { auth: { persistSession: false } })
      if (mode === 'send-otp') {
        const limited = await enforceRateLimits(req, [
          { scope: 'login-otp-ip', limit: 10, windowSeconds: 900 },
          { scope: 'login-otp-account', limit: 5, windowSeconds: 900, identity: email },
        ])
        if (limited) return limited
        const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'login')
        if (turnstileFailure) return turnstileFailure

        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${(Deno.env.get('SITE_URL') ?? 'https://abrobiz.com').replace(/\/$/, '')}/setup`,
          },
        })
        if (error) {
          // Keep account existence and provider details out of the response.
          logFailure(req, { function_name: 'login', operation: 'send_login_otp', error_category: 'AUTHENTICATION_ERROR', status: 200 })
        }
        return json(GENERIC_SEND_RESPONSE, 200, req)
      }

      if (mode !== 'verify-otp') return json({ error: 'Choose a valid sign-in method.' }, 400, req)
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      if (!/^\d{6}$/.test(token)) return json({ error: 'Enter the six-digit verification code.' }, 400, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'login-otp-verify-ip', limit: 20, windowSeconds: 900 },
        { scope: 'login-otp-verify-account', limit: 8, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited

      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' })
      if (error || !data.session) {
        logFailure(req, { function_name: 'login', operation: 'verify_login_otp', error_category: 'AUTHENTICATION_ERROR', status: 401 })
        return json({ error: 'That verification code is invalid or expired.' }, 401, req)
      }
      return json({ session: data.session, user: data.user ? { id: data.user.id, email: data.user.email } : null }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'login', operation: 'otp_flow', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 503 })
      return json({ error: 'AbroBiz sign-in is temporarily unavailable.' }, 503, req)
    }
  })
}
