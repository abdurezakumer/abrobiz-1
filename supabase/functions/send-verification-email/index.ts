import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildVerificationEmail } from './email.ts'
import { createSenderFromEnv, sendEmail } from '../_shared/mailer.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!authHeader) return json({ error: 'Not authenticated' }, 401, req)

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

      const limited = await enforceRateLimit(req, 'verification-email', 3, 900, userData.user.id)
      if (limited) return limited

      const { data: token, error: tokenError } = await userClient.rpc('create_email_verification_token')
      if (tokenError || !token) {
        return json({ error: tokenError?.message ?? 'Could not create a verification token' }, 500, req)
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
        console.error(err)
        return json({ error: 'Email sending is not configured yet' }, 500, req)
      }

      const result = await sendEmail(sender.sendMail, { from: sender.from, to: userData.user.email, content })
      if (!result.ok) {
        console.error('Verification email send failed', result.error)
        return json({ error: result.error }, 502, req)
      }

      return json({ ok: true }, 200, req)
    } catch (err) {
      console.error('send-verification-email error', err)
      return json({ error: String(err) }, 500, req)
    }
  })
}
