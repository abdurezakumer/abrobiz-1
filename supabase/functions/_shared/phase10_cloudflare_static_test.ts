import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { tenantDnsProvisioning } from './cloudflareDns.ts'

Deno.test('Cloudflare tenant provisioning never creates per-tenant records', () => {
  assertEquals(tenantDnsProvisioning('sample-business'), {
    mode: 'wildcard',
    hostname: 'sample-business.abrobiz.com',
    recordCreated: false,
  })
})

Deno.test('Cloudflare tenant provisioning rejects reserved and malformed slugs', async () => {
  await assertRejects(() => Promise.resolve().then(() => tenantDnsProvisioning('admin')))
  await assertRejects(() => Promise.resolve().then(() => tenantDnsProvisioning('bad/host')))
  assert(true)
})
