import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { recordMarketingPolicyAcceptance } from '../lib/api/marketingPolicy'
import { safeInternalPath } from '../lib/safeUrl'

export default function MarketingPolicy() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshProfile } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!accepted) { setError('Please accept the Marketing Partner Policy to continue.'); return }
    setLoading(true); setError('')
    try {
      await recordMarketingPolicyAcceptance()
      await refreshProfile()
      const from = safeInternalPath((location.state as { from?: { pathname?: string } } | null)?.from?.pathname, '/admin/marketing')
      navigate(from, { replace: true })
    } catch { setError('We could not save your policy acceptance. Please try again.') } finally { setLoading(false) }
  }

  return <div style={page}><div style={card}><div style={icon}><ShieldCheck size={23} /></div><div style={eyebrow}>ABROBIZ PARTNER PROGRAM</div><h1 style={heading}>Marketing Partner Policy</h1><p style={muted}>This policy applies to Marketing Admins and Sales Persons who refer business owners to AbroBiz.</p><section><h2>Commission and payment</h2><p>Commission is created only after a referred owner makes a verified full payment for an active plan. Registration alone does not create commission. The active commission rule is shown in the Marketing workspace; the standard rule is 20% for the Sales Person, 5% for the Marketing Admin, and 75% for AbroBiz.</p></section><section><h2>Attribution and conduct</h2><p>Each owner has one locked acquisition attribution. Do not create false, duplicate, self-referred, or unauthorized accounts, and do not promise pricing, access, or commission outside approved AbroBiz materials.</p></section><section><h2>Verification, reversals, and access</h2><p>Commissions remain subject to payment verification, review, payout approval, and any refund or dispute review. Reversed payments create an auditable reversal entry. AbroBiz may suspend partner access for abuse, fraud, misleading promotion, privacy violations, or breach of this policy.</p></section><form onSubmit={submit}><label style={check}><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={loading} /> <span>I have read and agree to the AbroBiz Marketing Partner Policy.</span></label>{error && <div role="alert" style={errorBox}>{error}</div>}<button type="submit" disabled={loading} style={button}>{loading ? <><Loader2 size={16} /> Saving…</> : <><CheckCircle2 size={16} /> Accept and continue</>}</button></form></div><style>{'@keyframes marketing-policy-spin { to { transform: rotate(360deg); } }'}</style></div>
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#0A0C10', display: 'grid', placeItems: 'center', padding: 20, color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }
const card: React.CSSProperties = { width: '100%', maxWidth: 620, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 22, padding: '34px clamp(22px, 5vw, 44px)' }
const icon: React.CSSProperties = { width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.15)', color: '#D4A853', marginBottom: 18 }
const eyebrow: React.CSSProperties = { color: '#D4A853', letterSpacing: 1.5, fontSize: 10.5, fontWeight: 700 }
const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 30, margin: '9px 0 8px' }
const muted: React.CSSProperties = { color: 'rgba(240,237,231,.58)', lineHeight: 1.65, fontSize: 14, marginBottom: 24 }
const check: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, color: 'rgba(240,237,231,.72)', fontSize: 13, lineHeight: 1.55, margin: '24px 0 13px', cursor: 'pointer' }
const errorBox: React.CSSProperties = { color: '#F87171', background: 'rgba(248,113,113,.09)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5, marginBottom: 12 }
const button: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 10, padding: 13, background: '#D4A853', color: '#0A0C10', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }
