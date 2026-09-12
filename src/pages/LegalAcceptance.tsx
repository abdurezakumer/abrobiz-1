import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { recordLegalAcceptance } from '../lib/api/legal'
import { safeInternalPath } from '../lib/safeUrl'
import { useAuth } from '../lib/authContext'

export default function LegalAcceptance() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshProfile } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await recordLegalAcceptance()
      // Guards read consent from AuthProvider. Refresh only the profile before
      // navigating so unrelated business requests cannot mask a saved consent.
      await refreshProfile()
      const from = safeInternalPath((location.state as { from?: { pathname?: string } } | null)?.from?.pathname, '/setup')
      navigate(from, { replace: true })
    } catch {
      setError('We could not save your legal acceptance. Please check your connection and try again.')
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
          <label style={{ ...checkLabelStyle, opacity: loading ? 0.65 : 1 }}>
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={loading} style={checkStyle} />
            <span>I have read and agree to the <a href="/terms" target="_blank" rel="noreferrer" style={linkStyle}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a>.</span>
          </label>
          {error && <div role="alert" style={errorStyle}>{error}</div>}
          {loading && (
            <div role="status" aria-live="polite" style={savingStyle}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Saving your secure acceptance…</span>
            </div>
          )}
          <button type="submit" disabled={loading} style={{ ...submitStyle, opacity: loading ? 0.75 : 1 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle2 size={16} /> Accept and continue</>}
          </button>
        </form>
      </motion.div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
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
const savingStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(240,237,231,0.65)', fontSize: 12.5, padding: '9px 11px', background: 'rgba(212,168,83,0.08)', borderRadius: 9 }
const submitStyle: React.CSSProperties = { marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
