import { supabase } from '../supabaseClient'
import type { BusinessCategory } from '../../types'

function mapCategory(row: any): BusinessCategory {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    itemLabel: row.item_label,
    categoryLabel: row.category_label,
    icon: row.icon,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

export async function listBusinessCategories(): Promise<BusinessCategory[]> {
  const { data, error } = await supabase
    .from('business_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

export async function createBusinessCategory(input: {
  slug: string
  label: string
  itemLabel: string
  categoryLabel: string
  icon: string
}): Promise<BusinessCategory> {
  const { data, error } = await supabase
    .from('business_categories')
    .insert({
      slug: input.slug,
      label: input.label,
      item_label: input.itemLabel,
      category_label: input.categoryLabel,
      icon: input.icon,
    })
    .select()
    .single()
  if (error) throw error
  return mapCategory(data)
}

export async function updateBusinessCategory(id: string, patch: Partial<{
  label: string
  itemLabel: string
  categoryLabel: string
  icon: string
  isActive: boolean
  sortOrder: number
}>): Promise<void> {
  const { error } = await supabase
    .from('business_categories')
    .update({
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.itemLabel !== undefined && { item_label: patch.itemLabel }),
      ...(patch.categoryLabel !== undefined && { category_label: patch.categoryLabel }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
    })
    .eq('id', id)
  if (error) throw error
}
