import { supabase } from '../supabaseClient'
import type { Item, ItemTranslations } from '../../types'
import { edgeFunctionError } from '../errors'
import { prepareImageForUpload } from '../fileUpload'

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
    .select('id, business_id, category_id, image_url, price, is_available, is_featured, sort_order, translations, created_at')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .limit(500)
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
  const uploadFile = await prepareImageForUpload(file, 5 * 1024 * 1024)
  const { data, error } = await supabase.functions.invoke('storage-upload', {
    body: uploadFile,
    headers: { 'X-Upload-Bucket': 'item-images', 'X-Business-Id': businessId, 'Content-Type': uploadFile.type },
  })
  if (error) throw await edgeFunctionError(error)
  if (!data?.path) throw new Error('Upload did not return a file path.')
  const { data: publicData } = supabase.storage.from('item-images').getPublicUrl(data.path)
  return publicData.publicUrl
}
