import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { verifyEmailToken } from '../lib/api/emailVerification'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('This link is missing its verification token.')
      return
    }
    verifyEmailToken(token)
      .then(() => setStatus('success'))
      .catch(err => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      })
  }, [token])

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px', textAlign: 'center' }}
      >
        {status === 'checking' && (
          <>
            <Loader2 size={30} color="#D4A853" style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 15, color: '#F0EDE7' }}>Confirming your email…</div>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={34} color="#4ADE80" style={{ margin: '0 auto 16px' }} />
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 600, color: '#F0EDE7', marginBottom: 8 }}>Email confirmed</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(240,237,231,0.55)', marginBottom: 22 }}>You're all set.</p>
            <Link to="/dashboard" style={{ display: 'inline-block', background: '#D4A853', color: '#0A0C10', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Go to dashboard
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={34} color="#F87171" style={{ margin: '0 auto 16px' }} />
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 600, color: '#F0EDE7', marginBottom: 8 }}>Couldn't confirm your email</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(240,237,231,0.55)', marginBottom: 22 }}>{error}</p>
            <Link to="/dashboard" style={{ display: 'inline-block', color: '#D4A853', fontSize: 13.5, textDecoration: 'underline' }}>
              Go to dashboard — you can request a new link there
            </Link>
          </>
        )}
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
