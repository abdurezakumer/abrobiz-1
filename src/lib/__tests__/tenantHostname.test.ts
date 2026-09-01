import { describe, expect, it } from 'vitest'
import { normalizeHostname, resolveTenantHostname, resolveTenantRequest, tenantHostname } from '../tenantHostname'

describe('tenant hostname security', () => {
  it('accepts one validated tenant label and strips a safe port/trailing dot', () => {
    expect(resolveTenantHostname('Restaurant-1.ABROBIZ.COM:443.')).toEqual({ kind: 'tenant', hostname: 'restaurant-1.abrobiz.com', slug: 'restaurant-1' })
  })

  it('keeps root and www outside tenant resolution', () => {
    expect(resolveTenantHostname('abrobiz.com')).toMatchObject({ kind: 'root' })
    expect(resolveTenantHostname('www.abrobiz.com')).toMatchObject({ kind: 'root' })
  })

  it('rejects reserved, nested, malformed, and untrusted hosts', () => {
    expect(resolveTenantHostname('admin.abrobiz.com').kind).toBe('invalid')
    expect(resolveTenantHostname('a.b.abrobiz.com').kind).toBe('invalid')
    expect(resolveTenantHostname('https://evil.example/').kind).toBe('invalid')
    expect(resolveTenantHostname('tenant.abrobiz.com.evil.example').kind).toBe('invalid')
    expect(resolveTenantHostname('tenant.abrobiz.com:99999').kind).toBe('invalid')
  })

  it('supports the explicit localhost development form but rejects invalid slugs', () => {
    const local = resolveTenantHostname('cafe.localhost:5173')
    expect(local.kind).toBe('tenant')
    if (local.kind === 'tenant') expect(local.slug).toBe('cafe')
    expect(resolveTenantHostname('x.localhost').kind).toBe('invalid')
    expect(resolveTenantHostname('cafe.localhost/path').kind).toBe('invalid')
  })

  it('generates only validated platform hostnames', () => {
    expect(tenantHostname('my-cafe')).toBe('my-cafe.abrobiz.com')
    expect(tenantHostname('admin')).toBeNull()
    expect(normalizeHostname('my-cafe.abrobiz.com:443')).toBe('my-cafe.abrobiz.com')
  })

  it('requires HTTPS for production hosts but allows local HTTP development', () => {
    expect(resolveTenantRequest('cafe.abrobiz.com', 'http:').kind).toBe('invalid')
    expect(resolveTenantRequest('cafe.abrobiz.com', 'https:').kind).toBe('tenant')
    expect(resolveTenantRequest('cafe.localhost:5173', 'http:').kind).toBe('tenant')
  })
})
