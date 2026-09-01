import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 14 environment template has placeholders and canonical project only', async () => {
  const example = await read('../../../.env.example')
  assert.match(example, /VITE_SUPABASE_URL=https:\/\/qgbvuvxxfogcsvqzncdx\.supabase\.co/)
  assert.match(example, /SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(example, /RESEND_API_KEY=YOUR_RESEND_API_KEY/)
  assert.match(example, /TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY/)
  assert.doesNotMatch(example, /ckawqslkbanqolbvdpgf|sb_secret_[A-Za-z0-9_-]{12,}|re_[A-Za-z0-9_-]{12,}/)
})

Deno.test('Phase 14 environment files are protected and CORS has one canonical name', async () => {
  const gitignore = await read('../../../.gitignore')
  const example = await read('../../../.env.example')
  const cors = await read('./cors.ts')
  assert.match(gitignore, /\.env\.\*/)
  assert.match(gitignore, /!\.env\.example/)
  assert.match(example, /^CORS_ALLOWED_ORIGINS=/m)
  assert.doesNotMatch(example, /^CORS_ORIGIN(S)?=/m)
  assert.doesNotMatch(cors, /CORS_ORIGIN(?!S_ALLOWED)/)
  assert.match(cors, /CORS_ALLOWED_ORIGINS/)
})

Deno.test('Phase 14 keeps canonical Supabase configuration and no duplicate Telegram file import', async () => {
  const config = await read('../../../supabase/config.toml')
  const localEnv = await read('../../../.env')
  const webhook = await read('../telegram-webhook/index.ts')
  assert.match(config, /project_id\s*=\s*"qgbvuvxxfogcsvqzncdx"/)
  assert.match(localEnv, /^VITE_SUPABASE_URL=https:\/\/qgbvuvxxfogcsvqzncdx\.supabase\.co/m)
  assert.equal((webhook.match(/import\s+\{[^}]*detectAllowedFile[^}]*\}\s+from\s+'\.\.\/\_shared\/fileSecurity\.ts'/g) ?? []).length, 1)
})

Deno.test('Phase 14 retains tenant, Turnstile, and security configuration references', async () => {
  const sources = await Promise.all([
    read('../../../src/lib/tenantHostname.ts'),
    read('../../../src/lib/turnstile.ts'),
    read('../../../supabase/functions/_shared/turnstile.ts'),
    read('../../../supabase/migrations/0024_tenant_subdomain_isolation.sql'),
  ])
  const source = sources.join('\n')
  assert.match(source, /abrobiz\.com/)
  assert.match(source, /TURNSTILE/)
  assert.match(source, /owner_id/)
})
