import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, Send, CheckCircle2 } from 'lucide-react'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import { submitContactMessage } from '../../lib/api/messages'
import { DAY_LABELS, t } from '../../lib/i18n'
import { safeHttpsUrl, safeMailto, safeTel } from '../../lib/safeUrl'
import TurnstileWidget from '../../components/TurnstileWidget'
import { turnstileEnabled } from '../../lib/turnstile'

export default function StorefrontContact() {
  return (
    <StorefrontPageShell
      pagePath="/contact"
      render={({ business, lang, theme }) => {
        if (!business) return null
        return <ContactSection business={business} lang={lang} theme={theme} />
      }}
    />
  )
}

export function ContactSection({ business, lang, theme }: any) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const mapsUrl = safeHttpsUrl(business.mapsUrl)
  const phoneUrl = safeTel(business.phone)
  const emailUrl = safeMailto(business.email)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to send your message.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitContactMessage({ businessId: business.id, name, email, phone, message, turnstileToken })
      setSent(true)
      setName(''); setEmail(''); setPhone(''); setMessage('')
    } catch {
      setError("Couldn't send your message — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 13px',
    color: theme.text, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '44px 20px 64px' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 32 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, color: business.accentColor, textTransform: 'uppercase' }}>Contact</span>
        <h1 style={{ fontFamily: theme.headingFont ?? 'Outfit, sans-serif', fontSize: 28, fontWeight: 700, marginTop: 8 }}>Get in touch</h1>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="contact-grid">
        <div>
          {business.address && (
            mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, textDecoration: 'none', fontSize: 14, marginBottom: 14 }}>
              <MapPin size={17} color={business.accentColor} /> {business.address}
            </a> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, fontSize: 14, marginBottom: 14 }}><MapPin size={17} color={business.accentColor} /> {business.address}</div>
          )}
          {business.phone && phoneUrl && (
            <a href={phoneUrl} style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, textDecoration: 'none', fontSize: 14, marginBottom: 14 }}>
              <Phone size={17} color={business.accentColor} /> {business.phone}
            </a>
          )}
          {business.email && emailUrl && (
            <a href={emailUrl} style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, textDecoration: 'none', fontSize: 14, marginBottom: 20 }}>
              <Mail size={17} color={business.accentColor} /> {business.email}
            </a>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('openingHours', lang)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => {
              const h = business.openingHours[day]
              return (
                <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: theme.textDim, maxWidth: 220 }}>
                  <span>{DAY_LABELS[day][lang as keyof typeof DAY_LABELS.mon]}</span>
                  <span>{h.closed ? t('closed', lang) : `${h.open} \u2013 ${h.close}`}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <CheckCircle2 size={28} color={business.accentColor} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>Message sent</div>
              <p style={{ fontSize: 12.5, color: theme.textDim, marginTop: 6 }}>We'll get back to you soon.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" style={inputStyle} />
              <textarea required value={message} onChange={e => setMessage(e.target.value)} placeholder="Message" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              <TurnstileWidget action="contact" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              {error && <div style={{ color: '#F87171', fontSize: 12.5 }}>{error}</div>}
              <button type="submit" disabled={submitting || (turnstileEnabled && !turnstileToken)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: business.accentColor, color: '#0A0C10', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <Send size={14} /> {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 560px) { .contact-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
