import { supabase } from '../supabaseClient'
import type { PaymentMethod } from '../../types'

function mapMethod(row: any): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function listPaymentMethods(activeOnly = true): Promise<PaymentMethod[]> {
  let query = supabase.from('payment_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapMethod)
}

export async function createPaymentMethod(input: {
  name: string
  accountName: string
  accountNumber: string
  instructions: string
}): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      name: input.name,
      account_name: input.accountName,
      account_number: input.accountNumber,
      instructions: input.instructions,
    })
    .select()
    .single()
  if (error) throw error
  return mapMethod(data)
}

export async function updatePaymentMethod(id: string, patch: Partial<{
  name: string
  accountName: string
  accountNumber: string
  instructions: string
  isActive: boolean
}>): Promise<void> {
  const { error } = await supabase
    .from('payment_methods')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.accountName !== undefined && { account_name: patch.accountName }),
      ...(patch.accountNumber !== undefined && { account_number: patch.accountNumber }),
      ...(patch.instructions !== undefined && { instructions: patch.instructions }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    })
    .eq('id', id)
  if (error) throw error
}
