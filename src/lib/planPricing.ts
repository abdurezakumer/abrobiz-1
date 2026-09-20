import type { BillingInterval, Plan } from '../types'

export interface PlanPriceView {
  interval: BillingInterval
  basePriceEtb: number
  originalPriceEtb: number
  priceEtb: number
  hasDiscount: boolean
  discountLabel: string
  savingsEtb: number
  annualSavingsEtb: number
}

function money(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0
}

function activeDiscount(plan: Plan, now: Date): boolean {
  if (plan.discountType === 'none' || money(plan.discountValue) <= 0) return false
  const starts = plan.discountStartsAt ? new Date(plan.discountStartsAt).getTime() : -Infinity
  const ends = plan.discountEndsAt ? new Date(plan.discountEndsAt).getTime() : Infinity
  return now.getTime() >= starts && now.getTime() <= ends
}

export function getPlanPrice(plan: Plan, interval: BillingInterval, now = new Date()): PlanPriceView {
  const monthly = money(plan.monthlyPriceEtb ?? (plan.billingInterval === 'month' ? plan.priceEtb : plan.priceEtb / 12))
  const annual = money(plan.annualPriceEtb ?? (plan.billingInterval === 'year' ? plan.priceEtb : monthly * 12))
  const annualSavingsEtb = Math.max(0, Math.round((monthly * 12 - annual) * 100) / 100)
  const basePriceEtb = interval === 'month' ? monthly : annual
  const annualOriginal = interval === 'year' && annualSavingsEtb > 0 ? monthly * 12 : annual
  const originalPriceEtb = interval === 'year' ? annualOriginal : basePriceEtb
  let priceEtb = basePriceEtb
  let savingsEtb = Math.max(0, originalPriceEtb - basePriceEtb)

  if (activeDiscount(plan, now)) {
    const value = money(plan.discountValue)
    const discount = plan.discountType === 'percent' ? basePriceEtb * Math.min(value, 100) / 100 : Math.min(value, basePriceEtb)
    priceEtb = Math.max(0, Math.round((basePriceEtb - discount) * 100) / 100)
    savingsEtb = Math.max(0, Math.round((originalPriceEtb - priceEtb) * 100) / 100)
  }

  return {
    interval,
    basePriceEtb,
    originalPriceEtb: Math.round(originalPriceEtb * 100) / 100,
    priceEtb,
    hasDiscount: priceEtb < originalPriceEtb,
    discountLabel: plan.discountLabel?.trim() || (plan.discountType === 'percent' ? `${money(plan.discountValue)}% off` : 'Limited-time offer'),
    savingsEtb,
    annualSavingsEtb,
  }
}

export function formatEtb(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}
