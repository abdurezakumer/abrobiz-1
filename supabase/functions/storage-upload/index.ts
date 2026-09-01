import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { detectAllowedFile, safeStoragePath } from '../_shared/fileSecurity.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isBearerAuthorization, readBinaryBody, validUuid } from '../_shared/requestSecurity.ts'
import { logFailure } from '../_shared/observability.ts'

type UploadBucket = 'logos' | 'covers' | 'item-images' | 'payment-proofs'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

function bucketConfig(value: string | null): { bucket: UploadBucket; maxBytes: number } | null {
  if (value === 'logos' || value === 'covers' || value === 'item-images') return { bucket: value, maxBytes: 5 * 1024 * 1024 }
  if (value === 'payment-proofs') return { bucket: value, maxBytes: 10 * 1024 * 1024 }
  return null
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)
    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated.' }, 401, req)
      const businessId = req.headers.get('X-Business-Id') ?? ''
      const config = bucketConfig(req.headers.get('X-Upload-Bucket'))
      const contentType = req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
      if (!validUuid(businessId) || !config) return json({ error: 'Invalid upload request.' }, 400, req)

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'Upload service is temporarily unavailable.' }, 503, req)
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'storage-upload-ip', limit: 60, windowSeconds: 3600 },
        { scope: 'storage-upload-user', limit: 30, windowSeconds: 3600, identity: userData.user.id },
        { scope: 'storage-upload-business', limit: 60, windowSeconds: 3600, identity: businessId },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
      const isAdmin = profile?.role === 'admin'
      const businessQuery = db.from('businesses').select('id').eq('id', businessId)
      const { data: business } = isAdmin
        ? await businessQuery.maybeSingle()
        : await businessQuery.eq('owner_id', userData.user.id).maybeSingle()
      if (!business) return json({ error: 'Not found or not authorized.' }, 403, req)

      const body = await readBinaryBody(req, config.maxBytes)
      if (body.error || !body.bytes) return json({ error: body.error }, body.status ?? 400, req)
      const extension = detectAllowedFile(contentType, body.bytes, config.bucket === 'payment-proofs')
      if (!extension || (config.bucket !== 'payment-proofs' && extension === 'pdf')) {
        return json({ error: 'Unsupported or malformed file.' }, 415, req)
      }

      const path = safeStoragePath(businessId, extension)
      const { error: uploadError } = await db.storage.from(config.bucket).upload(path, body.bytes, { contentType, upsert: false })
      if (uploadError) {
        logFailure(req, { function_name: 'storage-upload', operation: 'upload_file', error_category: 'DEPENDENCY_ERROR', error_code: uploadError.name ?? 'unknown', provider: 'storage', status: 502 })
        return json({ error: 'Could not save the file.' }, 500, req)
      }
      return json({ path, bucket: config.bucket }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'storage-upload', operation: 'upload_file', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', provider: 'storage', status: 500 })
      return json({ error: 'Could not save the file.' }, 500, req)
    }
  })
}
