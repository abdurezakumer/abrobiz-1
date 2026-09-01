import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { resetPassword } from '../lib/api/passwordReset'
import { passwordStrength, validatePassword } from '../lib/passwordPolicy'
import { friendlyError } from '../lib/errors'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Keep the reset token in memory for this page only and remove it from
    // the visible URL/history immediately after it has been read.
    if (token) window.history.replaceState(null, document.title, '/reset-password')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('This link is missing its reset token.')
      return
    }
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      setError(passwordCheck.message ?? 'Choose a stronger password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 14, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Back to login
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px' }}
        >
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={34} color="#4ADE80" style={{ margin: '0 auto 16px' }} />
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 600, color: '#F0EDE7', marginBottom: 8 }}>Password updated</h1>
              <p style={{ fontSize: 13.5, color: 'rgba(240,237,231,0.55)', marginBottom: 22 }}>You can log in with your new password now.</p>
              <button
                onClick={() => navigate('/login')}
                style={{ background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Go to login
              </button>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }}>Choose a new password</h1>
              <p style={{ color: 'rgba(240,237,231,0.5)', fontSize: 13.5, marginBottom: 22 }}>Make it something you haven't used before.</p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>New password</span>
                  <input required minLength={12} maxLength={128} type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="12+ characters with upper, lower, number and symbol" />
                </label>
                {password && <div style={{ marginTop: -7, fontSize: 12, color: passwordStrength(password) === 'Strong' || passwordStrength(password) === 'Very strong' ? '#4ADE80' : '#FACC15' }}>Password strength: {passwordStrength(password)}</div>}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>Confirm password</span>
                  <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} placeholder="Type it again" />
                </label>

                {error && (
                  <div style={{ color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} style={{ background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  {submitting ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '11px 13px', color: '#F0EDE7', fontSize: 14.5, outline: 'none',
}
