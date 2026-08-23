import { supabase } from '../supabaseClient'
import type { Order, OrderStatus } from '../../types'

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
}): Promise<{ id: string; totalEtb: number }> {
  const { data, error } = await supabase.rpc('submit_order', {
    p_business_id: input.businessId,
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_fulfillment_type: input.fulfillmentType,
    p_address: input.address,
    p_notes: input.notes,
    p_items: input.items.map(i => ({ item_id: i.itemId, quantity: i.quantity })),
  })
  if (error) throw error
  return { id: data.id, totalEtb: Number(data.total_etb) }
}

export async function listOrders(businessId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapOrder)
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) throw error
}
