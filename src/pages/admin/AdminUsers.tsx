import { useEffect, useState } from 'react'
import { Check, Copy, Mail, Phone, RefreshCw, Search, UserRound } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { listPlatformUsers, type AdminUserRow } from '../../lib/api/adminControl'
import { friendlyError } from '../../lib/errors'

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function load(manual = false, term = query) {
    if (manual) setRefreshing(true)
    setError('')
    try { setUsers(await listPlatformUsers(term)) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { void load(false, '') }, [])
  async function copyId(id: string) {
    try { await navigator.clipboard.writeText(id); setCopied(id); window.setTimeout(() => setCopied(current => current === id ? '' : current), 1400) } catch { /* Clipboard is optional on older phones. */ }
  }

  return <AdminLayout>
    <div style={header}><div><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><UserRound size={21} color="#B98522" /><h1 style={heading}>User directory</h1></div><p style={subheading}>Resolve account questions quickly with a searchable, platform-wide view of users and their businesses.</p></div><button type="button" onClick={() => void load(true)} disabled={refreshing} style={refreshButton}><RefreshCw size={14} style={{ animation: refreshing ? 'abrobiz-spin .8s linear infinite' : 'none' }} /> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    <div style={stats}><Stat label="Loaded accounts" value={users.length} /><Stat label="Business owners" value={users.filter(user => user.adminRole === 'none').length} /><Stat label="Administrators" value={users.filter(user => user.adminRole !== 'none').length} /></div>
    <form onSubmit={event => { event.preventDefault(); void load() }} style={searchBar}><div style={{ position: 'relative', flex: 1, minWidth: 220 }}><Search size={15} color="rgba(10,12,16,0.35)" style={{ position: 'absolute', left: 12, top: 11 }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search platform ID, email, phone, or name" style={{ ...input, width: '100%', paddingLeft: 35 }} /></div><button type="submit" style={searchButton}>Search</button></form>
    {error && <div style={errorBox}>{error}</div>}
    <div style={panel}>{loading ? <div style={empty}>Loading account directory…</div> : users.length === 0 ? <div style={empty}>No account matched that search.</div> : users.map(user => <UserCard key={user.id} user={user} copied={copied === user.platformId} onCopy={() => void copyId(user.platformId)} />)}</div>
    <style>{'@keyframes abrobiz-spin { to { transform: rotate(360deg); } }'}</style>
  </AdminLayout>
}

function UserCard({ user, copied, onCopy }: { user: AdminUserRow; copied: boolean; onCopy: () => void }) {
  const isAdmin = user.adminRole !== 'none'
  return <article style={card}><div style={avatar}>{user.name.slice(0, 1).toUpperCase()}</div><div style={{ flex: 1, minWidth: 210 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><strong style={{ fontSize: 14 }}>{user.name}</strong><span style={{ ...badge, background: isAdmin ? '#FFF4D8' : '#EEF7F1', color: isAdmin ? '#72551D' : '#217346' }}>{isAdmin ? user.adminRole.replace('_', ' ') : 'Business owner'}</span></div><div style={idLine}><code>{user.platformId}</code><button type="button" onClick={onCopy} style={copyButton} aria-label={`Copy ${user.platformId}`}>{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy ID'}</button></div><div style={contactLine}>{user.email !== '—' && <a href={`mailto:${user.email}`}><Mail size={13} />{user.email}</a>}{user.phone !== '—' && <a href={`tel:${user.phone}`}><Phone size={13} />{user.phone}</a>}</div></div><div style={business}><span>Business</span><strong>{user.businessName ?? 'Not configured'}</strong><small>Joined {new Date(user.createdAt).toLocaleDateString()}</small></div></article>
}

function Stat({ label, value }: { label: string; value: number }) { return <div style={stat}><strong>{value}</strong><span>{label}</span></div> }
const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,0.52)', fontSize: 14, margin: '6px 0 0', lineHeight: 1.55, maxWidth: 720 }
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }
const stats: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }
const stat: React.CSSProperties = { background: '#0A0C10', color: '#F0EDE7', borderRadius: 14, padding: '15px 17px' }
const searchBar: React.CSSProperties = { display: 'flex', gap: 9, flexWrap: 'wrap', padding: 12, background: '#fff', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 15, marginBottom: 14 }
const input: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.12)', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const searchButton: React.CSSProperties = { border: 0, borderRadius: 10, background: '#D4A853', color: '#0A0C10', padding: '9px 17px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 10, padding: '9px 13px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 }
const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '15px 17px', background: '#fff', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 16, boxShadow: '0 7px 24px rgba(10,12,16,0.03)', flexWrap: 'wrap' }
const avatar: React.CSSProperties = { width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', background: '#F6F3EE', color: '#72551D', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16 }
const badge: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 999, textTransform: 'capitalize' }
const idLine: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, color: '#72551D', fontSize: 11.5 }
const copyButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#946F1F', padding: 0, cursor: 'pointer', fontSize: 11 }
const contactLine: React.CSSProperties = { display: 'flex', gap: 12, marginTop: 7, flexWrap: 'wrap' }
const business: React.CSSProperties = { minWidth: 145, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5 }
const empty: React.CSSProperties = { padding: 30, textAlign: 'center', color: 'rgba(10,12,16,0.45)', fontSize: 13, background: '#fff', borderRadius: 16 }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
