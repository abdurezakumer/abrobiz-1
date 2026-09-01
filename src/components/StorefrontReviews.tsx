import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Send, CheckCircle2 } from 'lucide-react'
import { listApprovedReviews, submitReview } from '../lib/api/reviews'
import type { Review } from '../types'
import type { StorefrontTheme } from '../lib/storefrontTheme'
import TurnstileWidget from './TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Star size={22} color="#D4A853" fill={i <= value ? '#D4A853' : 'none'} />
        </button>
      ))}
    </div>
  )
}

export default function StorefrontReviews({ businessId, accentColor, theme }: { businessId: string; accentColor: string; theme: StorefrontTheme }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  useEffect(() => {
    listApprovedReviews(businessId).then(setReviews)
  }, [businessId])

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (turnstileEnabled && !turnstileToken) return
    setSubmitting(true)
    try {
      await submitReview({ businessId, customerName: name, rating, comment, turnstileToken })
      setSent(true)
      setName(''); setComment(''); setRating(5)
      setTurnstileToken(null)
      setTurnstileResetKey(value => value + 1)
    } catch {
      // no-op; the form's error state is intentionally minimal here
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 13px',
    color: theme.text, fontSize: 13.5, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 600 }}>Reviews</h2>
          {reviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{ display: 'flex' }}>
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={13} color={accentColor} fill={i <= Math.round(avg) ? accentColor : 'none'} />)}
              </div>
              <span style={{ fontSize: 12.5, color: theme.textDim }}>{avg.toFixed(1)} ({reviews.length})</span>
            </div>
          )}
        </div>
        {!showForm && !sent && (
          <button onClick={() => setShowForm(true)} style={{ background: 'none', border: `1px solid ${accentColor}`, color: accentColor, borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Write a review
          </button>
        )}
      </div>

      {showForm && !sent && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}
        >
          <StarPicker value={rating} onChange={setRating} />
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Your experience (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <TurnstileWidget action="review" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={submitting || (turnstileEnabled && !turnstileToken)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: accentColor, color: '#0A0C10', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <Send size={12} /> {submitting ? 'Sending…' : 'Submit'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: theme.textDim, fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          </div>
        </motion.form>
      )}

      {sent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#4ADE80' }}>
          <CheckCircle2 size={15} /> Thanks! Your review will appear once approved.
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textDim }}>No reviews yet — be the first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reviews.slice(0, 6).map(r => (
            <div key={r.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.customerName}</span>
                <div style={{ display: 'flex' }}>
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} color={accentColor} fill={i <= r.rating ? accentColor : 'none'} />)}
                </div>
              </div>
              {r.comment && <p style={{ fontSize: 12.5, color: theme.textDim, marginTop: 6, lineHeight: 1.5 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
