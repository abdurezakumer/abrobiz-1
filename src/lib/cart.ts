import type { Item } from '../types'

export type CartState = Record<string, number>

export function cartCount(cart: CartState): number {
  return Object.values(cart).reduce((a, b) => a + b, 0)
}

export function cartTotal(cart: CartState, items: Pick<Item, 'id' | 'price'>[]): number {
  return Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = items.find(i => i.id === itemId)
    return sum + (item ? item.price * qty : 0)
  }, 0)
}

export function addToCart(cart: CartState, itemId: string): CartState {
  return { ...cart, [itemId]: (cart[itemId] ?? 0) + 1 }
}

export function changeCartQty(cart: CartState, itemId: string, delta: number): CartState {
  const next = (cart[itemId] ?? 0) + delta
  if (next <= 0) {
    const { [itemId]: _drop, ...rest } = cart
    return rest
  }
  return { ...cart, [itemId]: next }
}
