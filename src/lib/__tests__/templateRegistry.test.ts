import { describe, expect, it } from 'vitest'
import { BUILTIN_TEMPLATES, templateCategory, templateComposition, templateDefinition } from '../templateRegistry'

describe('template registry', () => {
  it('keeps every built-in template uniquely addressable', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(10)
    expect(new Set(BUILTIN_TEMPLATES.map(template => template.slug)).size).toBe(BUILTIN_TEMPLATES.length)
  })

  it('provides category and composition metadata for specialized designs', () => {
    const hotel = BUILTIN_TEMPLATES.find(template => template.slug === 'boutique-hotel')
    expect(hotel && templateCategory(hotel)).toBe('Hospitality')
    expect(templateComposition('boutique-hotel')).toBe('hospitality')
    expect(templateDefinition('salon-atelier')?.supportedBusinessTypes).toContain('salon')
  })
})
