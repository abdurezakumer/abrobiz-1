/**
 * Phase 9 safe staging failure-test scaffold.
 *
 * This intentionally does not disable services, send mail, submit payments,
 * create orders, or mutate storage. It verifies only safe health behavior and
 * malformed-request handling against an explicitly non-production target.
 */
const baseUrl = process.env.PHASE9_FAILURE_TEST_BASE_URL
const allow = process.env.PHASE9_FAILURE_TEST_ALLOW

if (!baseUrl || allow !== 'staging') {
  throw new Error('Set PHASE9_FAILURE_TEST_BASE_URL and PHASE9_FAILURE_TEST_ALLOW=staging.')
}

const target = new URL(baseUrl)
if (target.protocol !== 'https:') throw new Error('Failure tests require HTTPS.')
if (target.hostname === 'abrobiz.com' || target.hostname.endsWith('.abrobiz.com') || target.hostname.endsWith('.supabase.co')) {
  throw new Error('Production and Supabase hosts are forbidden.')
}

async function check(path, expectedStatuses) {
  const response = await fetch(new URL(path, target), { redirect: 'error', headers: { Accept: 'application/json' } })
  const text = await response.text()
  if (!expectedStatuses.includes(response.status)) throw new Error(`${path} returned ${response.status}`)
  if (text.length > 16 * 1024) throw new Error(`${path} returned an unexpectedly large response`)
  return { path, status: response.status, hasSafeBody: !/(SUPABASE|DATABASE|SECRET|TOKEN|stack|password)/i.test(text) }
}

const checks = [
  await check('/functions/v1/health?check=liveness', [200]),
  await check('/functions/v1/health?check=invalid', [400]),
  await check('/functions/v1/health?check=readiness', [200, 503]),
]

if (checks.some(result => !result.hasSafeBody)) throw new Error('A health response contained a forbidden diagnostic term.')
console.log(JSON.stringify({ target_origin: target.origin, checks }))
