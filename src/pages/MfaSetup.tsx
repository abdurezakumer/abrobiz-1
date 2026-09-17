import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'

type Factor = { id: string; status?: string; factor_type?: string; friendly_name?: string }
type Enrollment = { id: string; totp?: { qr_code?: string; secret?: string; uri?: string } }

export default function MfaSetup() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [factor, setFactor] = useState<Factor | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (!active) return
      if (listError) setError('We could not load your security factors. Please try again.')
      const verified = (data?.all ?? []).find(item => item.factor_type === 'totp' && item.status === 'verified')
      setFactor(verified ?? null)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  async function beginEnrollment() {
    setBusy(true); setError('')
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AbroBiz administrator' })
    if (enrollError || !data) setError('We could not start authenticator setup. Please try again.')
    else setEnrollment(data as Enrollment)
    setBusy(false)
  }

  async function beginChallenge(target: Factor) {
    const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: target.id })
    if (challengeError || !data) { setError('We could not start the verification challenge. Please try again.'); return }
    setChallengeId(data.id)
  }

  async function verify() {
    const target = enrollment ?? factor
    if (!target || !code.match(/^\d{6}$/)) { setError('Enter the six-digit code from your authenticator app.'); return }
    setBusy(true); setError('')
    let activeChallenge = challengeId
    if (!activeChallenge) {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: target.id })
      if (challengeError || !data) { setError('We could not start the verification challenge. Please try again.'); setBusy(false); return }
      activeChallenge = data.id
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: target.id, challengeId: activeChallenge, code })
    if (verifyError) setError('That authenticator code is invalid or expired.')
    else navigate('/admin', { replace: true })
    setBusy(false)
  }

  const isPrivileged = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
  if (!isPrivileged) return <main style={page}><section style={card}><h1>Security settings</h1><p>Multi-factor authentication is only required for privileged AbroBiz accounts.</p><button type="button" onClick={() => navigate('/dashboard')}>Return to dashboard</button></section></main>

  return (
    <main style={page}>
      <section style={card}>
        <button type="button" onClick={() => navigate('/admin')} style={back}><ArrowLeft size={16} /> Back</button>
        <div style={icon}><ShieldCheck size={25} /></div>
        <h1 style={heading}>Protect your administrator account</h1>
        <p style={copy}>AbroBiz requires a verified authenticator app before privileged dashboards and sensitive operations can be used.</p>
        {loading ? <p>Loading security settings…</p> : !factor && !enrollment ? <button type="button" onClick={() => void beginEnrollment()} disabled={busy} style={primary}>{busy ? 'Preparing…' : 'Set up authenticator app'}</button> : (
          <>
            {enrollment?.totp?.qr_code && <img src={enrollment.totp.qr_code} alt="Authenticator setup QR code" style={qr} />}
            {enrollment?.totp?.secret && <p style={secret}><strong>Manual setup key:</strong> {enrollment.totp.secret}</p>}
            <label style={label}>Six-digit authenticator code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} style={input} /></label>
            {!enrollment && !challengeId && <button type="button" onClick={() => factor && void beginChallenge(factor)} disabled={busy} style={secondary}>Send verification challenge</button>}
            <button type="button" onClick={() => void verify()} disabled={busy || code.length !== 6} style={primary}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
          </>
        )}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
        <button type="button" onClick={() => navigate('/security/account')} style={secondary}>Manage Google and password sign-in</button>
        <button type="button" onClick={() => void signOut()} style={signOutButton}>Sign out</button>
      </section>
    </main>
  )
}

const page = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0A0C10', color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }
const card = { width: 'min(100%, 460px)', padding: 32, borderRadius: 18, background: '#151922', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 24px 80px rgba(0,0,0,.35)' }
const back = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer', padding: 0 }
const icon = { marginTop: 28, width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.14)', color: '#D4A853' }
const heading = { fontSize: 28, lineHeight: 1.15, margin: '20px 0 10px', fontFamily: 'Georgia, serif' }
const copy = { color: '#B8AFA2', lineHeight: 1.6, fontSize: 14 }
const primary = { display: 'block', width: '100%', marginTop: 18, padding: '12px 16px', border: 0, borderRadius: 10, background: '#D4A853', color: '#15110A', fontWeight: 700, cursor: 'pointer' }
const secondary = { display: 'block', width: '100%', marginTop: 12, padding: '11px 16px', border: '1px solid rgba(255,255,255,.18)', borderRadius: 10, background: 'transparent', color: '#F0EDE7', fontWeight: 600, cursor: 'pointer' }
const label = { display: 'grid', gap: 7, marginTop: 18, color: '#B8AFA2', fontSize: 13 }
const input = { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: '#0F1218', color: '#F0EDE7', letterSpacing: 5, fontSize: 20 }
const qr = { display: 'block', width: 190, height: 190, margin: '20px auto', background: '#fff', padding: 8, borderRadius: 10 }
const secret = { wordBreak: 'break-all' as const, color: '#D8CFBF', fontSize: 12, lineHeight: 1.5 }
const errorStyle = { color: '#F7A6A6', fontSize: 13, marginTop: 16 }
const signOutButton = { display: 'block', margin: '24px auto 0', border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer' }
