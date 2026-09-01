import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildVerificationEmail } from './email.ts'
import { createSenderFromEnv, sendEmail } from '../_shared/mailer.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { isBearerAuthorization, readBoundedBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const bounded = await readBoundedBody(req, 1024)
      if (bounded.error) return json({ error: bounded.error }, bounded.status ?? 413, req)
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated' }, 401, req)

      // Act as the calling user (not the service role) — create_email_verification_token()
      // reads auth.uid() from this request's own JWT, and this function never needs
      // elevated access beyond "send an email for whoever is asking".
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData?.user?.email) {
        return json({ error: 'Not authenticated' }, 401, req)
      }

      const limited = await enforceRateLimits(req, [
        { scope: 'verification-email-ip', limit: 10, windowSeconds: 900 },
        { scope: 'verification-email-user', limit: 3, windowSeconds: 900, identity: userData.user.id },
      ])
      if (limited) return limited

      const { data: token, error: tokenError } = await userClient.rpc('create_email_verification_token')
      if (tokenError || !token) {
        logFailure(req, { function_name: 'send-verification-email', operation: 'create_verification_token', error_category: 'DATABASE_ERROR', error_code: tokenError?.code ?? 'unknown', status: 500 })
        return json({ error: 'Could not create a verification token.' }, 500, req)
      }

      const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
      const verifyUrl = `${siteUrl.replace(/\/$/, '')}/verify-email?token=${token}`
      const name = (userData.user.user_metadata?.name as string | undefined) ?? ''
      const appName = Deno.env.get('APP_NAME') ?? 'AbroBiz'

      const content = buildVerificationEmail(name, verifyUrl, appName)

      let sender: ReturnType<typeof createSenderFromEnv>
      try {
        sender = createSenderFromEnv(Deno.env)
      } catch (err) {
        logFailure(req, { function_name: 'send-verification-email', operation: 'send_verification_email', error_category: 'DEPENDENCY_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'email', status: 503 })
        return json({ error: 'Email sending is not configured yet' }, 500, req)
      }

      const result = await sendEmail(sender.sendMail, { from: sender.from, to: userData.user.email, content })
      if (!result.ok) {
        logFailure(req, { function_name: 'send-verification-email', operation: 'send_verification_email', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'provider_rejected', status: 502 })
        return json({ error: 'Could not send the verification email.' }, 502, req)
      }

      return json({ ok: true }, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'send-verification-email', operation: 'send_verification_email', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'email', status: 500 })
      return json({ error: 'Could not send the verification email.' }, 500, req)
    }
  })
}
