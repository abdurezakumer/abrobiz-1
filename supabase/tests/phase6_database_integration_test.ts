import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const supabaseUrl = Deno.env.get('PHASE6_TEST_SUPABASE_URL')
const anonKey = Deno.env.get('PHASE6_TEST_SUPABASE_ANON_KEY')
const userAToken = Deno.env.get('PHASE6_TEST_USER_A_TOKEN')
const userBToken = Deno.env.get('PHASE6_TEST_USER_B_TOKEN')
const businessA = Deno.env.get('PHASE6_TEST_BUSINESS_A_ID')
const businessB = Deno.env.get('PHASE6_TEST_BUSINESS_B_ID')

function enabled(): boolean {
  return Boolean(supabaseUrl && anonKey && userAToken && userBToken && businessA && businessB)
}

async function select(table: string, token: string, query: string): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: anonKey!, Authorization: `Bearer ${token}` },
  })
}

Deno.test('Phase 6 owner RLS preserves cross-tenant isolation on high-growth tables', async () => {
  if (!enabled()) return
  for (const table of ['orders', 'payments', 'bookings', 'reviews', 'contact_messages']) {
    const own = await select(table, userAToken!, `business_id=eq.${businessA}&select=id&limit=200`)
    const foreign = await select(table, userAToken!, `business_id=eq.${businessB}&select=id&limit=200`)
    assertEquals(own.ok, true, `${table} own query failed`)
    assertEquals(foreign.ok, true, `${table} foreign query failed`)
    const foreignRows = await foreign.json()
    assertEquals(Array.isArray(foreignRows) ? foreignRows.length : -1, 0, `${table} cross-tenant rows were visible`)
  }
})

Deno.test('Phase 6 list queries remain explicitly bounded', async () => {
  if (!enabled()) return
  for (const table of ['orders', 'payments', 'bookings', 'reviews', 'contact_messages']) {
    const response = await select(table, userAToken!, `business_id=eq.${businessA}&select=id&limit=200`)
    assertEquals(response.ok, true)
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error(`${table} did not return an array`)
    if (rows.length > 200) throw new Error(`${table} exceeded the requested bound`)
  }
})
