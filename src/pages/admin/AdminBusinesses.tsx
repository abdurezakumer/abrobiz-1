import { useEffect, useState } from 'react'
import { Search, ExternalLink, Ban, CheckCircle, Mail, RefreshCw } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { adminListBusinesses, adminSetBlocked, type AdminBusinessRow } from '../../lib/api/businesses'
import { publicStorefrontUrl } from '../../lib/storefrontUrl'
import { friendlyError } from '../../lib/errors'

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<AdminBusinessRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load(manual = false) {
    if (manual) setRefreshing(true)
    setError('')
    try { setBusinesses(await adminListBusinesses()) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { void load() }, [])

  async function toggleBlock(b: AdminBusinessRow) {
    if (!b.isBlocked) {
      const reason = prompt('Reason for blocking this business (shown internally only):') ?? 'Blocked by admin'
      await adminSetBlocked(b.id, true, reason)
    } else {
      await adminSetBlocked(b.id, false)
    }
    await load()
  }

  const filtered = businesses.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) || b.slug.includes(query.toLowerCase()))

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}><div><h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', margin: '0 0 4px' }}>Businesses</h1><p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, margin: 0 }}>{businesses.length} loaded for operational review.</p></div><button type="button" onClick={() => void load(true)} disabled={refreshing} style={refreshBtn}><RefreshCw size={14} style={{ animation: refreshing ? 'abrobiz-spin .8s linear infinite' : 'none' }} /> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      {error && <div style={errorBox}>{error}</div>}

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 18 }}>
        <Search size={15} color="rgba(10,12,16,0.35)" style={{ position: 'absolute', left: 12, top: 11 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search businesses…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: '1px solid rgba(10,12,16,0.1)', fontSize: 13.5, outline: 'none' }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, fontSize: 13.5, color: 'rgba(10,12,16,0.4)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13.5, color: 'rgba(10,12,16,0.4)' }}>No businesses found.</div>
        ) : (
          filtered.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(10,12,16,0.05)', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {b.name}
                  {b.isBlocked && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 6px', borderRadius: 5 }}>BLOCKED</span>}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.4)' }}>/{b.slug} · owner: {b.ownerName}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.38)', marginTop: 3 }}>{b.ownerPlatformId}{b.ownerEmail ? ` · ${b.ownerEmail}` : ''}</div>
              </div>

              <div style={{ fontSize: 12, color: b.subscriptionStatus === 'active' ? '#16A34A' : b.subscriptionStatus === 'trial' ? '#D97706' : '#DC2626', fontWeight: 600, textTransform: 'capitalize' }}>
                {b.subscriptionStatus ?? '—'}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {b.ownerEmail && <a href={`mailto:${b.ownerEmail}`} style={iconBtn} title="Email owner"><Mail size={14} /></a>}
                <a href={publicStorefrontUrl(b.slug)} target="_blank" rel="noopener noreferrer" style={iconBtn}><ExternalLink size={14} /></a>
                <button onClick={() => toggleBlock(b)} style={{ ...iconBtn, color: b.isBlocked ? '#16A34A' : '#DC2626' }} title={b.isBlocked ? 'Unblock' : 'Block'}>
                  {b.isBlocked ? <CheckCircle size={14} /> : <Ban size={14} />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  border: '1px solid rgba(10,12,16,0.1)', background: '#fff', cursor: 'pointer', textDecoration: 'none', color: '#0A0C10',
}
const refreshBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
