import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { requestLoginOtp, verifyLoginOtp, friendlyAuthError } from '../lib/authActions'
import { requestPasswordReset } from '../lib/api/passwordReset'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { safeInternalPath } from '../lib/safeUrl'
import TurnstileWidget from '../components/TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [resetWidgetKey, setResetWidgetKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter your email address to continue.')
      return
    }
    if (!otpSent && turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to continue.')
      return
    }
    setLoading(true)
    const from = safeInternalPath((location.state as { from?: { pathname?: string } })?.from?.pathname, '/dashboard')
    try {
      if (!otpSent) {
        await requestLoginOtp(email, turnstileToken)
        setOtpSent(true)
        setInfo('If this email belongs to an AbroBiz account, a six-digit code is on its way. Check your inbox.')
        setTurnstileToken(null)
        setTurnstileResetKey(value => value + 1)
      } else {
        if (!/^\d{6}$/.test(otp)) {
          setError('Enter the six-digit verification code from your email.')
          return
        }
        await verifyLoginOtp(email, otp)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(friendlyAuthError(err))
      setTurnstileToken(null)
      setTurnstileResetKey(value => value + 1)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"')
      return
    }
    if (turnstileEnabled && !resetToken) {
      setError('Complete the password-reset security check to continue.')
      return
    }
    setError('')
    try {
      await requestPasswordReset(email, resetToken)
      setResetToken(null)
      setResetWidgetKey(value => value + 1)
      setInfo('If that email has an account, a reset link is on its way — check your inbox.')
    } catch (err) {
      setError(friendlyAuthError(err))
      setResetToken(null)
      setResetWidgetKey(value => value + 1)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 14, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Back to home
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '36px 32px',
          }}
        >
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }}>
            Welcome back
          </h1>
          <p style={{ color: 'rgba(240,237,231,0.5)', fontSize: 14, marginBottom: 26 }}>Log in to manage your business.</p>

          <GoogleSignInButton onError={setError} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: 'rgba(240,237,231,0.35)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>Email</span>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
            </label>
            {otpSent && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>Email verification code</span>
                <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ ...inputStyle, letterSpacing: 5, textAlign: 'center' }} placeholder="123456" />
              </label>
            )}

            <button type="button" onClick={handleForgotPassword} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'rgba(240,237,231,0.45)', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              Forgot password?
            </button>

            {!otpSent && <TurnstileWidget action="login" onToken={setTurnstileToken} resetKey={turnstileResetKey} />}
            <TurnstileWidget action="password-reset" onToken={setResetToken} resetKey={resetWidgetKey} />

            {error && (
              <div style={{ color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ color: '#4ADE80', fontSize: 13, background: 'rgba(74,222,128,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                {info}
              </div>
            )}

            <button type="submit" disabled={loading || (!otpSent && turnstileEnabled && !turnstileToken)} style={submitStyle}>
              {loading ? (otpSent ? 'Verifying…' : 'Sending code…') : otpSent ? 'Verify and log in' : 'Send login code'}
            </button>
            {otpSent && (
              <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setInfo(''); setError(''); setTurnstileResetKey(value => value + 1) }} style={{ background: 'none', border: 'none', color: 'rgba(240,237,231,0.5)', fontSize: 12.5, cursor: 'pointer' }}>
                Use a different email
              </button>
            )}
          </form>

          <p style={{ textAlign: 'center', color: 'rgba(240,237,231,0.45)', fontSize: 13.5, marginTop: 22 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#D4A853', textDecoration: 'none' }}>Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '11px 13px', color: '#F0EDE7', fontSize: 14.5, outline: 'none',
}

const submitStyle: React.CSSProperties = {
  marginTop: 6, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10,
  padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
