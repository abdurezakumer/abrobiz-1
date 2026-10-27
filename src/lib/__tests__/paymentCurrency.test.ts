import { describe, expect, it } from 'vitest'
import { toPaymentCurrency } from '../paymentCurrency'

describe('toPaymentCurrency', () => {
  it.each([
    ['ETB', 'ETB'],
    ['eur', 'EUR'],
    [' USD ', 'USD'],
    ['unsupported', 'ETB'],
    [null, 'ETB'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(toPaymentCurrency(input)).toBe(expected)
  })
})
