import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Check, X, Lock } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { hasFeature } from '../lib/entitlements'
import { listBookings, updateBookingStatus } from '../lib/api/bookings'
import type { Booking } from '../types'

export default function Bookings() {
  const { business, subscription } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const entitled = hasFeature(subscription, 'bookings')

  useEffect(() => {
    if (business && entitled) listBookings(business.id).then(b => { setBookings(b); setLoading(false) })
    else setLoading(false)
  }, [business, entitled])

  async function setStatus(id: string, status: 'confirmed' | 'declined' | 'cancelled') {
    await updateBookingStatus(id, status)
    setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))
  }

  if (!business) return null

  if (!entitled) {
    return (
      <DashboardLayout>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Bookings</h1>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', marginTop: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(212,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={19} color="#D4A853" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 6 }}>Bookings is a Premium feature</div>
          <p style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.5)', marginBottom: 18, maxWidth: 340, margin: '0 auto 18px' }}>
            Let customers request a table, appointment, or room right from your site. Upgrade to Premium to turn it on.
          </p>
          <Link to="/dashboard/billing" style={{ display: 'inline-block', background: '#D4A853', color: '#0A0C10', padding: '10px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            View plans
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const pending = bookings.filter(b => b.status === 'pending')
  const other = bookings.filter(b => b.status !== 'pending')

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Bookings</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>Requests submitted through your site.</p>

      {loading ? (
        <div style={{ color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          No booking requests yet.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,12,16,0.5)', marginBottom: 10 }}>Awaiting response</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(b => <BookingCard key={b.id} booking={b} onAction={setStatus} />)}
              </div>
            </div>
          )}
          {other.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,12,16,0.5)', marginBottom: 10 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {other.map(b => <BookingCard key={b.id} booking={b} onAction={setStatus} />)}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}

function BookingCard({ booking, onAction }: { booking: Booking; onAction: (id: string, s: 'confirmed' | 'declined' | 'cancelled') => void }) {
  const statusColor = { pending: '#B45309', confirmed: '#16A34A', declined: '#DC2626', cancelled: 'rgba(10,12,16,0.4)' }[booking.status]

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(10,12,16,0.06)', padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarCheck size={15} color="#D4A853" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{booking.customerName}</span>
          {booking.partySize && <span style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>· {booking.partySize} people</span>}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>{booking.status}</span>
      </div>
      <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.6)', marginTop: 6 }}>
        {booking.requestedDate} at {booking.requestedTime} · {booking.phone}
      </div>
      {booking.notes && <p style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginTop: 6 }}>{booking.notes}</p>}
      {booking.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onAction(booking.id, 'confirmed')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <Check size={12} /> Confirm
          </button>
          <button onClick={() => onAction(booking.id, 'declined')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <X size={12} /> Decline
          </button>
        </div>
      )}
    </div>
  )
}
