import { createAdminClient } from '../_shared/db.ts'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { validatePassword } from '../_shared/passwordPolicy.ts'
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
      const limited = await enforceRateLimits(req, [
        { scope: 'password-change-ip', limit: 10, windowSeconds: 900 },
      ])
      if (limited) return limited
      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const token = body.token
      const newPassword = body.newPassword
      if (!token || typeof token !== 'string' || token.length > 256) return json({ error: 'token is required' }, 400, req)
      const passwordCheck = validatePassword(newPassword)
      if (!passwordCheck.valid) return json({ error: passwordCheck.error }, 400, req)

      const adminClient = createAdminClient()
      // This RPC is service-role only and atomically claims the token so a
      // concurrent request cannot use the same reset link.
      const { data: userId, error: checkError } = await adminClient.rpc('claim_password_reset_token', { p_token: token })
      if (checkError || !userId) {
        return json({ error: 'Invalid or expired reset link' }, 400, req)
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
      if (updateError) {
        logFailure(req, { function_name: 'reset-password', operation: 'update_password', error_category: 'DATABASE_ERROR', error_code: updateError.code ?? 'unknown', status: 400 })
        await adminClient.rpc('release_password_reset_token', { p_token: token }).catch(() => {})
        return json({ error: 'Could not update your password. Please try again.' }, 500, req)
      }

      const { error: completeError } = await adminClient.rpc('complete_password_reset_token', { p_token: token })
      if (completeError) {
        logFailure(req, { function_name: 'reset-password', operation: 'consume_reset_token', error_category: 'AUTHENTICATION_ERROR', status: 400 })
        return json({ error: 'Your password was updated, but the reset link could not be closed.' }, 500, req)
      }

      return json({ ok: true }, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'reset-password', operation: 'reset_password', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not reset your password. Please request a new link.' }, 500, req)
    }
  })
}
