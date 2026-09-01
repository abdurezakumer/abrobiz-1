import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

Deno.test('Phase 7 frontend has no executable HTML sinks or dynamic code evaluation', async () => {
  const sources = await Promise.all([
    read('../../../src/App.tsx'),
    read('../../../src/components/StorefrontLayout.tsx'),
    read('../../../src/pages/BusinessSettings.tsx'),
    read('../../../src/pages/SetupWizard.tsx'),
    read('../../../src/pages/storefront/StorefrontHome.tsx'),
    read('../../../src/pages/storefront/StorefrontMenu.tsx'),
    read('../../../src/pages/storefront/StorefrontAbout.tsx'),
    read('../../../src/pages/storefront/StorefrontContact.tsx'),
  ])
  const source = sources.join('\n')
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write/i)
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/i)
})

Deno.test('Phase 7 browser boundary and headers remain hardened', async () => {
  const source = await read('../../../vercel.json')
  assert.match(source, /Content-Security-Policy/)
  assert.match(source, /frame-ancestors 'none'/)
  assert.match(source, /X-Frame-Options/)
  assert.match(source, /Strict-Transport-Security/)

  const clientFiles = await Promise.all([
    read('../../../src/lib/supabaseClient.ts'),
    read('../../../src/lib/authActions.ts'),
    read('../../../src/lib/safeUrl.ts'),
  ])
  const client = clientFiles.join('\n')
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|TELEGRAM_BOT_TOKEN|CRON_SECRET|GOOGLE_CLIENT_SECRET/i)
  assert.match(client, /safeInternalPath|safeHttpsUrl|safeImageUrl/)
})

Deno.test('Phase 7 external navigation is explicitly protected', async () => {
  const source = await read('../../../src/components/StorefrontLayout.tsx')
  const admin = await read('../../../src/pages/admin/AdminSettings.tsx')
  assert.doesNotMatch(`${source}\n${admin}`, /target="_blank"[^\n]*rel="noreferrer"/i)
  assert.match(source, /safeHttpsUrl|safeTelegramUrl/)
  assert.match(admin, /safeHttpsUrl|safeImageUrl/)
})
