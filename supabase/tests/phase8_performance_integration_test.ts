import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const baseUrl = Deno.env.get('PHASE8_TEST_BASE_URL')
const slug = Deno.env.get('PHASE8_TEST_BUSINESS_SLUG')

function enabled(): boolean {
  return Boolean(baseUrl && slug)
}

function safeTarget(): URL {
  const target = new URL(baseUrl!)
  if (target.protocol !== 'https:' || target.hostname === 'abrobiz.com' || target.hostname.endsWith('.abrobiz.com') || target.hostname.endsWith('.supabase.co')) {
    throw new Error('Phase 8 performance tests refuse production/Supabase hosts')
  }
  return target
}

Deno.test('Phase 8 staging public business page timing smoke test', async () => {
  if (!enabled()) return
  const target = safeTarget()
  const started = performance.now()
  const response = await fetch(new URL(`/r/${encodeURIComponent(slug!)}`, target), { redirect: 'error' })
  const elapsedMs = performance.now() - started
  assertEquals(response.ok, true)
  assert(elapsedMs >= 0)
  console.log(JSON.stringify({ test: 'public-business-page', elapsedMs: Math.round(elapsedMs), status: response.status }))
})
