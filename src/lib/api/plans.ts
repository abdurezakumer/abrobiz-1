import { supabase } from '../supabaseClient'
import type { Plan } from '../../types'

export function mapPlan(row: any): Plan {
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
      aiCopy: !!row.feature_flags?.aiCopy,
    },
    isTrial: row.is_trial,
    trialDays: row.trial_days ?? undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    monthlyPriceEtb: row.monthly_price_etb == null ? undefined : Number(row.monthly_price_etb),
    annualPriceEtb: row.annual_price_etb == null ? undefined : Number(row.annual_price_etb),
    discountType: row.discount_type ?? 'none',
    discountValue: row.discount_value == null ? 0 : Number(row.discount_value),
    discountLabel: row.discount_label ?? '',
    discountStartsAt: row.discount_starts_at ?? null,
    discountEndsAt: row.discount_ends_at ?? null,
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
  monthlyPriceEtb?: number
  annualPriceEtb?: number
  discountType?: NonNullable<Plan['discountType']>
  discountValue?: number
  discountLabel?: string
  discountStartsAt?: string | null
  discountEndsAt?: string | null
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
      monthly_price_etb: input.monthlyPriceEtb ?? input.priceEtb,
      annual_price_etb: input.annualPriceEtb ?? input.priceEtb * 12,
      discount_type: input.discountType ?? 'none',
      discount_value: input.discountValue ?? 0,
      discount_label: input.discountLabel ?? '',
      discount_starts_at: input.discountStartsAt ?? null,
      discount_ends_at: input.discountEndsAt ?? null,
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
  monthlyPriceEtb: number
  annualPriceEtb: number
  discountType: NonNullable<Plan['discountType']>
  discountValue: number
  discountLabel: string
  discountStartsAt: string | null
  discountEndsAt: string | null
}>): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.priceEtb !== undefined && { price_etb: patch.priceEtb }),
      ...(patch.features !== undefined && { features: patch.features }),
      ...(patch.featureFlags !== undefined && { feature_flags: patch.featureFlags }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      ...(patch.monthlyPriceEtb !== undefined && { monthly_price_etb: patch.monthlyPriceEtb, price_etb: patch.monthlyPriceEtb }),
      ...(patch.annualPriceEtb !== undefined && { annual_price_etb: patch.annualPriceEtb }),
      ...(patch.discountType !== undefined && { discount_type: patch.discountType }),
      ...(patch.discountValue !== undefined && { discount_value: patch.discountValue }),
      ...(patch.discountLabel !== undefined && { discount_label: patch.discountLabel }),
      ...(patch.discountStartsAt !== undefined && { discount_starts_at: patch.discountStartsAt }),
      ...(patch.discountEndsAt !== undefined && { discount_ends_at: patch.discountEndsAt }),
    })
    .eq('id', id)
  if (error) throw error
}
