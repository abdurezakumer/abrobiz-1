import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildAnnouncementEmail } from './email.ts'
import { createSenderFromEnv, sendEmail } from '../_shared/mailer.ts'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { isBearerAuthorization, isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated' }, 401, req)

      // Runs entirely on the calling admin's own session — admins can
      // already read every profile (existing RLS), so no service role is
      // needed anywhere in this function.
      const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: userData, error: userError } = await client.auth.getUser()
      if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401, req)

      const { data: permitted } = await client.rpc('has_admin_permission', { p_permission: 'announcements.send' })
      if (!permitted) return json({ error: 'Announcement permission required' }, 403, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'announcement-ip', limit: 20, windowSeconds: 3600 },
        { scope: 'announcement-admin', limit: 10, windowSeconds: 3600, identity: userData.user.id },
      ])
      if (limited) return limited

      const parsedBody = await readJsonBody(req, 16 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const bodyData = isRecord(parsedBody.data) ? parsedBody.data : {}
      const subject = bodyData.subject
      const body = bodyData.body
      if (!subject || typeof subject !== 'string' || !body || typeof body !== 'string') {
        return json({ error: 'subject and body are required' }, 400, req)
      }
      if (subject.length > 200 || body.length > 10000) {
        return json({ error: 'The announcement is too long.' }, 400, req)
      }

      const { data: recipients, error: recipientsError, count: recipientCount } = await client
        .from('profiles')
        .select('id, email, name', { count: 'exact' })
        .eq('role', 'owner')
        .not('email', 'is', null)
        .limit(1000)

      if (recipientsError) {
        logFailure(req, { function_name: 'send-announcement', operation: 'load_recipients', error_category: 'DATABASE_ERROR', error_code: recipientsError.code ?? 'unknown', status: 500 })
        return json({ error: 'Could not load recipients' }, 500, req)
      }
      if ((recipientCount ?? 0) > 1000) {
        return json({ error: 'This announcement is too large to send in one request.' }, 413, req)
      }

      const appName = Deno.env.get('APP_NAME') ?? 'AbroBiz'
      const content = buildAnnouncementEmail(subject, body, appName)

      const serviceDb = createAdminClient()
      const ownerIds = (recipients ?? []).map(recipient => recipient.id).filter(Boolean)
      const { data: ownerBusinesses } = ownerIds.length > 0
        ? await serviceDb.from('businesses').select('id, owner_id').in('owner_id', ownerIds)
        : { data: [] as any[] }
      const businessIds = (ownerBusinesses ?? []).map((business: any) => business.id).filter(Boolean)
      const { data: telegramLinks } = businessIds.length > 0
        ? await serviceDb.from('business_telegram_links').select('business_id, telegram_chat_id').in('business_id', businessIds).not('telegram_chat_id', 'is', null)
        : { data: [] as any[] }
      const chatByOwner = new Map<string, string>()
      const ownerByBusiness = new Map((ownerBusinesses ?? []).map((business: any) => [business.id, business.owner_id]))
      for (const link of telegramLinks ?? []) {
        const ownerId = ownerByBusiness.get(link.business_id)
        if (ownerId && link.telegram_chat_id) chatByOwner.set(ownerId, link.telegram_chat_id)
      }
      const tg = Deno.env.get('TELEGRAM_BOT_TOKEN') ? new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!) : null

      // Keep announcements visible in the dashboard notification bell as well
      // as sending them to the configured external channels.
      if (ownerIds.length > 0) {
        await serviceDb.from('notifications').insert(ownerIds.map(userId => ({
          user_id: userId,
          type: 'announcement',
          title: subject,
          body: body.slice(0, 500),
          link: '/dashboard',
        })))
      }

      let sender: ReturnType<typeof createSenderFromEnv>
      try {
        sender = createSenderFromEnv(Deno.env)
      } catch (err) {
        logFailure(req, { function_name: 'send-announcement', operation: 'send_announcement_email', error_category: 'DEPENDENCY_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', provider: 'email', status: 503 })
        return json({ error: 'Email sending is not configured yet' }, 500, req)
      }

      let sent = 0
      let failed = 0
      let telegramSent = 0
      for (const recipient of recipients ?? []) {
        if (recipient.email) {
          const result = await sendEmail(sender.sendMail, { from: sender.from, to: recipient.email, content })
          if (result.ok) sent++
          else {
            failed++
            logFailure(req, { function_name: 'send-announcement', operation: 'send_announcement_email', error_category: 'DEPENDENCY_ERROR', provider: 'email', outcome: 'provider_rejected', status: 502 })
          }
        }
        const chatId = chatByOwner.get(recipient.id)
        if (tg && chatId) {
          await tg.sendMessage(chatId, `📢 ${subject}\n\n${body.slice(0, 3500)}`).then(() => { telegramSent++ }).catch(() => {
            logFailure(req, { function_name: 'send-announcement', operation: 'send_announcement_telegram', error_category: 'DEPENDENCY_ERROR', provider: 'telegram', outcome: 'provider_rejected', status: 502 })
          })
        }
      }

      await client.from('announcements').insert({
        admin_id: userData.user.id,
        subject,
        body,
        recipient_count: sent,
      })

      return json({ ok: true, sent, failed, telegramSent, total: (recipients ?? []).length }, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'send-announcement', operation: 'send_announcement', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not send the announcement.' }, 500, req)
    }
  })
}
