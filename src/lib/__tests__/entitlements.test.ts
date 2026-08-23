import { describe, it, expect } from 'vitest'
import { hasFeature } from '../entitlements'
import type { Subscription } from '../../types'

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub1',
    businessId: 'biz1',
    planId: 'plan1',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    autoRenew: false,
    plan: {
      id: 'plan1',
      slug: 'premium',
      name: 'Premium',
      priceEtb: 1000,
      billingInterval: 'month',
      features: [],
      featureFlags: { bookings: true, ordering: true, reviews: true },
      isTrial: false,
      isActive: true,
      sortOrder: 3,
    },
    ...overrides,
  }
}

describe('hasFeature', () => {
  it('returns false when there is no subscription at all', () => {
    expect(hasFeature(null, 'bookings')).toBe(false)
  })

  it('returns true for an active premium subscription', () => {
    expect(hasFeature(makeSubscription(), 'bookings')).toBe(true)
    expect(hasFeature(makeSubscription(), 'ordering')).toBe(true)
    expect(hasFeature(makeSubscription(), 'reviews')).toBe(true)
  })

  it('returns false when the plan does not include the feature', () => {
    const sub = makeSubscription({
      plan: {
        id: 'plan2', slug: 'basic', name: 'Basic', priceEtb: 300, billingInterval: 'month',
        features: [], featureFlags: { bookings: false, ordering: false, reviews: false },
        isTrial: false, isActive: true, sortOrder: 1,
      },
    })
    expect(hasFeature(sub, 'bookings')).toBe(false)
  })

  it('returns false once the subscription has expired, even if the plan would include the feature', () => {
    const sub = makeSubscription({ status: 'expired' })
    expect(hasFeature(sub, 'bookings')).toBe(false)
  })

  it('returns false for a cancelled subscription', () => {
    const sub = makeSubscription({ status: 'cancelled' })
    expect(hasFeature(sub, 'ordering')).toBe(false)
  })

  it('returns true during an active trial (trials get full access)', () => {
    const sub = makeSubscription({ status: 'trial' })
    expect(hasFeature(sub, 'reviews')).toBe(true)
  })
})
