import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail } from 'lucide-react'
import { signUp, friendlyAuthError } from '../lib/authActions'
import { validatePassword, passwordStrength } from '../lib/passwordPolicy'
import GoogleSignInButton from '../components/GoogleSignInButton'
import TurnstileWidget from '../components/TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref')?.trim().toUpperCase() ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      setError(passwordCheck.message ?? 'Choose a stronger password.')
      return
    }
    if (!legalAccepted) {
      setError('Please accept both the AbroBiz Terms of Service and Privacy Policy to continue.')
      return
    }
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to continue.')
      return
    }
    setLoading(true)
    try {
      const result = await signUp(email, password, name, phone, true, true, turnstileToken, referralCode)
      // Supabase projects can use six-to-ten digit email OTPs. Carry the
      // active length to the verification screen so it matches the code sent
      // by AbroBiz's SMTP sender.
      const otpLength = result.otpLength && result.otpLength >= 6 && result.otpLength <= 10 ? result.otpLength : 8
      navigate('/verify-email?email=' + encodeURIComponent(email.trim().toLowerCase()) + '&length=' + otpLength, { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err))
      setTurnstileToken(null)
      setTurnstileResetKey(value => value + 1)
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={cardStyle}>
          <h1 style={headingStyle}>Create your account</h1>
          <p style={mutedStyle}>Set up your business's digital presence in minutes.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name"><input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Abebe Kebede" /></Field>
            <Field label="Phone number"><input required value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="09XXXXXXXX" /></Field>
            <Field label="Referral code (optional)"><input value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} style={inputStyle} placeholder="Enter a partner code if you were referred" maxLength={32} autoCapitalize="characters" /></Field>
            <Field label="Email"><input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" /></Field>
            <Field label="Password"><input required minLength={12} maxLength={128} type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="12+ characters with upper, lower, number and symbol" /></Field>
            {password && <div style={{ marginTop: -7, fontSize: 12, color: passwordCheckColor(passwordStrength(password)) }}>Password strength: {passwordStrength(password)}</div>}

            <label style={checkLabelStyle}>
              <input type="checkbox" checked={legalAccepted} onChange={e => setLegalAccepted(e.target.checked)} style={checkStyle} />
              <span>I agree to the AbroBiz <Link to="/terms" target="_blank" style={linkStyle}>Terms of Service</Link> and <Link to="/privacy" target="_blank" style={linkStyle}>Privacy Policy</Link>.</span>
            </label>

            <TurnstileWidget action="signup" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={loading || (turnstileEnabled && !turnstileToken)} style={submitStyle}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
            <div style={ruleStyle} /><span style={{ fontSize: 12, color: 'rgba(240,237,231,0.35)' }}>or</span><div style={ruleStyle} />
          </div>
          <GoogleSignInButton onError={setError} referralCode={referralCode} />

          <p style={{ textAlign: 'center', color: 'rgba(240,237,231,0.45)', fontSize: 13.5, marginTop: 22 }}>
            Already have an account? <Link to="/login" style={linkStyle}>Log in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }}>{label}</span>{children}</label>
}

function passwordCheckColor(strength: string): string {
  if (strength === 'Very strong' || strength === 'Strong') return '#4ADE80'
  if (strength === 'Fair') return '#FACC15'
  return '#F87171'
}

const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px' }
const headingStyle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }
const mutedStyle: React.CSSProperties = { color: 'rgba(240,237,231,0.5)', fontSize: 14, marginBottom: 26 }
const ruleStyle: React.CSSProperties = { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }
const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 13px', color: '#F0EDE7', fontSize: 14.5, outline: 'none' }
const checkLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, color: 'rgba(240,237,231,0.58)', fontSize: 12, lineHeight: 1.55, cursor: 'pointer' }
const checkStyle: React.CSSProperties = { marginTop: 3, accentColor: '#D4A853' }
const linkStyle: React.CSSProperties = { color: '#D4A853', textDecoration: 'none' }
const errorStyle: React.CSSProperties = { color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }
const submitStyle: React.CSSProperties = { marginTop: 6, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
