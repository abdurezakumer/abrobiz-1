import { supabase } from '../supabaseClient'
import type { Plan } from '../../types'

function mapPlan(row: any): Plan {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceEtb: Number(row.price_etb),
    billingInterval: row.billing_interval,
    features: row.features ?? [],
    featureFlags: {
      bookings: !!row.feature_flags?.bookings,
      ordering: !!row.feature_flags?.ordering,
      reviews: !!row.feature_flags?.reviews,
    },
    isTrial: row.is_trial,
    trialDays: row.trial_days ?? undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function listPlans(activeOnly = true): Promise<Plan[]> {
  let query = supabase.from('plans').select('*').order('sort_order', { ascending: true }).limit(100)
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapPlan).filter(p => !p.isTrial)
}

export async function adminListAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('*').order('sort_order', { ascending: true }).limit(100)
  if (error) throw error
  return (data ?? []).map(mapPlan)
}

export async function createPlan(input: {
  slug: string
  name: string
  priceEtb: number
  billingInterval: 'month' | 'year'
  features: string[]
  featureFlags?: Partial<Plan['featureFlags']>
}): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert({
      slug: input.slug,
      name: input.name,
      price_etb: input.priceEtb,
      billing_interval: input.billingInterval,
      features: input.features,
      feature_flags: input.featureFlags ?? {},
    })
    .select()
    .single()
  if (error) throw error
  return mapPlan(data)
}

export async function updatePlan(id: string, patch: Partial<{
  name: string
  priceEtb: number
  features: string[]
  featureFlags: Plan['featureFlags']
  isActive: boolean
}>): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.priceEtb !== undefined && { price_etb: patch.priceEtb }),
      ...(patch.features !== undefined && { features: patch.features }),
      ...(patch.featureFlags !== undefined && { feature_flags: patch.featureFlags }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    })
    .eq('id', id)
  if (error) throw error
}
