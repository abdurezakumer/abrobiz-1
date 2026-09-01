import assert from 'node:assert/strict'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const url = Deno.env.get('PHASE2_TEST_SUPABASE_URL')
const anonKey = Deno.env.get('PHASE2_TEST_SUPABASE_ANON_KEY')
const tokenA = Deno.env.get('PHASE2_TEST_USER_A_TOKEN')
const tokenB = Deno.env.get('PHASE2_TEST_USER_B_TOKEN')
const businessA = Deno.env.get('PHASE2_TEST_BUSINESS_A_ID')
const businessB = Deno.env.get('PHASE2_TEST_BUSINESS_B_ID')
const categoryB = Deno.env.get('PHASE2_TEST_CATEGORY_B_ID')
const orderB = Deno.env.get('PHASE2_TEST_ORDER_B_ID')
const paymentB = Deno.env.get('PHASE2_TEST_PAYMENT_B_ID')
const paymentProofB = Deno.env.get('PHASE2_TEST_PAYMENT_PROOF_B_PATH')
const configured = Boolean(url && anonKey && tokenA && tokenB && businessA && businessB && categoryB && orderB && paymentB && paymentProofB)

function client(token: string) {
  return createClient(url!, anonKey!, { global: { headers: { Authorization: 'Bearer ' + token } } })
}

Deno.test({
  name: 'User A can read own tenant data but cannot read or mutate User B private data',
  ignore: !configured,
  async fn() {
    const a = client(tokenA!)
    const b = client(tokenB!)

    const own = await a.from('businesses').select('id').eq('id', businessA!).maybeSingle()
    assert.equal(own.error, null)
    assert.equal(own.data?.id, businessA)

    const foreign = await a.from('payments').select('id').eq('id', paymentB!).maybeSingle()
    assert.equal(foreign.error, null)
    assert.equal(foreign.data, null)

    const foreignOrder = await a.from('orders').select('id').eq('id', orderB!).maybeSingle()
    assert.equal(foreignOrder.error, null)
    assert.equal(foreignOrder.data, null)

    const foreignStorage = await a.storage.from('payment-proofs').download(paymentProofB!)
    assert.ok(foreignStorage.error)

    const foreignInsert = await a.from('categories').insert({ business_id: businessB!, name: 'unauthorized' })
    assert.ok(foreignInsert.error)

    const foreignUpdate = await a.from('orders').update({ status: 'cancelled' }).eq('id', orderB!).select('id').maybeSingle()
    assert.equal(foreignUpdate.error, null)
    assert.equal(foreignUpdate.data, null)

    const foreignDelete = await a.from('payments').delete().eq('id', paymentB!).select('id').maybeSingle()
    assert.equal(foreignDelete.error, null)
    assert.equal(foreignDelete.data, null)

    const bOwn = await b.from('businesses').select('id').eq('id', businessB!).maybeSingle()
    assert.equal(bOwn.error, null)
    assert.equal(bOwn.data?.id, businessB)
  },
})

Deno.test({
  name: 'ordinary users cannot read platform admin resources',
  ignore: !configured,
  async fn() {
    const a = client(tokenA!)
    const logs = await a.from('admin_logs').select('id').limit(1)
    assert.equal(logs.error, null)
    assert.deepEqual(logs.data, [])
  },
})
