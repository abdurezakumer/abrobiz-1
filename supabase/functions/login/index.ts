import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validEmail } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsed = await readJsonBody(req, 8 * 1024)
      if (parsed.error) return json({ error: 'Unable to sign in with those credentials.' }, 401, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400, req)

      const password = typeof body.password === 'string' ? body.password : ''
      if (!password || password.length > 128) return json({ error: 'Enter your email and password.' }, 400, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'login-password-ip', limit: 20, windowSeconds: 900 },
        { scope: 'login-password-account', limit: 8, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited
      const turnstileFailure = await requireTurnstile(req, body.turnstileToken, 'login')
      if (turnstileFailure) return turnstileFailure

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'AbroBiz sign-in is temporarily unavailable.' }, 503, req)
      const client = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !data.session) {
        logFailure(req, { function_name: 'login', operation: 'password_login', error_category: 'AUTHENTICATION_ERROR', error_code: error?.name ?? 'invalid_credentials', status: 401 })
        return json({ error: 'Incorrect email or password.' }, 401, req)
      }
      return json({ session: data.session, user: data.user ? { id: data.user.id, email: data.user.email } : null }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'login', operation: 'otp_flow', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 503 })
      return json({ error: 'AbroBiz sign-in is temporarily unavailable.' }, 503, req)
    }
  })
}
