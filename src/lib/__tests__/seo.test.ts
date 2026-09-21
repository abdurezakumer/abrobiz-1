import { describe, expect, it } from 'vitest'
import { buildTenantSeo, canonicalTenantUrl, generatedTenantDescription, generatedTenantTitle, isTenantIndexable, platformSeoForPath } from '../seo'
import type { Business } from '../../types'

const business = (overrides: Partial<Business> = {}): Business => ({
  id: 'business-a', ownerId: 'owner-a', categoryId: 'category-a', name: 'Luna Café', slug: 'luna-cafe', description: 'A neighborhood café serving coffee and breakfast.', aboutContent: '', galleryUrls: [], phone: '+251900000000', email: 'hello@example.com', address: 'Bole, Addis Ababa', mapsUrl: '', templateSlug: 'modern-cafe', languages: ['en'], accentColor: '#D4A853', openingHours: { mon: { open: '08:00', close: '18:00', closed: false }, tue: { open: '08:00', close: '18:00', closed: false }, wed: { open: '08:00', close: '18:00', closed: false }, thu: { open: '08:00', close: '18:00', closed: false }, fri: { open: '08:00', close: '18:00', closed: false }, sat: { open: '09:00', close: '16:00', closed: false }, sun: { open: '09:00', close: '14:00', closed: true } }, social: {}, currency: 'ETB', timezone: 'Africa/Addis_Ababa', isPublished: true, isBlocked: false, seoIndexingEnabled: true, createdAt: '2026-01-01T00:00:00Z', ...overrides,
})

describe('tenant SEO', () => {
  it('generates deterministic title, description, canonical and schema from public facts', () => {
    const result = buildTenantSeo(business(), { categorySlug: 'cafe', categoryLabel: 'Café', canonicalUrl: canonicalTenantUrl('luna-cafe') }, true)
    expect(result.title).toBe('Luna Café | Café')
    expect(result.description).toContain('neighborhood café')
    expect(result.canonicalUrl).toBe('https://luna-cafe.abrobiz.com/')
    expect(result.robots).toBe('index,follow')
    expect(result.schema['@type']).toBe('CafeOrCoffeeShop')
    expect(result.schema).not.toHaveProperty('aggregateRating')
  })

  it('never makes an unpublished, blocked, inactive, or opted-out business indexable', () => {
    expect(isTenantIndexable(business(), true)).toBe(true)
    expect(isTenantIndexable(business({ isPublished: false }), true)).toBe(false)
    expect(isTenantIndexable(business({ isBlocked: true }), true)).toBe(false)
    expect(isTenantIndexable(business(), false)).toBe(false)
    expect(isTenantIndexable(business({ seoIndexingEnabled: false }), true)).toBe(false)
  })

  it('preserves custom fields while automatic fields remain factual and bounded', () => {
    expect(generatedTenantTitle(business({ seoTitle: 'The best café in the world with an excessively long title that needs trimming' }), 'Café').length).toBeLessThanOrEqual(60)
    expect(generatedTenantDescription(business({ seoDescription: 'Owner-approved description' }), 'Café')).toBe('Owner-approved description')
    expect(generatedTenantDescription(business({ description: '', aboutContent: '' }), 'Café')).toContain('Luna Café')
  })

  it('keeps platform private routes out of search metadata', () => {
    expect(platformSeoForPath('/').robots).toBe('index,follow')
    expect(platformSeoForPath('/about').canonicalUrl).toBe('https://abrobiz.com/about')
    expect(platformSeoForPath('/dashboard').robots).toBe('noindex,nofollow')
  })
})
