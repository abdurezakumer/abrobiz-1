import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Lock, Truck, Package } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { hasFeature } from '../lib/entitlements'
import { listOrders, updateOrderStatus } from '../lib/api/orders'
import type { Order, OrderStatus } from '../types'

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Confirm order',
  confirmed: 'Start preparing',
  preparing: 'Mark ready',
  ready: 'Mark completed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function Orders() {
  const { business, subscription } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const entitled = hasFeature(subscription, 'ordering')

  useEffect(() => {
    if (business && entitled) listOrders(business.id).then(o => { setOrders(o); setLoading(false) })
    else setLoading(false)
  }, [business, entitled])

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    await updateOrderStatus(order.id, next)
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: next } : o)))
  }

  async function cancel(order: Order) {
    await updateOrderStatus(order.id, 'cancelled')
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: 'cancelled' } : o)))
  }

  if (!business) return null

  if (!entitled) {
    return (
      <DashboardLayout>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Orders</h1>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', marginTop: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(212,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={19} color="#D4A853" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 6 }}>Online ordering is a Premium feature</div>
          <p style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.5)', marginBottom: 18, maxWidth: 340, margin: '0 auto 18px' }}>
            Let customers order straight from your menu for pickup or delivery. Upgrade to Premium to turn it on.
          </p>
          <Link to="/dashboard/billing" style={{ display: 'inline-block', background: '#D4A853', color: '#0A0C10', padding: '10px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            View plans
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const active = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
  const past = orders.filter(o => o.status === 'completed' || o.status === 'cancelled')

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Orders</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>Orders placed through your menu.</p>

      {loading ? (
        <div style={{ color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          No orders yet.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {active.map(o => <OrderCard key={o.id} order={o} onAdvance={advance} onCancel={cancel} currency={business.currency} />)}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,12,16,0.5)', marginBottom: 10 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.map(o => <OrderCard key={o.id} order={o} onAdvance={advance} onCancel={cancel} currency={business.currency} />)}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}

function OrderCard({ order, onAdvance, onCancel, currency }: { order: Order; onAdvance: (o: Order) => void; onCancel: (o: Order) => void; currency: string }) {
  const statusColor = {
    pending: '#B45309', confirmed: '#2563EB', preparing: '#7C3AED', ready: '#16A34A', completed: 'rgba(10,12,16,0.4)', cancelled: '#DC2626',
  }[order.status]
  const next = NEXT_STATUS[order.status]

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(10,12,16,0.06)', padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={15} color="#D4A853" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{order.customerName}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'rgba(10,12,16,0.45)' }}>
            {order.fulfillmentType === 'delivery' ? <Truck size={12} /> : <Package size={12} />} {order.fulfillmentType}
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>{order.status}</span>
      </div>
      <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.6)', marginTop: 6 }}>{order.phone}{order.address ? ` · ${order.address}` : ''}</div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {order.items.map(li => (
          <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'rgba(10,12,16,0.65)' }}>
            <span>{li.quantity}x {li.itemName}</span>
            <span>{li.priceEtb * li.quantity} {currency}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, borderTop: '1px solid rgba(10,12,16,0.06)', marginTop: 8, paddingTop: 8 }}>
        <span>Total</span><span>{order.totalEtb} {currency}</span>
      </div>
      {order.notes && <p style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)', marginTop: 6, fontStyle: 'italic' }}>"{order.notes}"</p>}

      {next && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onAdvance(order)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {STATUS_LABEL[order.status]}
          </button>
          {order.status !== 'ready' && (
            <button onClick={() => onCancel(order)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
