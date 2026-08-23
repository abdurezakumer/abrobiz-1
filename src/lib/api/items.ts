import { supabase } from '../supabaseClient'
import type { Item, ItemTranslations } from '../../types'

function mapItem(row: any): Item {
  return {
    id: row.id,
    businessId: row.business_id,
    categoryId: row.category_id,
    imageUrl: row.image_url ?? undefined,
    price: Number(row.price),
    isAvailable: row.is_available,
    isFeatured: row.is_featured ?? false,
    sortOrder: row.sort_order,
    translations: row.translations ?? {},
  }
}

export async function listItems(businessId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapItem)
}

export async function createItem(input: {
  businessId: string
  categoryId: string
  price: number
  translations: ItemTranslations
}): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      business_id: input.businessId,
      category_id: input.categoryId,
      price: input.price,
      translations: input.translations,
    })
    .select()
    .single()
  if (error) throw error
  return mapItem(data)
}

export async function updateItem(id: string, patch: Partial<{
  categoryId: string
  price: number
  isAvailable: boolean
  isFeatured: boolean
  imageUrl: string
  translations: ItemTranslations
  sortOrder: number
}>): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({
      ...(patch.categoryId !== undefined && { category_id: patch.categoryId }),
      ...(patch.price !== undefined && { price: patch.price }),
      ...(patch.isAvailable !== undefined && { is_available: patch.isAvailable }),
      ...(patch.isFeatured !== undefined && { is_featured: patch.isFeatured }),
      ...(patch.imageUrl !== undefined && { image_url: patch.imageUrl }),
      ...(patch.translations !== undefined && { translations: patch.translations }),
      ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function uploadItemImage(businessId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${businessId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('item-images').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('item-images').getPublicUrl(path)
  return data.publicUrl
}
