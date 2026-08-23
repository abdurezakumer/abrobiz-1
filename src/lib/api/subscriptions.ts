import { supabase } from '../supabaseClient'
import type { Subscription } from '../../types'

function mapSubscription(row: any): Subscription {
  return {
    id: row.id,
    businessId: row.business_id,
    planId: row.plan_id,
    plan: row.plans
      ? {
          id: row.plans.id,
          slug: row.plans.slug,
          name: row.plans.name,
          priceEtb: Number(row.plans.price_etb),
          billingInterval: row.plans.billing_interval,
          features: row.plans.features ?? [],
          featureFlags: {
            bookings: !!row.plans.feature_flags?.bookings,
            ordering: !!row.plans.feature_flags?.ordering,
            reviews: !!row.plans.feature_flags?.reviews,
          },
          isTrial: row.plans.is_trial,
          trialDays: row.plans.trial_days ?? undefined,
          isActive: row.plans.is_active,
          sortOrder: row.plans.sort_order,
        }
      : undefined,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    autoRenew: row.auto_renew,
  }
}

export async function getSubscription(businessId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw error
  return data ? mapSubscription(data) : null
}

export function daysRemaining(endDate: string | null): number | null {
  if (!endDate) return null
  const end = new Date(endDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
