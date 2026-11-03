import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSignupFormDraft,
  clearSignupVerificationDraft,
  loadSignupFormDraft,
  loadSignupVerificationDraft,
  saveSignupFormDraft,
  saveSignupVerificationDraft,
} from '../authFormDraft'

describe('short-lived authentication form recovery', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useRealTimers()
  })

  it('restores signup details without persisting a password', () => {
    saveSignupFormDraft({ name: 'Aster', phone: '0911000000', referralCode: 'SA123', email: 'aster@example.com', legalAccepted: true })

    expect(loadSignupFormDraft()).toEqual({ name: 'Aster', phone: '0911000000', referralCode: 'SA123', email: 'aster@example.com', legalAccepted: true })
    expect(sessionStorage.getItem('abrobiz:signup-form-draft:v1')).not.toContain('password')
    clearSignupFormDraft()
    expect(loadSignupFormDraft()).toBeNull()
  })

  it('restores an OTP only for its email and only for a short session window', () => {
    const now = Date.now()
    saveSignupVerificationDraft({ email: 'aster@example.com', code: '012345', cooldownUntil: now + 20_000 })

    expect(loadSignupVerificationDraft('ASTER@example.com')?.code).toBe('012345')
    expect(loadSignupVerificationDraft('different@example.com')).toBeNull()

    vi.useFakeTimers()
    vi.setSystemTime(now + 16 * 60 * 1000)
    expect(loadSignupVerificationDraft('aster@example.com')).toBeNull()
    clearSignupVerificationDraft()
    expect(sessionStorage.getItem('abrobiz:signup-verification-draft:v1')).toBeNull()
  })
})
