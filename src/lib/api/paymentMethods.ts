import { supabase } from '../supabaseClient'
import type { PaymentCurrency, PaymentMethod } from '../../types'
import { toPaymentCurrency } from '../paymentCurrency'

function mapMethod(row: any): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    currency: toPaymentCurrency(row.currency),
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function listPaymentMethods(activeOnly = true, currency?: PaymentCurrency): Promise<PaymentMethod[]> {
  let query = supabase.from('payment_methods').select('*').order('sort_order', { ascending: true }).limit(100)
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  const methods = (data ?? []).map(mapMethod)
  return currency ? methods.filter(method => method.currency === currency) : methods
}

export async function createPaymentMethod(input: {
  name: string
  currency: PaymentCurrency
  accountName: string
  accountNumber: string
  instructions: string
}): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      name: input.name,
      currency: input.currency,
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
  currency: PaymentCurrency
  accountName: string
  accountNumber: string
  instructions: string
  isActive: boolean
}>): Promise<void> {
  const { error } = await supabase
    .from('payment_methods')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.accountName !== undefined && { account_name: patch.accountName }),
      ...(patch.accountNumber !== undefined && { account_number: patch.accountNumber }),
      ...(patch.instructions !== undefined && { instructions: patch.instructions }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    })
    .eq('id', id)
  if (error) throw error
}
