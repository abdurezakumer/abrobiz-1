import type { PaymentCurrency } from '../types'

export type { PaymentCurrency } from '../types'

export const PAYMENT_CURRENCIES = ['ETB', 'EUR', 'USD'] as const

export function toPaymentCurrency(value: unknown): PaymentCurrency {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return PAYMENT_CURRENCIES.includes(normalized as PaymentCurrency)
    ? normalized as PaymentCurrency
    : 'ETB'
}
