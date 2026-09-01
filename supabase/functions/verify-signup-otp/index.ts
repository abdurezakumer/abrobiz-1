import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      if (!email || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(token)) return json({ error: 'Enter the six-digit code from your email.' }, 400, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'verify-signup-otp-ip', limit: 20, windowSeconds: 900 },
        { scope: 'verify-signup-otp-account', limit: 8, windowSeconds: 900, identity: email },
      ])
      if (limited) return limited

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'Email verification is temporarily unavailable.' }, 503, req)
      const client = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'signup' })
      if (error || !data.session) return json({ error: 'That verification code is invalid or expired.' }, 400, req)

      return json({
        session: data.session,
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
      }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'verify-signup-otp', operation: 'verify_otp', error_category: 'AUTHENTICATION_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', status: 400 })
      return json({ error: 'That verification code is invalid or expired.' }, 400, req)
    }
  })
}
