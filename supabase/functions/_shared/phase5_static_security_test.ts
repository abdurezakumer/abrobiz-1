import assert from 'node:assert/strict'

async function read(relativePath: string): Promise<string> {
  return Deno.readTextFile(new URL(relativePath, import.meta.url))
}

const publicFunctions = [
  '../login/index.ts',
  '../signup/index.ts',
  '../verify-signup-otp/index.ts',
  '../resend-signup-otp/index.ts',
  '../request-password-reset/index.ts',
  '../reset-password/index.ts',
  '../submit-contact/index.ts',
  '../submit-booking/index.ts',
  '../submit-review/index.ts',
  '../submit-order/index.ts',
  '../track-page-view/index.ts',
]

const authenticatedFunctions = [
  '../import-template/index.ts',
  '../send-announcement/index.ts',
  '../send-verification-email/index.ts',
  '../notify-payment-submitted/index.ts',
  '../storage-upload/index.ts',
  '../storage-signed-url/index.ts',
  '../submit-payment/index.ts',
]

Deno.test('Phase 5 public functions have bounded JSON POST contracts and rate limits', async () => {
  for (const path of publicFunctions) {
    const source = await read(path)
    assert.match(source, /req\.method !== 'POST'/, path)
    assert.match(source, /readJsonBody\(/, path)
    assert.match(source, /enforceRateLimit/, path)
  }
})

Deno.test('Phase 5 authenticated functions verify bearer identity before privileged work', async () => {
  for (const path of authenticatedFunctions) {
    const source = await read(path)
    assert.match(source, /isBearerAuthorization\(authHeader\)/, path)
    assert.match(source, /auth\.getUser\(\)/, path)
  }
})

Deno.test('Phase 5 privileged and internal endpoints use safe responses', async () => {
  const verification = await read('../send-verification-email/index.ts')
  const reset = await read('../reset-password/index.ts')
  const cron = await read('../subscription-cron/index.ts')
  const webhook = await read('../telegram-webhook/index.ts')
  assert.doesNotMatch(verification, /tokenError\?\.message/)
  assert.match(verification, /readBoundedBody\(req, 1024\)/)
  assert.match(reset, /token\.length > 256/)
  assert.match(cron, /checkBearerSecret/)
  assert.match(cron, /\.limit\(1000\)/)
  assert.match(cron, /if \(!claimed\) continue/)
  assert.match(webhook, /checkSecret/)
  assert.match(webhook, /claimTelegramUpdate/)
})

Deno.test('Phase 5 external calls are fixed-host, bounded, and not user-URL fetches', async () => {
  const external = await read('./external.ts')
  const mailer = await read('./mailer.ts')
  const telegram = await read('./telegram.ts')
  const importer = await read('../import-template/index.ts')
  assert.match(external, /AbortController/)
  assert.match(external, /maxBytes/)
  assert.match(mailer, /fetchWithTimeout\('https:\/\/api\.resend\.com\/emails'/)
  assert.match(telegram, /fetchWithTimeout/)
  assert.match(importer, /api\.github\.com/)
  assert.match(importer, /raw\.githubusercontent\.com/)
  assert.doesNotMatch(importer, /fetchWithTimeout\(repoUrl/)
})

Deno.test('Phase 5 shared response CORS does not use wildcard origins', async () => {
  const cors = await read('./cors.ts')
  assert.doesNotMatch(cors, /Allow-Origin['"]?\s*:\s*['"]\*['"]|['"]\*['"]\s*,?\s*$/m)
  assert.match(cors, /Cache-Control.*no-store/)
  assert.match(cors, /X-Content-Type-Options.*nosniff/)
})

Deno.test('Phase 5 frontend and migration retain server-side mutation boundaries', async () => {
  const config = await read('../../config.toml')
  const migration = await read('../../migrations/0028_phase3_abuse_hardening.sql')
  const submitOrder = await read('../submit-order/index.ts')
  const submitPayment = await read('../submit-payment/index.ts')
  assert.match(config, /\[functions\.submit-payment\][\s\S]*verify_jwt = true/)
  assert.match(config, /\[functions\.storage-upload\][\s\S]*verify_jwt = true/)
  assert.match(migration, /submit_order_idempotent/)
  assert.match(submitOrder, /Idempotency-Key/)
  assert.match(submitPayment, /Idempotency-Key/)
})
