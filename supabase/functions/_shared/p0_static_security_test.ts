import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('password reset migration removes plaintext storage and public execution', async () => {
  const sql = await read('../../migrations/0025_phase0_security_hardening.sql')
  assert.match(sql, /drop column if exists token/i)
  assert.match(sql, /digest\(v_raw_token, 'sha256'\)/i)
  assert.match(sql, /revoke all on function public\.request_password_reset\(text\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.request_password_reset\(text\) to service_role/i)
  assert.match(sql, /claim_password_reset_token/i)
})

Deno.test('P0 Edge Functions do not use the anon client for reset tokens', async () => {
  const requestSource = await read('../request-password-reset/index.ts')
  const resetSource = await read('../reset-password/index.ts')
  assert.doesNotMatch(requestSource, /SUPABASE_ANON_KEY/)
  assert.doesNotMatch(resetSource, /SUPABASE_ANON_KEY/)
  assert.match(requestSource, /createAdminClient/)
  assert.match(resetSource, /claim_password_reset_token/)
})

Deno.test('private secrets are absent from frontend source and built assets', async () => {
  const forbidden = /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|TELEGRAM_WEBHOOK_SECRET|CRON_SECRET|GOOGLE_CLIENT_SECRET/

  async function visit(relativePath: string): Promise<void> {
    const directory = new URL(relativePath, import.meta.url)
    for await (const entry of Deno.readDir(directory)) {
      const child = new URL(entry.name, directory)
      if (entry.isDirectory) await visit(child.href)
      else if (entry.isFile && /\.(ts|tsx|js|html|css)$/.test(entry.name)) {
        const content = await Deno.readTextFile(child)
        assert.doesNotMatch(content, forbidden, child.pathname)
      }
    }
  }

  await visit('../../../src')
  await visit('../../../dist')
})

Deno.test('Phase 1 uses Auth OTP wrappers and never creates a parallel OTP store', async () => {
  const signup = await read('../signup/index.ts')
  const verify = await read('../verify-signup-otp/index.ts')
  const resend = await read('../resend-signup-otp/index.ts')
  const migration = await read('../../migrations/0026_phase1_auth_security.sql')

  assert.match(signup, /client\\.auth\\.signUp/)
  assert.match(signup, /termsAccepted/)
  assert.match(signup, /validatePassword/)
  assert.match(verify, /client\\.auth\\.verifyOtp/)
  assert.match(verify, /type: 'signup'/)
  assert.match(verify, /\\^\\\\d\\{6\\}\\$/)
  assert.match(resend, /client\\.auth\\.resend/)
  assert.match(resend, /resend-signup-otp/)
  assert.match(migration, /record_legal_acceptance/)
  assert.match(migration, /businesses_require_verified_legal_owner/)
  assert.match(migration, /Auth-managed profile fields cannot be edited directly/)
  assert.match(migration, /revoke all on function public\\.verify_email_token/)
  assert.doesNotMatch(signup + verify + resend, /console\\.log\\([^)]*password|console\\.log\\([^)]*token/i)
})
