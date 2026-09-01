/**
 * Safe, read-only tenant routing smoke test. It never changes DNS and refuses
 * production, Supabase, and Cloudflare API hosts.
 */
const baseUrl = process.env.PHASE10_ROUTING_BASE_URL
if (process.env.PHASE10_ROUTING_ALLOW !== 'staging' || !baseUrl) throw new Error('Set PHASE10_ROUTING_BASE_URL and PHASE10_ROUTING_ALLOW=staging.')
const target = new URL(baseUrl)
if (target.protocol !== 'https:') throw new Error('Routing tests require HTTPS.')
if (target.hostname === 'abrobiz.com' || target.hostname.endsWith('.abrobiz.com') || target.hostname.endsWith('.supabase.co') || target.hostname.endsWith('.cloudflare.com')) {
  throw new Error('Production, Supabase, and Cloudflare hosts are forbidden.')
}

const slugs = (process.env.PHASE10_ROUTING_SLUGS ?? 'business1,business2,unknown').split(',').map(value => value.trim()).filter(Boolean).slice(0, 3)
const results = []
for (const slug of slugs) {
  const url = new URL(`/r/${encodeURIComponent(slug)}`, target)
  const response = await fetch(url, { redirect: 'error', headers: { Accept: 'text/html' } })
  const body = await response.text()
  if (body.length > 2 * 1024 * 1024) throw new Error('Unexpectedly large routing response')
  results.push({ slug, status: response.status })
}
console.log(JSON.stringify({ target_origin: target.origin, results, note: 'Verify tenant identity and no cross-tenant data with staging browser/API tests.' }))
