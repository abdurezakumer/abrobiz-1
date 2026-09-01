/**
 * Safe, dependency-free staging smoke/load scaffold.
 *
 * Run only with an explicitly non-production URL, for example:
 *   PHASE8_LOAD_TEST_BASE_URL=https://staging.example.test \
 *   PHASE8_LOAD_TEST_ALLOW=staging node performance/load-test.staging.example.mjs
 *
 * This scaffold performs GET-only requests by default. It refuses AbroBiz
 * production and Supabase project hosts. Mutation scenarios are listed for
 * planning but deliberately disabled until an isolated fixture and an
 * explicit, separately reviewed harness are supplied.
 */
const baseUrl = process.env.PHASE8_LOAD_TEST_BASE_URL
const allow = process.env.PHASE8_LOAD_TEST_ALLOW
const users = Math.min(Math.max(Number(process.env.PHASE8_LOAD_TEST_USERS || 2), 1), 10)
const requestsPerUser = Math.min(Math.max(Number(process.env.PHASE8_LOAD_TEST_REQUESTS || 5), 1), 25)

if (!baseUrl || allow !== 'staging') {
  throw new Error('Set PHASE8_LOAD_TEST_BASE_URL and PHASE8_LOAD_TEST_ALLOW=staging.')
}

const target = new URL(baseUrl)
if (target.protocol !== 'https:' || target.hostname === 'abrobiz.com' || target.hostname.endsWith('.abrobiz.com') || target.hostname.endsWith('.supabase.co')) {
  throw new Error('Refusing production or Supabase targets. Use an isolated HTTPS staging host.')
}

const scenarios = {
  anonymousPublicBrowsing: ['/'],
  authenticatedBrowsing: ['/login'],
  businessDashboard: ['/dashboard'],
  orderCreation: [],
  bookingCreation: [],
  reviewSubmission: [],
  authentication: ['/login', '/register'],
}

const paths = scenarios.anonymousPublicBrowsing
const started = performance.now()
let completed = 0
for (let user = 0; user < users; user += 1) {
  for (let request = 0; request < requestsPerUser; request += 1) {
    for (const path of paths) {
      const response = await fetch(new URL(path, target), { redirect: 'error' })
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
      await response.arrayBuffer()
      completed += 1
    }
  }
}

console.log(JSON.stringify({
  target: target.origin,
  completed,
  elapsedMs: Math.round(performance.now() - started),
  users,
  requestsPerUser,
  mutationScenariosDisabled: true,
}, null, 2))
