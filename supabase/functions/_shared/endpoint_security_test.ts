import assert from 'node:assert/strict'
import { checkBearerSecret, checkSecret } from './endpointSecurity.ts'

Deno.test('secret checks fail closed when expected secret is missing', () => {
  assert.equal(checkSecret('anything', undefined), 'missing')
  assert.equal(checkBearerSecret('Bearer anything', undefined), 'missing')
})

Deno.test('secret checks distinguish invalid and valid credentials', () => {
  assert.equal(checkSecret('wrong', 'expected'), 'invalid')
  assert.equal(checkSecret('expected', 'expected'), 'ok')
  assert.equal(checkBearerSecret('Bearer expected', 'expected'), 'ok')
  assert.equal(checkBearerSecret('Basic expected', 'expected'), 'invalid')
  assert.equal(checkBearerSecret('expected', 'expected'), 'invalid')
  assert.equal(checkBearerSecret('Bearer expected extra', 'expected'), 'invalid')
})
