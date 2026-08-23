import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildPasswordResetEmail } from './email.ts'
import { createSenderFromEnv, sendEmail } from '../_shared/mailer.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

// Always the same response, whether or not the email matched an account —
// deliberate, so this endpoint can't be used to discover who has an account.
const GENERIC_RESPONSE = { ok: true, message: 'If that email has an account, a reset link is on its way.' }

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

    try {
      const limited = await enforceRateLimit(req, 'password-reset', 5, 900)
      if (limited) return limited
      const { email } = await req.json()
      if (!email || typeof email !== 'string') {
        return json({ error: 'email is required' }, 400, req)
      }

      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data, error } = await anonClient.rpc('request_password_reset', { p_email: email })

      if (error) {
        console.error('request_password_reset RPC failed', error)
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
          if (!result.ok) console.error('Password reset email send failed', result.error)
        } catch (err) {
          console.error('Email sending is not configured', err)
        }
      }

      return json(GENERIC_RESPONSE, 200, req)
    } catch (err) {
      console.error('request-password-reset error', err)
      return json(GENERIC_RESPONSE, 200, req)
    }
  })
}
