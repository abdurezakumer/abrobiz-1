import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Plus, Minus, X, CheckCircle2, Send } from 'lucide-react'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import { categoryIcon } from '../../lib/icons'
import { submitOrder, type CartLine } from '../../lib/api/orders'
import { cartCount, cartTotal, addToCart as addToCartFn, changeCartQty } from '../../lib/cart'
import type { Item, Language } from '../../types'
import { safeImageUrl } from '../../lib/safeUrl'
import { friendlyError } from '../../lib/errors'
import TurnstileWidget from '../../components/TurnstileWidget'
import { turnstileEnabled } from '../../lib/turnstile'

export default function StorefrontMenu() {
  return (
    <StorefrontPageShell
      pagePath="/menu"
      render={({ business, categories, items, labels, lang, theme, entitlements }) => {
        if (!business) return null
        const CategoryIcon = categoryIcon(undefined)
        return (
          <MenuSection
            business={business} categories={categories} items={items} labels={labels} lang={lang} theme={theme}
            CategoryIcon={CategoryIcon} orderingEnabled={entitlements.ordering}
          />
        )
      }}
    />
  )
}

export function MenuSection({ business, categories, items, labels, lang, theme, CategoryIcon, orderingEnabled }: any) {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [cartOpen, setCartOpen] = useState(false)

  const cartCountValue = cartCount(cart)
  const cartTotalValue = cartTotal(cart, items)

  function addToCart(itemId: string) {
    setCart(prev => addToCartFn(prev, itemId))
  }
  function changeQty(itemId: string, delta: number) {
    setCart(prev => changeCartQty(prev, itemId, delta))
  }

  return (
    <>
      {categories.length > 1 && (
        <div style={{ position: 'sticky', top: 53, zIndex: 10, background: theme.bg, borderBottom: `1px solid ${theme.border}`, padding: '10px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {categories.map((cat: any) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink: 0, fontSize: 13, padding: '7px 14px', borderRadius: 999, textDecoration: 'none', fontWeight: 500,
                background: activeCategory === cat.id ? business.accentColor : 'transparent',
                color: activeCategory === cat.id ? '#0A0C10' : theme.textDim,
                border: `1px solid ${activeCategory === cat.id ? business.accentColor : theme.border}`,
              }}
            >
              {cat.name}
            </a>
          ))}
        </div>
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 90px' }}>
        {categories.length === 0 && (
          <p style={{ textAlign: 'center', color: theme.textDim, padding: '40px 0' }}>No {labels.itemLabel.toLowerCase()}s published yet.</p>
        )}
        {categories.map((cat: any) => {
          const catItems = items.filter((i: Item) => i.categoryId === cat.id && i.isAvailable !== false)
          if (catItems.length === 0) return null
          return (
            <div id={`cat-${cat.id}`} key={cat.id} style={{ marginBottom: 36, scrollMarginTop: 100 }}>
              <h2 style={{ fontFamily: theme.headingFont ?? 'Outfit, sans-serif', fontSize: 19, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CategoryIcon size={17} color={business.accentColor} /> {cat.name}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {catItems.map((item: Item, i: number) => {
                  const tr = item.translations[lang as Language] ?? item.translations.en
                  const qty = cart[item.id] ?? 0
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                      style={{ display: 'flex', gap: 14, background: theme.card, borderRadius: 14, padding: 12, border: `1px solid ${theme.border}` }}
                    >
                      {safeImageUrl(item.imageUrl) && (
                        <img src={safeImageUrl(item.imageUrl) ?? undefined} alt={tr?.name} width={68} height={68} loading="lazy" decoding="async" style={{ width: 68, height: 68, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{tr?.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: business.accentColor, whiteSpace: 'nowrap' }}>{item.price} {business.currency}</span>
                        </div>
                        {tr?.description && <p style={{ fontSize: 12.5, color: theme.textDim, marginTop: 3, lineHeight: 1.5 }}>{tr.description}</p>}
                        {orderingEnabled && (
                          <div style={{ marginTop: 8 }}>
                            {qty === 0 ? (
                              <button
                                onClick={() => addToCart(item.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: `1px solid ${business.accentColor}`, color: business.accentColor, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                <Plus size={12} /> Add
                              </button>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: business.accentColor, borderRadius: 8, padding: '4px 8px' }}>
                                <button onClick={() => changeQty(item.id, -1)} style={qtyBtn}><Minus size={12} /></button>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0A0C10', minWidth: 14, textAlign: 'center' }}>{qty}</span>
                                <button onClick={() => changeQty(item.id, 1)} style={qtyBtn}><Plus size={12} /></button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {orderingEnabled && cartCountValue > 0 && (
        <motion.button
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
            display: 'flex', alignItems: 'center', gap: 10, background: business.accentColor, color: '#0A0C10',
            border: 'none', borderRadius: 999, padding: '13px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <ShoppingCart size={16} /> {cartCountValue} item{cartCountValue > 1 ? 's' : ''} · {cartTotalValue} {business.currency}
        </motion.button>
      )}

      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            business={business} theme={theme} items={items} cart={cart} cartTotal={cartTotalValue}
            onChangeQty={changeQty} onClose={() => setCartOpen(false)} onOrderComplete={() => setCart({})}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function CartDrawer({ business, theme, items, cart, cartTotal, onChangeQty, onClose, onOrderComplete }: any) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const lines: { item: Item; qty: number }[] = Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find((i: Item) => i.id === id), qty: qty as number }))
    .filter(l => l.item)

  const inputStyle: React.CSSProperties = {
    background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 13px',
    color: theme.text, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to place your order.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const cartLines: CartLine[] = lines.map(l => ({ itemId: l.item.id, quantity: l.qty }))
      await submitOrder({ businessId: business.id, customerName: name, phone, fulfillmentType: fulfillment, address, notes, items: cartLines, turnstileToken })
      onOrderComplete()
      setStep('done')
    } catch (err) {
      setError(friendlyError(err))
      setTurnstileToken(null)
      setTurnstileResetKey(value => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41, background: theme.card, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto', color: theme.text }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
            {step === 'cart' ? 'Your order' : step === 'checkout' ? 'Checkout' : 'Order placed'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {step === 'cart' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {lines.map(({ item, qty }) => {
                const tr = item.translations.en
                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tr?.name}</div>
                      <div style={{ fontSize: 12, color: theme.textDim }}>{item.price} {business.currency} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.bg, borderRadius: 8, padding: '4px 8px' }}>
                      <button onClick={() => onChangeQty(item.id, -1)} style={{ ...qtyBtn, background: 'none', color: theme.text }}><Minus size={12} /></button>
                      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 14, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => onChangeQty(item.id, 1)} style={{ ...qtyBtn, background: 'none', color: theme.text }}><Plus size={12} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginBottom: 16 }}>
              <span>Total</span><span>{cartTotal} {business.currency}</span>
            </div>
            <button onClick={() => setStep('checkout')} style={{ width: '100%', background: business.accentColor, color: '#0A0C10', border: 'none', borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Continue
            </button>
          </>
        )}

        {step === 'checkout' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
            <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setFulfillment('pickup')} style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: fulfillment === 'pickup' ? business.accentColor : theme.bg, color: fulfillment === 'pickup' ? '#0A0C10' : theme.text }}>Pickup</button>
              <button type="button" onClick={() => setFulfillment('delivery')} style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: fulfillment === 'delivery' ? business.accentColor : theme.bg, color: fulfillment === 'delivery' ? '#0A0C10' : theme.text }}>Delivery</button>
            </div>
            {fulfillment === 'delivery' && (
              <input required value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" style={inputStyle} />
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 13, color: theme.textDim, textAlign: 'center' }}>Pay on {fulfillment} · Total: {cartTotal} {business.currency}</div>
            <TurnstileWidget action="order" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
            {error && <div style={{ color: '#F87171', fontSize: 12.5 }}>{error}</div>}
            <button type="submit" disabled={submitting || (turnstileEnabled && !turnstileToken)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: business.accentColor, color: '#0A0C10', border: 'none', borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <Send size={14} /> {submitting ? 'Placing order…' : 'Place order'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={34} color={business.accentColor} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Order placed!</div>
            <p style={{ fontSize: 13, color: theme.textDim, marginBottom: 18 }}>{business.name} will confirm it shortly.</p>
            <button onClick={onClose} style={{ background: business.accentColor, color: '#0A0C10', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        )}
      </motion.div>
    </>
  )
}

const qtyBtn: React.CSSProperties = { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'rgba(10,12,16,0.15)', color: '#0A0C10', borderRadius: 5, cursor: 'pointer' }
