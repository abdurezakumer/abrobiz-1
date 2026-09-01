import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody, validEmail } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'
import { requireTurnstile } from '../_shared/turnstile.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

const GENERIC_ERROR = { error: 'Unable to sign in with those credentials.' }

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json(GENERIC_ERROR, 401, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = body.password
      if (!validEmail(email) || typeof password !== 'string' || password.length === 0 || password.length > 128) {
        return json(GENERIC_ERROR, 401, req)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'login-ip', limit: 30, windowSeconds: 900 },
        { scope: 'login-account', limit: 10, windowSeconds: 900, identity: email },
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
        logFailure(req, { function_name: 'login', operation: 'auth_login', error_category: 'AUTHENTICATION_ERROR', status: 401 })
        return json(GENERIC_ERROR, 401, req)
      }
      return json({ session: data.session, user: data.user ? { id: data.user.id, email: data.user.email } : null }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'login', operation: 'auth_login', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 503 })
      return json({ error: 'AbroBiz sign-in is temporarily unavailable.' }, 503, req)
    }
  })
}
