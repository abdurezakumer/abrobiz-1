import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import { safeInternalPath } from '../lib/safeUrl'

type Factor = { id: string; status?: string; factor_type?: string; friendly_name?: string }
type Enrollment = { id: string; totp?: { qr_code?: string; secret?: string; uri?: string } }

export default function MfaSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const requested = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from
  const continuePath = safeInternalPath(requested ? `${requested.pathname ?? ''}${requested.search ?? ''}${requested.hash ?? ''}` : null, '/admin')
  const [factor, setFactor] = useState<Factor | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data, error: listError } = await supabase.auth.mfa.listFactors()
        if (!active) return
        if (listError) {
          setError('We could not load your security factors. Please try again.')
          return
        }
        const factors = data?.all ?? []
        const verified = factors.find(item => item.factor_type === 'totp' && item.status === 'verified')
        const pending = factors.find(item => item.factor_type === 'totp' && item.status === 'unverified')
        setFactor(verified ?? null)
        // Mobile browsers may discard a suspended tab while the user opens
        // their authenticator. The server still holds an unverified factor;
        // restore that factor so the user can enter a fresh code instead of
        // being stranded at the first setup step.
        if (pending) {
          setEnrollment({ id: pending.id })
          setNotice('We resumed your unfinished authenticator setup. If you already scanned the QR code, enter the current six-digit code. If not, restart setup to display a fresh QR code.')
        }
      } catch {
        if (active) setError('We could not load your security factors. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  async function beginEnrollment() {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AbroBiz administrator' })
      if (enrollError || !data) setError('We could not start authenticator setup. Please try again.')
      else setEnrollment(data as Enrollment)
    } catch {
      setError('We could not start authenticator setup. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function restartEnrollment() {
    setBusy(true); setError(''); setNotice(''); setCode('')
    try {
      if (enrollment?.id) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id })
        if (removeError) {
          setError('We could not reset the unfinished setup. Please try again, or contact support.')
          return
        }
      }
      setEnrollment(null)
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AbroBiz administrator' })
      if (enrollError || !data) setError('We could not create a fresh QR code. Please try again.')
      else setEnrollment(data as Enrollment)
    } catch {
      setError('We could not restart authenticator setup. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    const target = enrollment ?? factor
    if (!target || !code.match(/^\d{6}$/)) { setError('Enter the six-digit code from your authenticator app.'); return }
    setBusy(true); setError('')
    try {
      // Create a fresh challenge for every attempt. This avoids keeping an
      // expiring challenge id in page state while the user switches apps.
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: target.id, code })
      if (verifyError) setError('That authenticator code is invalid or expired. Enter the latest six-digit code and try again.')
      else navigate(continuePath, { replace: true })
    } catch {
      setError('We could not verify the code. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
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
            {enrollment?.totp?.qr_code && <p style={copy}>Switch to your authenticator app to add AbroBiz. If your phone reloads this page while you switch apps, return here and enter the current code; an unfinished setup will be recovered.</p>}
            {notice && <p role="status" style={noticeStyle}>{notice}</p>}
            {enrollment && !enrollment.totp?.qr_code && <p style={copy}>Open your authenticator app and use the AbroBiz code already saved there. If you have not scanned the QR yet, use “Restart setup” to generate a new one.</p>}
            <label style={label}>Six-digit authenticator code<input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} style={input} /></label>
            <button type="button" onClick={() => void verify()} disabled={busy || code.length !== 6} style={primary}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
            {enrollment && <button type="button" onClick={() => void restartEnrollment()} disabled={busy} style={secondary}>{busy ? 'Restarting…' : 'Restart setup / show a new QR code'}</button>}
          </>
        )}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
        <button type="button" onClick={() => navigate('/security/account')} style={secondary}>Manage Google and password sign-in</button>
        <button type="button" onClick={() => void signOut()} style={signOutButton}>Sign out</button>
      </section>
    </main>
  )
}

const page = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))', background: '#0A0C10', color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }
const card = { boxSizing: 'border-box' as const, width: 'min(100%, 460px)', padding: 'clamp(20px, 6vw, 32px)', borderRadius: 18, background: '#151922', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 24px 80px rgba(0,0,0,.35)' }
const back = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer', padding: 0 }
const icon = { marginTop: 28, width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.14)', color: '#D4A853' }
const heading = { fontSize: 28, lineHeight: 1.15, margin: '20px 0 10px', fontFamily: 'Georgia, serif' }
const copy = { color: '#B8AFA2', lineHeight: 1.6, fontSize: 14 }
const noticeStyle = { color: '#F2D99A', background: 'rgba(212,168,83,.1)', border: '1px solid rgba(212,168,83,.22)', borderRadius: 10, padding: '11px 12px', fontSize: 13, lineHeight: 1.55 }
const primary = { display: 'block', width: '100%', marginTop: 18, padding: '12px 16px', border: 0, borderRadius: 10, background: '#D4A853', color: '#15110A', fontWeight: 700, cursor: 'pointer' }
const secondary = { display: 'block', width: '100%', marginTop: 12, padding: '11px 16px', border: '1px solid rgba(255,255,255,.18)', borderRadius: 10, background: 'transparent', color: '#F0EDE7', fontWeight: 600, cursor: 'pointer' }
const label = { display: 'grid', gap: 7, marginTop: 18, color: '#B8AFA2', fontSize: 13 }
const input = { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: '#0F1218', color: '#F0EDE7', letterSpacing: 5, fontSize: 20 }
const qr = { display: 'block', width: 190, height: 190, margin: '20px auto', background: '#fff', padding: 8, borderRadius: 10 }
const secret = { wordBreak: 'break-all' as const, color: '#D8CFBF', fontSize: 12, lineHeight: 1.5 }
const errorStyle = { color: '#F7A6A6', fontSize: 13, marginTop: 16 }
const signOutButton = { display: 'block', margin: '24px auto 0', border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer' }
