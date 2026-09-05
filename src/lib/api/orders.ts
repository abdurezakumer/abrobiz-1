import { supabase } from '../supabaseClient'
import type { Order, OrderStatus } from '../../types'
import { edgeFunctionError } from '../errors'

function mapOrder(row: any): Order {
  return {
    id: row.id,
    businessId: row.business_id,
    customerName: row.customer_name,
    phone: row.phone ?? '',
    fulfillmentType: row.fulfillment_type,
    address: row.address ?? '',
    notes: row.notes ?? '',
    status: row.status,
    totalEtb: Number(row.total_etb),
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((oi: any) => ({
      id: oi.id,
      itemId: oi.item_id,
      itemName: oi.item_name,
      priceEtb: Number(oi.price_etb),
      quantity: oi.quantity,
    })),
  }
}

export interface CartLine {
  itemId: string
  quantity: number
}

/** Public — server re-prices every line from the live catalog; entitlement + published status are checked inside the RPC. */
export async function submitOrder(input: {
  businessId: string
  customerName: string
  phone: string
  fulfillmentType: 'pickup' | 'delivery'
  address: string
  notes: string
  items: CartLine[]
  idempotencyKey?: string
  turnstileToken?: string | null
}): Promise<{ id: string; totalEtb: number }> {
  const { data, error } = await supabase.functions.invoke('submit-order', {
    headers: { 'Idempotency-Key': input.idempotencyKey ?? crypto.randomUUID() },
    body: input,
  })
  if (error) throw await edgeFunctionError(error)
  return { id: data.id, totalEtb: Number(data.total_etb) }
}

export async function listOrders(businessId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, business_id, customer_name, phone, fulfillment_type, address, notes, status, total_etb, created_at, order_items(id, item_id, item_name, price_etb, quantity)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapOrder)
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) throw error
}
