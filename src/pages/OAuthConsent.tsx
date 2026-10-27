import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bot, Check, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import PageLoadingSkeleton from '../components/PageLoadingSkeleton'

type ConsentInfo = {
  clientName: string
  clientUri: string | null
  redirectUri: string
  resource: string
  scopes: string[]
}

const scopeDescriptions: Record<string, string> = {
  'mcp:tools': 'Use AbroBiz MCP tools within your existing account, business, and role permissions.',
  'mcp:read': 'Read the AbroBiz information and business records that your account is already permitted to access.',
  'mcp:drafts:write': 'Create and edit marketing drafts for businesses you own. Drafts are never published or approved automatically.',
}

export default function OAuthConsent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, profile, loading: authLoading, mfa } = useAuth()
  const [info, setInfo] = useState<ConsentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const request = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/oauth/authorize-info${location.search}`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error('This connection request is invalid or has expired. Return to Claude and try connecting again.')
        return payload as ConsentInfo
      })
      .then(value => { if (active) setInfo(value) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'We could not verify this connection request.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [location.search])

  if (authLoading) return <PageLoadingSkeleton label="Checking your secure AbroBiz session" />
  if (!session) return <Navigate to="/login" state={{ from: { pathname: location.pathname, search: location.search } }} replace />

  const profileReady = Boolean(profile?.emailVerifiedAt && profile.termsAcceptedAt && profile.privacyAcceptedAt && profile.legalVersion === '2026-01')
  const admin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
  const needsMfa = Boolean(admin && mfa.required && mfa.currentLevel !== 'aal2')
  const needsMarketingPolicy = Boolean(profile && ['marketing_admin', 'sales_person'].includes(profile.adminRole) && profile.marketingPolicyVersion !== '2026-09')

  async function approve() {
    if (!session || !info || !profileReady || needsMfa || needsMarketingPolicy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(request),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || typeof payload.redirectTo !== 'string') {
        const message = payload.error === 'mfa_required'
          ? 'Complete administrator MFA before connecting an external service.'
          : payload.error === 'account_setup_required'
            ? 'Complete your AbroBiz account verification and required policies before connecting.'
            : 'We could not authorize this connection. Please retry from Claude.'
        throw new Error(message)
      }
      window.location.assign(payload.redirectTo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not authorize this connection. Please try again.')
      setBusy(false)
    }
  }

  function cancel() {
    if (!info) { navigate('/', { replace: true }); return }
    const target = new URL(info.redirectUri)
    target.searchParams.set('error', 'access_denied')
    target.searchParams.set('state', searchParams.get('state') ?? '')
    window.location.assign(target.toString())
  }

  let clientHost = ''
  try { clientHost = new URL(info?.redirectUri || '').hostname } catch { /* validated by the server */ }

  return (
    <main style={page}>
      <section style={card} aria-labelledby="oauth-title">
        <div style={brand}><span style={brandIcon}><Bot size={22} /></span><span>AbroBiz secure connection</span></div>
        {loading ? <PageLoadingSkeleton label="Verifying the requesting service" /> : error && !info ? <div role="alert" style={alert}>{error}<button type="button" onClick={() => navigate('/')} style={textButton}>Return to AbroBiz</button></div> : info ? <>
          <div style={serviceIcon}><Bot size={27} /></div>
          <h1 id="oauth-title" style={title}>Connect Claude to AbroBiz?</h1>
          <p style={description}>Claude is requesting access through its registered callback using your signed-in AbroBiz account.</p>
          <div style={account}><span style={accountDot}>{(profile?.name || session.user.email || 'A').slice(0, 1).toUpperCase()}</span><span><small style={label}>Signed in as</small><strong>{session.user.email}</strong></span></div>

          <div style={sectionHead}><ShieldCheck size={17} /> Requested permissions</div>
          <div style={scopeList}>
            {info.scopes.map(scope => <div key={scope} style={scopeItem}><span style={check}><Check size={14} /></span><div><strong>{scope === 'mcp:drafts:write' ? 'Manage marketing drafts' : 'Read and use authorized AbroBiz tools'}</strong><p>{scopeDescriptions[scope] ?? 'Access is limited to your existing AbroBiz permissions.'}</p></div></div>)}
          </div>
          <p style={boundary}>AbroBiz still enforces your account role, MFA, and business ownership on every request. This does not grant access to other users’ private data.</p>
          {needsMfa && <div role="note" style={alert}>Administrator MFA is required. <button type="button" onClick={() => navigate('/security/mfa', { state: { from: { pathname: location.pathname, search: location.search } } })} style={textButton}>Set up MFA</button></div>}
          {needsMarketingPolicy && <div role="note" style={alert}>Accept the current marketing policy before connecting. <button type="button" onClick={() => navigate('/marketing-policy', { state: { from: { pathname: location.pathname, search: location.search } } })} style={textButton}>Review policy</button></div>}
          {!profileReady && <div role="note" style={alert}>Verify your email and accept AbroBiz’s current Terms and Privacy Policy before connecting. <button type="button" onClick={() => navigate('/legal-acceptance', { state: { from: { pathname: location.pathname, search: location.search } } })} style={textButton}>Continue setup</button></div>}
          {error && <p role="alert" style={errorText}>{error}</p>}
          <div style={actions}>
            <button type="button" onClick={cancel} disabled={busy} style={cancelButton}><X size={16} /> Cancel</button>
            <button type="button" onClick={() => void approve()} disabled={busy || !profileReady || needsMfa || needsMarketingPolicy} style={approveButton}>{busy ? 'Connecting…' : 'Approve access'} <ArrowRight size={16} /></button>
          </div>
          {clientHost && <p style={clientMeta}>Requesting service: <strong>{clientHost}</strong></p>}
        </> : null}
      </section>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(circle at top, #20283a, #080b11 55%)', color: '#f5f4f0', fontFamily: 'Inter, system-ui, sans-serif' }
const card: React.CSSProperties = { width: 'min(100%, 500px)', padding: '28px clamp(20px, 5vw, 38px)', borderRadius: 22, background: 'rgba(18,23,32,.96)', border: '1px solid rgba(255,255,255,.11)', boxShadow: '0 28px 90px rgba(0,0,0,.4)' }
const brand: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, color: '#d8dce4', fontSize: 14, fontWeight: 650 }
const brandIcon: React.CSSProperties = { width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 12, color: '#e0b65c', background: 'rgba(212,168,83,.13)' }
const serviceIcon: React.CSSProperties = { width: 58, height: 58, margin: '30px auto 16px', display: 'grid', placeItems: 'center', borderRadius: 18, color: '#e0b65c', background: 'rgba(212,168,83,.12)' }
const title: React.CSSProperties = { margin: '0 0 8px', fontSize: 25, textAlign: 'center', letterSpacing: '-.03em' }
const description: React.CSSProperties = { margin: '0 auto 22px', maxWidth: 360, textAlign: 'center', color: '#aab2c0', fontSize: 14, lineHeight: 1.6 }
const account: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 13, background: '#10151e', border: '1px solid rgba(255,255,255,.08)', fontSize: 13 }
const accountDot: React.CSSProperties = { width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#24344b', color: '#e5bd68', fontWeight: 700 }
const label: React.CSSProperties = { display: 'block', marginBottom: 3, color: '#8992a0', fontSize: 11 }
const sectionHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '24px 0 11px', color: '#dce1e9', fontSize: 13, fontWeight: 650 }
const scopeList: React.CSSProperties = { display: 'grid', gap: 9 }
const scopeItem: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 13, background: '#10151e', border: '1px solid rgba(255,255,255,.07)' }
const check: React.CSSProperties = { width: 23, height: 23, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 8, color: '#6ed59a', background: 'rgba(69,180,117,.12)' }
const boundary: React.CSSProperties = { margin: '14px 0 0', color: '#8f9aaa', fontSize: 12, lineHeight: 1.55 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, marginTop: 22 }
const cancelButton: React.CSSProperties = { flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 7, padding: '12px 14px', borderRadius: 11, color: '#c5ccd6', background: '#171e29', border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer', fontWeight: 600 }
const approveButton: React.CSSProperties = { flex: 1.4, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 11, color: '#11151c', background: '#e0b65c', border: 0, cursor: 'pointer', fontWeight: 700 }
const alert: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 11, color: '#f4cf8a', background: 'rgba(229,170,63,.1)', border: '1px solid rgba(229,170,63,.2)', fontSize: 13, lineHeight: 1.5 }
const errorText: React.CSSProperties = { color: '#ff9696', fontSize: 13 }
const textButton: React.CSSProperties = { display: 'block', marginTop: 7, padding: 0, color: '#edc878', background: 'none', border: 0, cursor: 'pointer', fontWeight: 650 }
const clientMeta: React.CSSProperties = { margin: '15px 0 0', color: '#737e8e', textAlign: 'center', fontSize: 11 }
