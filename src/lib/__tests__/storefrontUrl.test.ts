import { describe, expect, it } from 'vitest'
import { businessSlugFromHostname, storefrontPath } from '../storefrontUrl'

describe('storefront subdomain routing', () => {
  it('extracts a business slug from an abrobiz.com subdomain', () => {
    expect(businessSlugFromHostname('habesha-kitchen.abrobiz.com')).toBe('habesha-kitchen')
    expect(businessSlugFromHostname('www.habesha-kitchen.abrobiz.com')).toBe('habesha-kitchen')
  })

  it('ignores reserved platform subdomains', () => {
    expect(businessSlugFromHostname('www.abrobiz.com')).toBeNull()
    expect(businessSlugFromHostname('admin.abrobiz.com')).toBeNull()
  })

  it('supports local wildcard-style development hosts', () => {
    expect(businessSlugFromHostname('test-business.localhost')).toBe('test-business')
    expect(businessSlugFromHostname('www.test-business.localhost')).toBe('test-business')
  })

  it('uses clean paths on subdomains and fallback paths on the main site', () => {
    expect(storefrontPath('habesha-kitchen', 'menu', 'habesha-kitchen.abrobiz.com')).toBe('/menu')
    expect(storefrontPath('habesha-kitchen', 'menu', 'abrobiz.com')).toBe('/r/habesha-kitchen/menu')
  })
})
