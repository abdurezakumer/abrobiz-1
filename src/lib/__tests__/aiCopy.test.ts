import { describe, expect, it } from 'vitest'
import { isSafeGeneratedCopy } from '../aiCopy'

describe('AI website copy validation', () => {
  const sourceIds = new Set(['service-1'])

  it('accepts bounded copy tied to existing catalog IDs', () => {
    expect(isSafeGeneratedCopy({
      hero: { headline: 'A better everyday experience', subheadline: 'Thoughtful service for your next visit.', primaryCta: 'Explore services' },
      about: { title: 'Our approach', description: 'A concise description grounded in the business profile.' },
      services: [{ sourceId: 'service-1', title: 'Signature service', shortDescription: 'A clear description of the existing service.' }],
      seo: { title: 'AbroBiz business', description: 'A concise search description.' },
    }, sourceIds)).toBe(true)
  })

  it('rejects unknown keys, markup, and foreign catalog IDs', () => {
    expect(isSafeGeneratedCopy({ hero: { headline: 'Safe', subheadline: 'Copy', unexpected: 'no' } }, sourceIds)).toBe(false)
    expect(isSafeGeneratedCopy({ hero: { headline: '<script>bad</script>', subheadline: 'Copy' } }, sourceIds)).toBe(false)
    expect(isSafeGeneratedCopy({ services: [{ sourceId: 'other-business-item', title: 'Invented', shortDescription: 'Not from the source.' }] }, sourceIds)).toBe(false)
  })

  it('rejects oversized or empty required fields', () => {
    expect(isSafeGeneratedCopy({ hero: { headline: '', subheadline: 'Copy' } }, sourceIds)).toBe(false)
    expect(isSafeGeneratedCopy({ hero: { headline: 'x'.repeat(121), subheadline: 'Copy' } }, sourceIds)).toBe(false)
    expect(isSafeGeneratedCopy({ about: { title: 'About', description: 'x'.repeat(1201) } }, sourceIds)).toBe(false)
  })
})
