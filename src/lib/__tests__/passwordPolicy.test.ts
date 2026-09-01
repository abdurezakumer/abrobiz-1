import { describe, expect, it } from 'vitest'
import { passwordStrength, validatePassword } from '../passwordPolicy'

describe('Phase 1 password policy', () => {
  it('requires twelve characters and all required character classes', () => {
    expect(validatePassword('short')).toMatchObject({ valid: false })
    expect(validatePassword('longbutnoupper1!')).toMatchObject({ valid: false })
    expect(validatePassword('Longbutnodigit!')).toMatchObject({ valid: false })
    expect(validatePassword('LongPassword1!')).toMatchObject({ valid: true })
  })

  it('does not truncate passwords and rejects values over 128 characters', () => {
    expect(validatePassword('A'.repeat(128) + 'a1!')).toMatchObject({ valid: false })
  })

  it('reports the five user-facing strength levels', () => {
    expect(passwordStrength('')).toBe('Very weak')
    expect(passwordStrength('abcdef')).toBe('Very weak')
    expect(passwordStrength('abcdefghi1')).toBe('Weak')
    expect(passwordStrength('Abcdefghi1')).toBe('Fair')
    expect(passwordStrength('Abcdefghi1!')).toBe('Strong')
    expect(passwordStrength('VeryStrongPassword123!')).toBe('Very strong')
  })
})
