import assert from 'node:assert/strict'
import { corsHeaders, isAllowedOrigin, isAllowedTenantOrigin } from './cors.ts'

function headersFor(origin: string): Record<string, string> {
  return corsHeaders(new Request('https://qgbvuvxxfogcsvqzncdx.supabase.co/functions/v1/test', {
    headers: { Origin: origin },
  }))
}

Deno.test('CORS allows the AbroBiz root and www origins', () => {
  assert.equal(headersFor('https://abrobiz.com')['Access-Control-Allow-Origin'], 'https://abrobiz.com')
  assert.equal(headersFor('https://www.abrobiz.com')['Access-Control-Allow-Origin'], 'https://www.abrobiz.com')
})

Deno.test('CORS allows one-label HTTPS tenant origins', () => {
  assert.equal(isAllowedTenantOrigin('https://cafe.abrobiz.com'), true)
  assert.equal(headersFor('https://cafe.abrobiz.com')['Access-Control-Allow-Origin'], 'https://cafe.abrobiz.com')
})

Deno.test('CORS rejects external, malformed, HTTP, and nested origins', () => {
  for (const origin of [
    'https://evil.example',
    'http://evil.example',
    'not-an-origin',
    'http://cafe.abrobiz.com',
    'https://nested.cafe.abrobiz.com',
    'https://cafe.abrobiz.com/path',
    '*',
  ]) {
    assert.equal(isAllowedOrigin(origin, []), false, origin)
    assert.equal(headersFor(origin)['Access-Control-Allow-Origin'], undefined, origin)
  }
})
