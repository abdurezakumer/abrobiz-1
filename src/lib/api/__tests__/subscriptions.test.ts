import { describe, it, expect, vi, afterEach } from 'vitest'
import { daysRemaining } from '../subscriptions'

describe('daysRemaining', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when there is no end date', () => {
    expect(daysRemaining(null)).toBeNull()
  })

  it('returns 0 on the exact end date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T14:00:00'))
    expect(daysRemaining('2026-08-15')).toBe(0)
  })

  it('counts whole days remaining, ignoring time-of-day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T23:59:00'))
    expect(daysRemaining('2026-08-15')).toBe(5)
  })

  it('returns a negative number once the date has passed (used to flag as expired)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T09:00:00'))
    expect(daysRemaining('2026-08-15')).toBe(-5)
  })
})
