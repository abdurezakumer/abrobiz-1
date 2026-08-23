import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

    try {
      const limited = await enforceRateLimit(req, 'password-change', 10, 900)
      if (limited) return limited
      const { token, newPassword } = await req.json()
      if (!token || typeof token !== 'string') return json({ error: 'token is required' }, 400, req)
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return json({ error: 'Password must be at least 6 characters' }, 400, req)
      }

      // Checking the token doesn't need elevated access — it's a plain,
      // non-mutating RPC. The anon client is enough for this step.
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: userId, error: checkError } = await anonClient.rpc('check_password_reset_token', { p_token: token })
      if (checkError || !userId) {
        return json({ error: checkError?.message ?? 'Invalid or expired reset link' }, 400, req)
      }

      // Actually changing the password requires the Admin API, which only
      // works with the service role — the one place in this function that
      // needs elevated access, and only for this one call.
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      })
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
      if (updateError) {
        console.error('Password update failed', updateError)
        return json({ error: 'Could not update your password — please try again.' }, 500, req)
      }

      // Only mark the token used once the password change actually
      // succeeded, so a transient failure above doesn't burn the user's
      // only link.
      await anonClient.rpc('mark_password_reset_token_used', { p_token: token })

      return json({ ok: true }, 200, req)
    } catch (err) {
      console.error('reset-password error', err)
      return json({ error: String(err) }, 500, req)
    }
  })
}
