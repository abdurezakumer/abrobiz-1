import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildAnnouncementEmail } from './email.ts'
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

      // Runs entirely on the calling admin's own session — admins can
      // already read every profile (existing RLS), so no service role is
      // needed anywhere in this function.
      const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: userData, error: userError } = await client.auth.getUser()
      if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401, req)

      const { data: callerProfile } = await client.from('profiles').select('role').eq('id', userData.user.id).single()
      if (callerProfile?.role !== 'admin') return json({ error: 'Admins only' }, 403, req)

      const limited = await enforceRateLimit(req, 'announcement', 10, 3600, userData.user.id)
      if (limited) return limited

      const { subject, body } = await req.json()
      if (!subject || typeof subject !== 'string' || !body || typeof body !== 'string') {
        return json({ error: 'subject and body are required' }, 400, req)
      }

      const { data: recipients, error: recipientsError } = await client
        .from('profiles')
        .select('email, name')
        .eq('role', 'owner')
        .not('email', 'is', null)

      if (recipientsError) {
        console.error('Could not load recipients', recipientsError)
        return json({ error: 'Could not load recipients' }, 500, req)
      }

      const appName = Deno.env.get('APP_NAME') ?? 'AbroBiz'
      const content = buildAnnouncementEmail(subject, body, appName)

      let sender: ReturnType<typeof createSenderFromEnv>
      try {
        sender = createSenderFromEnv(Deno.env)
      } catch (err) {
        console.error(err)
        return json({ error: 'Email sending is not configured yet' }, 500, req)
      }

      let sent = 0
      let failed = 0
      for (const recipient of recipients ?? []) {
        if (!recipient.email) continue
        const result = await sendEmail(sender.sendMail, { from: sender.from, to: recipient.email, content })
        if (result.ok) sent++
        else {
          failed++
          console.error('Failed to send announcement to', recipient.email, result.error)
        }
      }

      await client.from('announcements').insert({
        admin_id: userData.user.id,
        subject,
        body,
        recipient_count: sent,
      })

      return json({ ok: true, sent, failed, total: (recipients ?? []).length }, 200, req)
    } catch (err) {
      console.error('send-announcement error', err)
      return json({ error: String(err) }, 500, req)
    }
  })
}
