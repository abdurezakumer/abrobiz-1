import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { TelegramClient } from '../_shared/telegram.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { detectAllowedFile } from '../_shared/fileSecurity.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isBearerAuthorization, readBinaryBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

const MAX_BYTES = 5 * 1024 * 1024

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

function channelId(): string | null {
  const value = Deno.env.get('TELEGRAM_PAYMENT_CHANNEL_ID')?.trim() ?? ''
  return /^-?[0-9]{5,32}$/.test(value) ? value : null
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated.' }, 401, req)

      const businessId = req.headers.get('X-Business-Id') ?? ''
      const uploadId = req.headers.get('X-Upload-Id') ?? ''
      const contentType = req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
      if (!validUuid(businessId) || !validUuid(uploadId) || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
        return json({ error: 'Invalid payment proof upload.' }, 400, req)
      }

      const configuredChannel = channelId()
      if (!configuredChannel || !Deno.env.get('TELEGRAM_BOT_TOKEN')) {
        return json({ error: 'Payment proof service is temporarily unavailable.' }, 503, req)
      }

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'Payment proof service is temporarily unavailable.' }, 503, req)
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'telegram-proof-ip', limit: 20, windowSeconds: 3600 },
        { scope: 'telegram-proof-user', limit: 10, windowSeconds: 3600, identity: userData.user.id },
        { scope: 'telegram-proof-business', limit: 10, windowSeconds: 3600, identity: businessId },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: business } = await db.from('businesses').select('id, name, slug').eq('id', businessId).eq('owner_id', userData.user.id).maybeSingle()
      if (!business) return json({ error: 'Not found or not authorized.' }, 403, req)
      // A retry after a lost mobile response returns the original proof and
      // never posts a second receipt to the archive channel.
      const { data: existing } = await db
        .from('telegram_payment_proofs')
        .select('id')
        .eq('business_id', businessId)
        .eq('client_upload_id', uploadId)
        .maybeSingle()
      if (existing?.id) return json({ proofId: existing.id }, 200, req)

      const { data: pendingPayment } = await db.from('payments').select('id').eq('business_id', businessId).eq('status', 'pending').maybeSingle()
      if (pendingPayment?.id) return json({ error: 'A payment is already awaiting admin review.' }, 409, req)

      const body = await readBinaryBody(req, MAX_BYTES)
      if (body.error || !body.bytes) return json({ error: body.error }, body.status ?? 400, req)
      const extension = detectAllowedFile(contentType, body.bytes)
      if (!extension) return json({ error: 'Unsupported or malformed image.' }, 415, req)

      const tg = new TelegramClient(Deno.env.get('TELEGRAM_BOT_TOKEN')!)
      const caption = [
        'AbroBiz payment proof',
        `Business: ${String(business.name ?? 'Business').slice(0, 120)}`,
        `Reference: ${uploadId}`,
      ].join('\n')
      const archived = await tg.sendPhotoBytes(
        configuredChannel,
        body.bytes,
        `payment-proof-${uploadId}.${extension}`,
        contentType,
        { caption },
      )
      const message = archived.result as { message_id?: number; photo?: Array<{ file_id?: string }> } | undefined
      const telegramMessageId = message?.message_id
      const telegramFileId = message?.photo?.at(-1)?.file_id
      if (!Number.isSafeInteger(telegramMessageId) || !telegramFileId) {
        throw new Error('Telegram did not return an archived payment proof')
      }

      const { data: proof, error: insertError } = await db
        .from('telegram_payment_proofs')
        .insert({
          business_id: businessId,
          client_upload_id: uploadId,
          telegram_channel_id: configuredChannel,
          telegram_message_id: telegramMessageId,
          telegram_file_id: telegramFileId,
          content_type: contentType,
          file_size: body.bytes.byteLength,
          uploaded_by: userData.user.id,
        })
        .select('id')
        .single()
      if (insertError || !proof?.id) {
        // A concurrent retry can win the unique client_upload_id race. Return
        // its record rather than asking the owner to upload again.
        const { data: raced } = await db
          .from('telegram_payment_proofs')
          .select('id')
          .eq('business_id', businessId)
          .eq('client_upload_id', uploadId)
          .maybeSingle()
        if (raced?.id) return json({ proofId: raced.id }, 200, req)
        throw insertError ?? new Error('Could not record Telegram payment proof')
      }

      return json({ proofId: proof.id }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'telegram-payment-proof', operation: 'archive_payment_proof', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', provider: 'telegram', status: 500 })
      return json({ error: 'Could not save the payment proof.' }, 500, req)
    }
  })
}
