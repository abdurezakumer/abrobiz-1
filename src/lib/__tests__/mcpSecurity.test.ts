import { describe, expect, it } from 'vitest'
import { hasMcpPermission, hasMcpScope, isAllowedMcpOrigin, isUuid, parseBearerToken, validateBusinessProfilePatch, withMcpTimeout } from '../../../api/_mcp'

describe('AbroBiz MCP security primitives', () => {
  it('accepts only the bounded AbroBiz bearer-token format', () => {
    expect(parseBearerToken('Bearer abz_mcp_' + 'a'.repeat(64))).toBe('abz_mcp_' + 'a'.repeat(64))
    expect(parseBearerToken('Basic abz_mcp_' + 'a'.repeat(64))).toBeNull()
    expect(parseBearerToken('Bearer not-an-abrobiz-token')).toBeNull()
    expect(parseBearerToken('Bearer abz_mcp_' + 'a'.repeat(63))).toBeNull()
  })

  it('keeps MCP write access separate from read access', () => {
    expect(hasMcpScope({ scopes: ['mcp:read'] }, 'mcp:read')).toBe(true)
    expect(hasMcpScope({ scopes: ['mcp:read'] }, 'mcp:drafts:write')).toBe(false)
    expect(hasMcpScope({ scopes: ['mcp:read', 'mcp:drafts:write'] }, 'mcp:drafts:write')).toBe(true)
  })

  it('maps existing roles to least-privilege permissions', () => {
    expect(hasMcpPermission({ role: 'super_admin', adminRole: 'super_admin' }, 'anything')).toBe(true)
    expect(hasMcpPermission({ role: 'admin', adminRole: 'marketing_admin' }, 'marketing.read')).toBe(true)
    expect(hasMcpPermission({ role: 'admin', adminRole: 'marketing_admin' }, 'payments.review')).toBe(false)
    expect(hasMcpPermission({ role: 'owner', adminRole: 'none' }, 'dashboard.read')).toBe(false)
  })

  it('validates UUIDs and rejects untrusted origins', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    const original = process.env.APP_ENV
    process.env.APP_ENV = 'production'
    expect(isAllowedMcpOrigin({ headers: { origin: 'https://abrobiz.com' } })).toBe(true)
    expect(isAllowedMcpOrigin({ headers: { origin: 'https://evil.example' } })).toBe(false)
    if (original === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = original
  })

  it('bounds slow MCP operations', async () => {
    await expect(withMcpTimeout(new Promise(resolve => setTimeout(resolve, 25)), 5)).rejects.toThrow('timed out')
  })

  it('allowlists safe profile fields and rejects unsafe URLs or markup', () => {
    expect(validateBusinessProfilePatch({ name: 'Cafe', maps_url: 'https://maps.google.com/example', social: { instagramUrl: 'https://instagram.com/cafe' } }).valid).toBe(true)
    expect(validateBusinessProfilePatch({ name: '<script>bad</script>' }).valid).toBe(false)
    expect(validateBusinessProfilePatch({ name: 'Cafe', maps_url: 'javascript:alert(1)' }).valid).toBe(false)
    expect(validateBusinessProfilePatch({ name: 'Cafe', social: { unknown: 'https://example.com' } }).valid).toBe(false)
  })
})
