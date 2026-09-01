import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { recordLegalAcceptance } from '../lib/api/legal'
import { safeInternalPath } from '../lib/safeUrl'

export default function LegalAcceptance() {
  const navigate = useNavigate()
  const location = useLocation()
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!terms || !privacy) {
      setError('Please accept both documents to continue.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await recordLegalAcceptance()
      const from = safeInternalPath((location.state as { from?: { pathname?: string } } | null)?.from?.pathname, '/setup')
      navigate(from, { replace: true })
    } catch {
      setError('We could not save your legal acceptance. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <h1 style={headingStyle}>One more step</h1>
        <p style={mutedStyle}>Please review and accept the AbroBiz legal documents before creating or managing a business website.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <label style={checkLabelStyle}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={checkStyle} /><span>I agree to the <a href="/terms" target="_blank" rel="noreferrer" style={linkStyle}>Terms of Service</a>.</span></label>
          <label style={checkLabelStyle}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} style={checkStyle} /><span>I agree to the <a href="/privacy" target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a>.</span></label>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={loading} style={submitStyle}>{loading ? 'Saving...' : 'Accept and continue'}</button>
        </form>
      </motion.div>
    </div>
  )
}

const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 430, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px' }
const headingStyle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#F0EDE7', marginBottom: 8 }
const mutedStyle: React.CSSProperties = { color: 'rgba(240,237,231,0.55)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 24 }
const checkLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, color: 'rgba(240,237,231,0.62)', fontSize: 13, lineHeight: 1.55, cursor: 'pointer' }
const checkStyle: React.CSSProperties = { marginTop: 3, accentColor: '#D4A853' }
const linkStyle: React.CSSProperties = { color: '#D4A853' }
const errorStyle: React.CSSProperties = { color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }
const submitStyle: React.CSSProperties = { marginTop: 6, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
