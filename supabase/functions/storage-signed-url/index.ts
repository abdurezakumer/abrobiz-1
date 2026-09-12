import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { isBearerAuthorization, isRecord, readJsonBody, validUuid } from '../_shared/requestSecurity.ts'
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
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated.' }, 401, req)
      const parsed = await readJsonBody(req, 4 * 1024)
      if (parsed.error) return json({ error: parsed.error }, parsed.status ?? 400, req)
      const body = isRecord(parsed.data) ? parsed.data : {}
      const path = typeof body.path === 'string' ? body.path : ''
      const match = path.match(/^([0-9a-f-]{36})\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/i)
      if (!match || !validUuid(match[1])) return json({ error: 'Invalid file path.' }, 400, req)

      const url = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!url || !anonKey) return json({ error: 'Download service is temporarily unavailable.' }, 503, req)
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: userData, error: userError } = await caller.auth.getUser()
      if (userError || !userData.user) return json({ error: 'Not authenticated.' }, 401, req)
      const limited = await enforceRateLimits(req, [
        { scope: 'storage-signed-url-ip', limit: 60, windowSeconds: 3600 },
        { scope: 'storage-signed-url-user', limit: 60, windowSeconds: 3600, identity: userData.user.id },
      ])
      if (limited) return limited

      const db = createAdminClient()
      const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
      const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
      const businessQuery = db.from('businesses').select('id').eq('id', match[1])
      const { data: business } = isAdmin
        ? await businessQuery.maybeSingle()
        : await businessQuery.eq('owner_id', userData.user.id).maybeSingle()
      if (!business) return json({ error: 'Not found or not authorized.' }, 403, req)
      const { data, error } = await db.storage.from('payment-proofs').createSignedUrl(path, 600, { download: true })
      if (error || !data?.signedUrl) return json({ error: 'Could not prepare the file.' }, 404, req)
      return json({ signedUrl: data.signedUrl, expiresIn: 600 }, 200, req)
    } catch (error) {
      logFailure(req, { function_name: 'storage-signed-url', operation: 'create_signed_url', error_category: 'INTERNAL_ERROR', error_code: error instanceof Error ? error.name : 'UnknownError', provider: 'storage', status: 500 })
      return json({ error: 'Could not prepare the file.' }, 500, req)
    }
  })
}
