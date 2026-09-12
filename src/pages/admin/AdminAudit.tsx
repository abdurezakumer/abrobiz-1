import { useEffect, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { listAdminAudit, type AdminAuditRow } from '../../lib/api/adminControl'
import { friendlyError } from '../../lib/errors'

export default function AdminAudit() {
  const [rows, setRows] = useState<AdminAuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() { setLoading(true); setError(''); try { setRows(await listAdminAudit()) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  return <AdminLayout><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}><div><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><ClipboardList size={21} color="#B98522" /><h1 style={heading}>Audit trail</h1></div><p style={subheading}>A traceable record of administrator actions across payments, businesses, and access control.</p></div><button type="button" onClick={() => void load()} style={button}><RefreshCw size={14} /> Refresh</button></div>{error && <div style={errorBox}>{error}</div>}<div style={panel}>{loading ? <div style={empty}>Loading audit events…</div> : rows.length === 0 ? <div style={empty}>No administrator events recorded yet.</div> : rows.map(row => <div key={row.id} style={rowStyle}><div style={{ minWidth: 170 }}><strong style={{ fontSize: 13 }}>{row.action.replaceAll('_', ' ')}</strong><small>{row.adminName} · {row.adminPlatformId}</small></div><div style={{ color: 'rgba(10,12,16,0.5)', fontSize: 12 }}>{row.targetTable ?? 'platform'}{row.targetId ? ` · ${row.targetId.slice(0, 8)}…` : ''}</div><time style={{ color: 'rgba(10,12,16,0.42)', fontSize: 11.5 }}>{new Date(row.createdAt).toLocaleString()}</time></div>)}</div></AdminLayout>
}

const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,0.52)', fontSize: 14, margin: '6px 0 0', lineHeight: 1.55 }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 18, padding: '8px 18px', boxShadow: '0 8px 30px rgba(10,12,16,0.035)' }
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(10,12,16,0.06)' }
const button: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 10, padding: '9px 13px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const empty: React.CSSProperties = { padding: 24, color: 'rgba(10,12,16,0.45)', fontSize: 13, textAlign: 'center' }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
