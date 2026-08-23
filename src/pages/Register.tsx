import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail } from 'lucide-react'
import { signUp, friendlyAuthError } from '../lib/authActions'
import { sendVerificationEmail } from '../lib/api/emailVerification'
import { friendlyError } from '../lib/errors'
import GoogleSignInButton from '../components/GoogleSignInButton'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      const { session } = await signUp(email, password, name, phone)
      if (session) {
        try {
          await sendVerificationEmail()
          navigate('/setup', { replace: true })
        } catch (emailError) {
          // The account is already created. Send the user to setup with a
          // visible recovery message instead of silently dropping the error.
          const message = `Your account was created, but we could not send the verification email. ${friendlyError(emailError)}`
          sessionStorage.setItem('abrobiz:email-error', message)
          navigate('/setup', {
            replace: true,
            state: { emailError: message },
          })
        }
      } else {
        setAwaitingConfirmation(true)
      }
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
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
            width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '36px 32px',
          }}
        >
          {awaitingConfirmation ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(212,168,83,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <Mail size={22} color="#D4A853" />
              </div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#F0EDE7', fontSize: 20, marginBottom: 8 }}>Check your email</h2>
              <p style={{ color: 'rgba(240,237,231,0.55)', fontSize: 14, lineHeight: 1.6 }}>
                We sent a confirmation link to <strong style={{ color: '#F0EDE7' }}>{email}</strong>. Click it, then come back and log in.
              </p>
              <Link to="/login" style={{ display: 'inline-block', marginTop: 20, color: '#D4A853', fontSize: 14, textDecoration: 'none' }}>
                Go to login →
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }}>
                Create your account
              </h1>
              <p style={{ color: 'rgba(240,237,231,0.5)', fontSize: 14, marginBottom: 26 }}>
                Set up your business's digital presence in minutes.
              </p>

              <GoogleSignInButton onError={setError} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: 12, color: 'rgba(240,237,231,0.35)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Full name">
                  <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Abebe Kebede" />
                </Field>
                <Field label="Phone number">
                  <input required value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="09XXXXXXXX" />
                </Field>
                <Field label="Email">
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
                </Field>
                <Field label="Password">
                  <input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="At least 6 characters" />
                </Field>

                {error && (
                  <div style={{ color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={submitStyle}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p style={{ textAlign: 'center', color: 'rgba(240,237,231,0.45)', fontSize: 13.5, marginTop: 22 }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#D4A853', textDecoration: 'none' }}>Log in</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
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
