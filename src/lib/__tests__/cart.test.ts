import { describe, it, expect } from 'vitest'
import { cartCount, cartTotal, addToCart, changeCartQty, type CartState } from '../cart'
import type { Item } from '../../types'

function makeItem(id: string, price: number): Pick<Item, 'id' | 'price'> {
  return { id, price }
}

describe('cart math', () => {
  const items = [makeItem('a', 150), makeItem('b', 80), makeItem('c', 45.5)]

  it('starts empty', () => {
    expect(cartCount({})).toBe(0)
    expect(cartTotal({}, items)).toBe(0)
  })

  it('adds items one at a time', () => {
    let cart = addToCart({}, 'a')
    cart = addToCart(cart, 'a')
    cart = addToCart(cart, 'b')
    expect(cart).toEqual({ a: 2, b: 1 })
    expect(cartCount(cart)).toBe(3)
  })

  it('computes total by looking up each item price fresh — never trusts a stored/stale total', () => {
    const cart = { a: 2, b: 1 } // 2x150 + 1x80 = 380
    expect(cartTotal(cart, items)).toBe(380)
  })

  it('handles fractional prices correctly', () => {
    const cart = { c: 3 } // 3 x 45.5 = 136.5
    expect(cartTotal(cart, items)).toBeCloseTo(136.5)
  })

  it('ignores a cart line for an item that no longer exists in the catalog (e.g. deleted)', () => {
    const cart = { a: 1, 'deleted-item': 5 }
    expect(cartTotal(cart, items)).toBe(150)
  })

  it('increments and decrements quantity', () => {
    let cart: CartState = { a: 2 }
    cart = changeCartQty(cart, 'a', 1)
    expect(cart.a).toBe(3)
    cart = changeCartQty(cart, 'a', -1)
    expect(cart.a).toBe(2)
  })

  it('removes the line entirely once quantity drops to zero (does not leave a stray 0)', () => {
    let cart: CartState = { a: 1 }
    cart = changeCartQty(cart, 'a', -1)
    expect(cart).toEqual({})
    expect('a' in cart).toBe(false)
  })

  it('never goes negative', () => {
    const cart = changeCartQty({}, 'a', -1)
    expect(cart).toEqual({})
  })
})
