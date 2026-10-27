import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, Bot, Check, Chrome, Copy, KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import { validatePassword } from '../lib/passwordPolicy'
import { createMcpToken, listMcpTokens, revokeMcpToken, type CreatedMcpToken, type McpToken } from '../lib/api/mcp'

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
  const [mcpTokens, setMcpTokens] = useState<McpToken[]>([])
  const [mcpToken, setMcpToken] = useState<CreatedMcpToken | null>(null)
  const [mcpName, setMcpName] = useState('Claude AbroBiz connection')
  const [mcpLoading, setMcpLoading] = useState(true)
  const [mcpBusy, setMcpBusy] = useState(false)
  const [mcpMessage, setMcpMessage] = useState('')
  const [mcpError, setMcpError] = useState('')
  const [now] = useState(() => Date.now())

  async function loadIdentities() {
    const { data, error: identitiesError } = await supabase.auth.getUserIdentities()
    if (identitiesError) setError('We could not load your sign-in methods. Please try again.')
    else setIdentities((data?.identities ?? []) as Identity[])
    setLoading(false)
  }

  async function loadMcpTokens() {
    try {
      setMcpTokens(await listMcpTokens())
      setMcpError('')
    } catch {
      // The panel remains non-blocking while migration 0063 is being rolled
      // out to a deployment. It never prevents normal account security work.
      setMcpError('Claude connections are not available until the MCP database migration is applied.')
    } finally {
      setMcpLoading(false)
    }
  }

  useEffect(() => { void loadIdentities(); void loadMcpTokens() }, [])

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

  async function createConnectionToken() {
    setMcpMessage(''); setMcpError(''); setMcpToken(null)
    if (mcpName.trim().length < 1 || mcpName.trim().length > 80) { setMcpError('Give this connection a name between 1 and 80 characters.'); return }
    setMcpBusy(true)
    try {
      setMcpToken(await createMcpToken(mcpName.trim()))
      setMcpMessage('Copy this token now. AbroBiz will not show the plaintext token again.')
      await loadMcpTokens()
    } catch {
      setMcpError('We could not create the Claude connection. Please try again.')
    } finally { setMcpBusy(false) }
  }

  async function revokeConnection(tokenId: string) {
    if (!window.confirm('Revoke this Claude connection? It will stop working immediately.')) return
    setMcpBusy(true); setMcpMessage(''); setMcpError('')
    try {
      await revokeMcpToken(tokenId)
      setMcpMessage('Claude connection revoked.')
      await loadMcpTokens()
    } catch {
      setMcpError('We could not revoke that Claude connection. Please try again.')
    } finally { setMcpBusy(false) }
  }

  async function copyValue(value: string) {
    try { await navigator.clipboard.writeText(value); setMcpMessage('Copied to clipboard.') } catch { setMcpError('Copy was blocked by the browser. Select and copy the value manually.') }
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

        <div style={mcpPanel}>
          <div style={mcpTitleRow}><span style={mcpIcon}><Bot size={20} /></span><div><h2 style={subheading}>Claude via AbroBiz MCP</h2><p style={copy}>Connect Claude to authorized AbroBiz data and marketing drafts without exposing your Supabase credentials.</p></div></div>
          <div role="note" style={mcpNotice}>Connections are read-scoped with draft-only writing. Publishing, approval, billing, deletion, and external messages still require the existing AbroBiz human workflow.</div>
          {mcpLoading ? <p style={copy}>Loading Claude connections…</p> : mcpError && !mcpTokens.length ? <p role="status" style={mutedError}>{mcpError}</p> : <>
            <label style={label}>Connection name<input value={mcpName} onChange={event => setMcpName(event.target.value)} maxLength={80} style={input} disabled={mcpBusy || needsMfaStepUp} /></label>
            <button type="button" onClick={() => void createConnectionToken()} disabled={mcpBusy || needsMfaStepUp} style={primary}>{mcpBusy ? 'Creating…' : 'Create Claude connection'}</button>
            {mcpToken && <div style={tokenBox}><strong>Copy the token now</strong><p style={copy}>This is the only time the plaintext token is displayed.</p><div style={tokenRow}><code style={tokenCode}>{mcpToken.token}</code><button type="button" onClick={() => void copyValue(mcpToken.token)} style={copyButton} aria-label="Copy MCP token"><Copy size={15} /> Copy</button></div><p style={copy}>Endpoint: <code>{`${SITE_URL}/api/mcp`}</code></p><p style={copy}>In Claude: Settings → Connectors → Add custom connector → use the endpoint and request header <code>Authorization: Bearer {mcpToken.token}</code>.</p></div>}
            <div style={tokenList}>{mcpTokens.map(token => { const expired = new Date(token.expires_at).getTime() <= now; return <div key={token.id} style={tokenItem}><div style={{ flex: 1 }}><strong>{token.name}</strong><div style={tokenMeta}><code>{token.token_prefix}…</code> · expires {new Date(token.expires_at).toLocaleDateString()}</div></div><span style={{ ...status, color: token.revoked_at || expired ? '#8A3A3A' : '#217346', background: token.revoked_at || expired ? '#FBECEC' : '#EAF7EF' }}>{token.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active'}</span>{!token.revoked_at && <button type="button" onClick={() => void revokeConnection(token.id)} disabled={mcpBusy || needsMfaStepUp} style={revokeButton}><Ban size={14} /> Revoke</button>}</div> })}</div>
          </>}
          {mcpMessage && <p role="status" style={success}><Check size={15} /> {mcpMessage}</p>}
          {mcpError && mcpTokens.length > 0 && <p role="alert" style={errorStyle}>{mcpError}</p>}
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
const mcpPanel = { marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.1)' }
const mcpTitleRow = { display: 'flex', alignItems: 'flex-start', gap: 12 }
const mcpIcon = { width: 40, height: 40, flex: '0 0 auto', borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.14)', color: '#D4A853' }
const mcpNotice = { marginTop: 14, padding: '11px 12px', borderRadius: 10, background: 'rgba(91,141,239,.1)', color: '#C6D8F7', fontSize: 12.5, lineHeight: 1.5 }
const tokenBox = { marginTop: 16, padding: 14, borderRadius: 12, background: '#0F1218', border: '1px solid rgba(212,168,83,.35)' }
const tokenRow = { display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 8 }
const tokenCode = { flex: 1, minWidth: 0, overflowWrap: 'anywhere' as const, padding: '10px 11px', borderRadius: 8, background: '#090B0F', color: '#F0EDE7', fontSize: 12 }
const copyButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: 0, borderRadius: 8, background: '#D4A853', color: '#15110A', fontWeight: 700, cursor: 'pointer' }
const tokenList = { display: 'grid', gap: 8, marginTop: 16 }
const tokenItem = { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 10, background: '#0F1218', border: '1px solid rgba(255,255,255,.1)', fontSize: 13 }
const tokenMeta = { color: '#8F98A5', fontSize: 11, marginTop: 4 }
const revokeButton = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 8px', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, background: 'transparent', color: '#F7A6A6', cursor: 'pointer', fontSize: 11 }
const mutedError = { color: '#D8CFBF', fontSize: 12.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.05)' }
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
