import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Chrome, KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import { validatePassword } from '../lib/passwordPolicy'

type Identity = { provider?: string }

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? window.location.origin).replace(/\/$/, '')

export default function AccountSecurity() {
  const navigate = useNavigate()
  const { profile, signOut, mfa } = useAuth()
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function loadIdentities() {
    const { data, error: identitiesError } = await supabase.auth.getUserIdentities()
    if (identitiesError) setError('We could not load your sign-in methods. Please try again.')
    else setIdentities((data?.identities ?? []) as Identity[])
    setLoading(false)
  }

  useEffect(() => { void loadIdentities() }, [])

  async function connectGoogle() {
    setError(''); setMessage(''); setBusy(true)
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${SITE_URL}/security/account` },
    })
    if (linkError) {
      setError(/already linked|already exists/i.test(linkError.message)
        ? 'A Google account is already connected to this AbroBiz account.'
        : 'We could not connect Google sign-in. Please try again.')
      setBusy(false)
    }
    // Successful linking redirects back here. Supabase restores the existing
    // session and the effect reloads the linked identities.
  }

  async function savePassword() {
    setError(''); setMessage('')
    const passwordCheck = validatePassword(newPassword)
    if (!passwordCheck.valid) { setError(passwordCheck.message ?? 'Choose a stronger password.'); return }
    if (newPassword !== confirmPassword) { setError('The passwords do not match.'); return }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) setError('We could not save password sign-in. Please try again.')
    else {
      setMessage('Password sign-in is enabled. You can now use either Google or your AbroBiz email and password.')
      setNewPassword(''); setConfirmPassword('')
      await loadIdentities()
    }
    setBusy(false)
  }

  const hasGoogle = identities.some(identity => identity.provider === 'google')
  const hasEmail = identities.some(identity => identity.provider === 'email')
  const privileged = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
  const needsMfaStepUp = privileged && mfa.required && mfa.currentLevel !== 'aal2'

  return (
    <main style={page}>
      <section style={card}>
        <button type="button" onClick={() => navigate(-1)} style={back}><ArrowLeft size={16} /> Back</button>
        <div style={icon}><ShieldCheck size={25} /></div>
        <h1 style={heading}>Account security</h1>
        <p style={copy}>Keep both secure sign-in options connected to the same AbroBiz account. Your business, role, permissions, and data stay unchanged.</p>

        {loading ? <p style={copy}>Loading sign-in methods…</p> : (
          <div style={methods}>
            <MethodRow icon={<KeyRound size={18} />} title="Email and password" connected={hasEmail} />
            <MethodRow icon={<Chrome size={18} />} title="Google" connected={hasGoogle} />
          </div>
        )}

        {needsMfaStepUp && <div role="note" style={securityGate}>Complete administrator MFA before changing sign-in methods. <button type="button" onClick={() => navigate('/security/mfa')} style={inlineLink}>Open MFA setup</button></div>}
        {!hasGoogle && !loading && <button type="button" onClick={() => void connectGoogle()} disabled={busy || needsMfaStepUp} style={googleButton}><Chrome size={17} /> {busy ? 'Connecting…' : 'Connect Google sign-in'}</button>}

        <div style={panel}>
          <h2 style={subheading}>{hasEmail ? 'Change your password' : 'Add password sign-in'}</h2>
          <p style={copy}>Use at least 12 characters with uppercase, lowercase, a number, and a special character.</p>
          <label style={label}>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} style={input} placeholder="12+ characters" /></label>
          <label style={label}>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} style={input} placeholder="Type it again" /></label>
          <button type="button" onClick={() => void savePassword()} disabled={busy || needsMfaStepUp || !newPassword || !confirmPassword} style={primary}>{busy ? 'Saving…' : hasEmail ? 'Change password' : 'Enable password sign-in'}</button>
        </div>

        {message && <p role="status" style={success}><Check size={15} /> {message}</p>}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
        <p style={securityNote}>AbroBiz keeps authorization enforced by your session, role, MFA requirements, and database policies. Linking a sign-in method never grants additional permissions.</p>
        {profile?.platformId && <p style={platformId}>Platform ID: <code>{profile.platformId}</code></p>}
        <button type="button" onClick={() => void signOut()} style={signOutButton}>Sign out</button>
      </section>
    </main>
  )
}

function MethodRow({ icon, title, connected }: { icon: React.ReactNode; title: string; connected: boolean }) {
  return <div style={methodRow}><span style={methodIcon}>{icon}</span><span style={{ flex: 1 }}>{title}</span><span style={{ ...status, color: connected ? '#217346' : '#7B8490', background: connected ? '#EAF7EF' : '#F1F3F5' }}>{connected ? 'Connected' : 'Not connected'}</span></div>
}

const page = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0A0C10', color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }
const card = { width: 'min(100%, 520px)', padding: 32, borderRadius: 18, background: '#151922', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 24px 80px rgba(0,0,0,.35)' }
const back = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer', padding: 0 }
const icon = { marginTop: 28, width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.14)', color: '#D4A853' }
const heading = { fontSize: 28, lineHeight: 1.15, margin: '20px 0 10px', fontFamily: 'Georgia, serif' }
const subheading = { fontSize: 17, margin: 0, fontFamily: 'Outfit, sans-serif' }
const copy = { color: '#B8AFA2', lineHeight: 1.55, fontSize: 13.5 }
const methods = { display: 'grid', gap: 10, marginTop: 24 }
const methodRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 11, background: '#0F1218', border: '1px solid rgba(255,255,255,.1)', fontSize: 14 }
const methodIcon = { display: 'grid', placeItems: 'center', color: '#D4A853' }
const status = { padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }
const googleButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', marginTop: 14, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: '#fff', color: '#202124', fontWeight: 650, cursor: 'pointer' }
const panel = { marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.1)' }
const label = { display: 'grid', gap: 7, marginTop: 16, color: '#B8AFA2', fontSize: 13 }
const input = { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: '#0F1218', color: '#F0EDE7', letterSpacing: 2, fontSize: 16 }
const primary = { display: 'block', width: '100%', marginTop: 16, padding: '12px 16px', border: 0, borderRadius: 10, background: '#D4A853', color: '#15110A', fontWeight: 700, cursor: 'pointer' }
const success = { display: 'flex', alignItems: 'flex-start', gap: 7, color: '#A7E3BC', fontSize: 13, lineHeight: 1.45, marginTop: 18 }
const errorStyle = { color: '#F7A6A6', fontSize: 13, lineHeight: 1.45, marginTop: 18 }
const securityGate = { marginTop: 16, padding: '11px 12px', borderRadius: 10, background: 'rgba(212,168,83,.1)', color: '#D8CFBF', fontSize: 12.5, lineHeight: 1.5 }
const inlineLink = { border: 0, background: 'none', padding: 0, color: '#D4A853', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }
const securityNote = { color: '#8F98A5', fontSize: 12, lineHeight: 1.5, marginTop: 26 }
const platformId = { color: '#B8AFA2', fontSize: 12, marginTop: 14 }
const signOutButton = { display: 'block', margin: '24px auto 0', border: 0, background: 'none', color: '#B8AFA2', cursor: 'pointer' }
