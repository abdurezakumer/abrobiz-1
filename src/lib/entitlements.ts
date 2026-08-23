import type { Subscription, PlanFeatureFlags } from '../types'

export function hasFeature(subscription: Subscription | null, flag: keyof PlanFeatureFlags): boolean {
  if (!subscription) return false
  if (subscription.status !== 'trial' && subscription.status !== 'active') return false
  return !!subscription.plan?.featureFlags?.[flag]
}
