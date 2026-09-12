import { useEffect, useState } from 'react'
import { Check, Search, ShieldCheck, UserRound } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { ADMIN_ROLES, assignAdminRole, listPlatformUsers, type AdminUserRow } from '../../lib/api/adminControl'
import { friendlyError } from '../../lib/errors'

export default function AdminManagement() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load(term = search) { setLoading(true); setError(''); try { setUsers(await listPlatformUsers(term)) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) } }
  useEffect(() => { void load('') }, [])
  async function changeRole(user: AdminUserRow, role: AdminUserRow['adminRole']) {
    if (role === user.adminRole) return
    setBusy(user.id); setError('')
    try { const updated = await assignAdminRole(user.id, role); setUsers(current => current.map(row => row.id === updated.id ? updated : row)) } catch (err) { setError(friendlyError(err)) } finally { setBusy(null) }
  }

    return <AdminLayout>
    <div style={{ marginBottom: 24 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><ShieldCheck size={21} color="#B98522" /><h1 style={heading}>Admin management</h1></div><p style={subheading}>Assign least-privilege roles, identify every account by its platform ID, and keep administrator access accountable.</p></div>
    {error && <div style={errorBox}>{error}</div>}
    <div style={{ display: 'flex', gap: 9, marginBottom: 16, maxWidth: 620 }}><div style={{ position: 'relative', flex: 1 }}><Search size={15} color="rgba(10,12,16,0.35)" style={{ position: 'absolute', left: 12, top: 11 }} /><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void load() }} placeholder="Search platform ID, name, or email" style={{ ...input, width: '100%', paddingLeft: 34 }} /></div><button type="button" onClick={() => void load()} style={button}>Search</button></div>
    <div style={roleGuide}>{ADMIN_ROLES.filter(role => role.value !== 'none').map(role => <div key={role.value} style={roleGuideItem}><strong>{role.label}</strong><span>{role.description}</span></div>)}</div>
    <div style={panel}><div style={tableHeader}><span>Account</span><span>Platform ID</span><span>Access role</span><span>Action</span></div>{loading ? <div style={empty}>Loading users…</div> : users.length === 0 ? <div style={empty}>No users found.</div> : users.map(user => <div key={user.id} style={tableRow}><div style={{ minWidth: 180 }}><div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 650, fontSize: 13.5 }}><UserRound size={14} color="#B98522" />{user.name}</div><div style={muted}>{user.email} · {user.businessName ?? 'No business yet'}</div></div><code style={code}>{user.platformId}</code><div><span style={{ ...roleBadge, background: user.adminRole === 'none' ? '#F2F3F5' : '#FFF4D8', color: user.adminRole === 'none' ? '#59616E' : '#72551D' }}>{user.adminRole === 'none' ? 'Owner' : user.adminRole.replace('_', ' ')}</span><div style={{ ...muted, marginTop: 4 }}>{user.role}</div></div><select disabled={busy === user.id} value={user.adminRole} onChange={event => void changeRole(user, event.target.value as AdminUserRow['adminRole'])} style={select}>{ADMIN_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>)}</div>
    <div style={{ ...panel, marginTop: 16, background: '#0A0C10', color: '#F0EDE7' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 650, fontSize: 14 }}><Check size={15} color="#D4A853" /> Safe role assignment</div><p style={{ color: 'rgba(240,237,231,0.58)', fontSize: 12.5, lineHeight: 1.6, margin: '8px 0 0' }}>Role changes are validated inside PostgreSQL. An administrator cannot promote themselves, change their own access, or remove the last super administrator. Every successful change is recorded with the acting administrator’s platform ID.</p></div>
  </AdminLayout>
}

const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,0.52)', fontSize: 14, margin: '6px 0 0', maxWidth: 700, lineHeight: 1.55 }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 18, padding: 18, boxShadow: '0 8px 30px rgba(10,12,16,0.035)', overflowX: 'auto' }
const tableHeader: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr', gap: 14, padding: '0 8px 10px', color: 'rgba(10,12,16,0.42)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 700 }
const tableRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr', alignItems: 'center', gap: 14, padding: '14px 8px', borderTop: '1px solid rgba(10,12,16,0.06)', minWidth: 700 }
const input: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.12)', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const select: React.CSSProperties = { ...input, background: '#fff', cursor: 'pointer' }
const button: React.CSSProperties = { border: 'none', borderRadius: 10, background: '#0A0C10', color: '#fff', padding: '9px 15px', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const muted: React.CSSProperties = { color: 'rgba(10,12,16,0.46)', fontSize: 11.5, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const code: React.CSSProperties = { fontSize: 11.5, color: '#72551D', background: '#FFF8E8', padding: '5px 7px', borderRadius: 6, whiteSpace: 'nowrap' }
const roleBadge: React.CSSProperties = { display: 'inline-block', fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '5px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }
const empty: React.CSSProperties = { padding: 24, color: 'rgba(10,12,16,0.45)', fontSize: 13, textAlign: 'center' }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
const roleGuide: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }
const roleGuideItem: React.CSSProperties = { background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'rgba(10,12,16,0.52)' }
