import { describe, expect, it } from 'vitest'
import { getPlanPrice } from './planPricing'
import type { Plan } from '../types'

const plan: Plan = {
  id: 'plan-1', slug: 'business', name: 'Business', priceEtb: 1000, billingInterval: 'month',
  monthlyPriceEtb: 1000, annualPriceEtb: 10800, features: [], featureFlags: { bookings: false, ordering: false, reviews: false },
  isTrial: false, isActive: true, sortOrder: 1,
}

describe('plan pricing', () => {
  it('uses database annual pricing and reports annual savings', () => {
    const result = getPlanPrice(plan, 'year')
    expect(result.priceEtb).toBe(10800)
    expect(result.originalPriceEtb).toBe(12000)
    expect(result.annualSavingsEtb).toBe(1200)
    expect(result.hasDiscount).toBe(true)
  })

  it('applies an active percentage event discount to either cycle', () => {
    const result = getPlanPrice({ ...plan, discountType: 'percent', discountValue: 10, discountLabel: 'Launch offer' }, 'month', new Date('2026-09-20T12:00:00Z'))
    expect(result.priceEtb).toBe(900)
    expect(result.originalPriceEtb).toBe(1000)
    expect(result.discountLabel).toBe('Launch offer')
  })

  it('does not apply an expired event discount', () => {
    const result = getPlanPrice({ ...plan, discountType: 'fixed', discountValue: 250, discountEndsAt: '2026-09-19T23:59:59Z' }, 'month', new Date('2026-09-20T12:00:00Z'))
    expect(result.priceEtb).toBe(1000)
    expect(result.hasDiscount).toBe(false)
  })
})
