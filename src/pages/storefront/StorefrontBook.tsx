import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck, Send, CheckCircle2 } from 'lucide-react'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import { submitBooking } from '../../lib/api/bookings'
import TurnstileWidget from '../../components/TurnstileWidget'
import { turnstileEnabled } from '../../lib/turnstile'

function heading(itemLabel: string): string {
  if (itemLabel === 'Service') return 'Book an Appointment'
  if (itemLabel === 'Room / Package') return 'Book a Room'
  return 'Reserve a Table'
}

export default function StorefrontBook() {
  return (
    <StorefrontPageShell
      pagePath="/book"
      render={({ business, labels, theme, entitlements }) => {
        if (!business) return null
        if (!entitlements.bookings) {
          return (
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '64px 20px', textAlign: 'center', color: theme.textDim, fontSize: 14 }}>
              Booking isn't available for this business.
            </div>
          )
        }
        return <BookSection business={business} itemLabel={labels.itemLabel} theme={theme} />
      }}
    />
  )
}

export function BookSection({ business, itemLabel, theme }: any) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState<number | ''>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const inputStyle: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 13px',
    color: theme.text, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to submit your request.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitBooking({
        businessId: business.id,
        customerName: name,
        phone,
        partySize: partySize === '' ? undefined : partySize,
        requestedDate: date,
        requestedTime: time,
        notes,
        turnstileToken,
      })
      setSent(true)
    } catch {
      setError("Couldn't submit your request — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle2 size={30} color={business.accentColor} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Request sent</div>
          <p style={{ fontSize: 13.5, color: theme.textDim }}>{business.name} will confirm your booking soon.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '44px 20px 64px' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 28 }}>
        <CalendarCheck size={24} color={business.accentColor} style={{ margin: '0 auto 8px' }} />
        <h1 style={{ fontFamily: theme.headingFont ?? 'Outfit, sans-serif', fontSize: 24, fontWeight: 700 }}>{heading(itemLabel)}</h1>
        <p style={{ fontSize: 13.5, color: theme.textDim, marginTop: 6 }}>at {business.name}</p>
      </motion.div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
        <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
        <div style={{ display: 'flex', gap: 10 }}>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          <input required type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
        </div>
        {itemLabel !== 'Service' && (
          <input type="number" min={1} value={partySize} onChange={e => setPartySize(e.target.value ? parseInt(e.target.value) : '')} placeholder="Party size (optional)" style={inputStyle} />
        )}
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else we should know? (optional)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        <TurnstileWidget action="booking" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
        {error && <div style={{ color: '#F87171', fontSize: 12.5 }}>{error}</div>}
        <button type="submit" disabled={submitting || (turnstileEnabled && !turnstileToken)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: business.accentColor, color: '#0A0C10', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
          <Send size={14} /> {submitting ? 'Sending…' : 'Request booking'}
        </button>
      </form>
    </div>
  )
}
