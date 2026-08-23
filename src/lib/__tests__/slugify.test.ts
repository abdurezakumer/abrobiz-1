import { describe, it, expect } from 'vitest'
import { slugify } from '../slugify'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Habesha Kitchen')).toBe('habesha-kitchen')
  })

  it('strips punctuation', () => {
    expect(slugify("Mario's Pizza & Grill!")).toBe('marios-pizza-grill')
  })

  it('collapses repeated whitespace and hyphens', () => {
    expect(slugify('Too    Many   Spaces')).toBe('too-many-spaces')
    expect(slugify('already--hyphenated---name')).toBe('already-hyphenated-name')
  })

  it('trims leading/trailing whitespace before slugging', () => {
    expect(slugify('  Padded Name  ')).toBe('padded-name')
  })

  it('handles empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('preserves existing numbers', () => {
    expect(slugify('Cafe 24/7')).toBe('cafe-247')
  })
})
