import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { resendVerificationOtp, verifySignupOtp } from '../lib/api/emailVerification'
import { recordLegalAcceptance } from '../lib/api/legal'
import { friendlyAuthError } from '../lib/authActions'
import TurnstileWidget from '../components/TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'
import { useAuth } from '../lib/authContext'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const configuredLength = Number(params.get('length'))
  const otpLength = Number.isInteger(configuredLength) && configuredLength >= 6 && configuredLength <= 10 ? configuredLength : 8
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState(() => Array.from({ length: otpLength }, () => ''))
  const [cooldown, setCooldown] = useState(60)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const { refreshProfile } = useAuth()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const token = code.join('')

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    setCode(current => {
      const next = [...current]
      next[index] = digit
      return next
    })
    if (digit && index < code.length - 1) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !code[index] && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < code.length - 1) inputs.current[index + 1]?.focus()
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, code.length).split('')
    if (!digits.length) return
    setCode([...digits, ...Array.from({ length: code.length }, () => '')].slice(0, code.length))
    inputs.current[Math.min(digits.length, code.length - 1)]?.focus()
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim() || token.length !== code.length) {
      setError(`Enter the email address and all ${code.length} digits from the email.`)
      return
    }
    setSubmitting(true)
    try {
      await verifySignupOtp(email, token)
      await recordLegalAcceptance()
      await refreshProfile()
      setVerified(true)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !email.trim()) return
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the security check to resend the code.')
      return
    }
    setError('')
    setResending(true)
    try {
      await resendVerificationOtp(email, turnstileToken)
      setCooldown(60)
      setTurnstileToken(null)
      setTurnstileResetKey(value => value + 1)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <Link to="/login" style={backStyle}><ArrowLeft size={15} /> Back to login</Link>
        {verified ? (
          <div style={{ textAlign: 'center', paddingTop: 25 }}>
            <CheckCircle2 size={38} color="#4ADE80" style={{ margin: '0 auto 16px' }} />
            <h1 style={headingStyle}>Email verified</h1>
            <p style={mutedStyle}>Your AbroBiz account is ready.</p>
            <button onClick={() => navigate('/setup', { replace: true })} style={submitStyle}>Continue to setup</button>
          </div>
        ) : (
          <>
            <h1 style={headingStyle}>Verify your email</h1>
            <p style={mutedStyle}>Enter the verification code AbroBiz sent to your email. Codes expire shortly and can only be used once.</p>
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={labelStyle}>
                <span>Email address</span>
                <input required type="email" value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} placeholder="you@example.com" autoComplete="email" />
              </label>
              <div role="group" aria-label={`${code.length}-digit verification code`} style={{ display: 'flex', justifyContent: 'space-between', gap: otpLength > 6 ? 4 : 7 }}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={element => { inputs.current[index] = element }}
                    value={digit}
                    onChange={event => updateDigit(index, event.target.value)}
                    onKeyDown={event => handleKeyDown(index, event)}
                    onPaste={handlePaste}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={'Verification digit ' + (index + 1)}
                    style={{ ...codeInputStyle, width: otpLength > 6 ? 32 : 44, fontSize: otpLength > 6 ? 18 : 22 }}
                  />
                ))}
              </div>
              {error && <div style={errorStyle}>{error}</div>}
              <button type="submit" disabled={submitting} style={submitStyle}>
                {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</> : 'Verify email'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <TurnstileWidget action="otp-resend" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              <button type="button" onClick={handleResend} disabled={cooldown > 0 || resending} style={resendStyle}>
                {resending ? 'Sending...' : cooldown > 0 ? 'Resend code in ' + cooldown + 's' : 'Resend code'}
              </button>
              <p style={{ ...mutedStyle, fontSize: 12, marginTop: 10, marginBottom: 0 }}>Check spam or promotions if you do not see it.</p>
            </div>
          </>
        )}
      </motion.div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}

const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 410, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 32px' }
const backStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 13, textDecoration: 'none' }
const headingStyle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 600, color: '#F0EDE7', margin: '26px 0 7px' }
const mutedStyle: React.CSSProperties = { color: 'rgba(240,237,231,0.55)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 22 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 12.5 }
const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 13px', color: '#F0EDE7', fontSize: 14.5, outline: 'none' }
const codeInputStyle: React.CSSProperties = { ...inputStyle, width: 44, height: 50, padding: 0, textAlign: 'center', fontSize: 22, fontWeight: 600 }
const errorStyle: React.CSSProperties = { color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }
const submitStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const resendStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#D4A853', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }
