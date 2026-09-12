import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { signIn, friendlyAuthError } from '../lib/authActions'
import { requestPasswordReset } from '../lib/api/passwordReset'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { safeInternalPath } from '../lib/safeUrl'
import TurnstileWidget from '../components/TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [resetMode, setResetMode] = useState(false)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [resetWidgetKey, setResetWidgetKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to continue.')
      return
    }
    setLoading(true)
    const from = safeInternalPath((location.state as { from?: { pathname?: string } })?.from?.pathname, '/dashboard')
    try {
      await signIn(email, password, turnstileToken)
      navigate(from, { replace: true })
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
      setResetMode(true)
      setError('Complete the password-reset security check to continue.')
      return
    }
    setError('')
    try {
      await requestPasswordReset(email, resetToken)
      setResetToken(null)
      setResetWidgetKey(value => value + 1)
      setResetMode(false)
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>Email</span>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>Password</span>
              <input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="Your password" />
            </label>

            <button type="button" onClick={handleForgotPassword} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'rgba(240,237,231,0.45)', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              Forgot password?
            </button>

            <TurnstileWidget
              action={resetMode ? 'password-reset' : 'login'}
              onToken={resetMode ? setResetToken : setTurnstileToken}
              resetKey={resetMode ? resetWidgetKey : turnstileResetKey}
            />
            {resetMode && turnstileEnabled && (
              <div style={{ color: 'rgba(240,237,231,0.5)', fontSize: 12, lineHeight: 1.45 }}>
                Complete this security check, then click “Forgot password?” above.
              </div>
            )}

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

            <button type="submit" disabled={loading || (turnstileEnabled && !turnstileToken)} style={submitStyle}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: 'rgba(240,237,231,0.35)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <GoogleSignInButton onError={setError} />

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
