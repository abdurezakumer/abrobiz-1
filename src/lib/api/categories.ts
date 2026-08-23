import { supabase } from '../supabaseClient'
import type { Category } from '../../types'

function mapCategory(row: any): Category {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    icon: row.icon ?? '',
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
    translations: row.translations ?? {},
  }
}

export async function listCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

export async function createCategory(businessId: string, name: string): Promise<Category> {
  const { data: existing } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, name, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return mapCategory(data)
}

export async function updateCategory(id: string, patch: Partial<{ name: string; icon: string; isHidden: boolean; sortOrder: number }>): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.isHidden !== undefined && { is_hidden: patch.isHidden }),
      ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
