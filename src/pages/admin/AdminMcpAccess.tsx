import { useCallback, useEffect, useState } from 'react'
import { Bot, Check, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { friendlyError } from '../../lib/errors'
import { listMcpAccessRequests, reviewMcpAccessRequest, type McpAccessDecision, type McpAccessRequest, type McpAccessStatus } from '../../lib/api/mcp'

type Filter = McpAccessStatus | 'all'

export default function AdminMcpAccess() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [requests, setRequests] = useState<McpAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRequests(await listMcpAccessRequests(filter)) }
    catch (reason) { setError(friendlyError(reason)) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { void load() }, [load])

  async function review(row: McpAccessRequest, decision: McpAccessDecision) {
    const label = decision === 'approved' ? 'approve MCP access for' : decision === 'rejected' ? 'reject the MCP access request from' : 'revoke MCP access for'
    if (!window.confirm(`Are you sure you want to ${label} ${row.name || row.email || row.platform_id || 'this account'}?`)) return
    setBusyId(row.user_id); setError(''); setMessage('')
    try {
      await reviewMcpAccessRequest(row.user_id, decision)
      setMessage(decision === 'approved' ? 'MCP access approved.' : decision === 'rejected' ? 'MCP access request rejected.' : 'MCP access revoked; existing MCP credentials were disabled.')
      await load()
    } catch (reason) { setError(friendlyError(reason)) }
    finally { setBusyId(null) }
  }

  return <AdminLayout>
    <header style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Bot size={21} color="#B98522" /><h1 style={heading}>MCP access approvals</h1></div>
      <p style={subheading}>Only super administrators can approve access. Every decision is audited; rejecting or revoking access disables existing MCP credentials immediately.</p>
    </header>
    {error && <div role="alert" style={errorBox}>{error}</div>}
    {message && <div role="status" style={successBox}>{message}</div>}
    <section style={panel}>
      <div style={toolbar}>
        <div style={filters}>
          {(['pending', 'approved', 'rejected', 'revoked', 'all'] as Filter[]).map(status => <button key={status} type="button" onClick={() => setFilter(status)} aria-pressed={filter === status} style={{ ...filterButton, ...(filter === status ? activeFilter : {}) }}>{status === 'all' ? 'All requests' : status[0].toUpperCase() + status.slice(1)}</button>)}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={refreshButton}><RefreshCw size={14} /> Refresh</button>
      </div>
      {loading ? <div style={empty}><Clock3 size={17} /> Loading access requests…</div> : requests.length === 0 ? <div style={empty}><ShieldCheck size={20} /> No {filter === 'all' ? '' : `${filter} `}MCP access requests.</div> : <div style={list}>
        {requests.map(row => <article key={row.user_id} style={requestRow}>
          <div style={identity}>
            <div style={nameLine}><strong>{row.name || 'AbroBiz account'}</strong><span style={{ ...badge, ...statusStyle(row.status) }}>{row.status}</span></div>
            <div style={details}>{row.email || 'No email'} · {row.role}{row.admin_role && row.admin_role !== 'none' ? ` / ${row.admin_role.replaceAll('_', ' ')}` : ''}</div>
            <div style={details}>Platform ID: <code>{row.platform_id || '—'}</code> · Requested {new Date(row.requested_at).toLocaleString()}</div>
            {row.reviewed_at && <div style={details}>Reviewed {new Date(row.reviewed_at).toLocaleString()}</div>}
          </div>
          <div style={actions}>
            {row.status !== 'approved' && <button type="button" onClick={() => void review(row, 'approved')} disabled={busyId === row.user_id} style={approve}><Check size={14} /> Approve</button>}
            {row.status === 'pending' && <button type="button" onClick={() => void review(row, 'rejected')} disabled={busyId === row.user_id} style={reject}><X size={14} /> Reject</button>}
            {row.status === 'approved' && <button type="button" onClick={() => void review(row, 'revoked')} disabled={busyId === row.user_id} style={reject}><X size={14} /> Revoke</button>}
          </div>
        </article>)}
      </div>}
      <p style={footnote}>Super administrator accounts are exempt. Approval grants MCP connectivity only; it never overrides role permissions, business ownership, MFA, or scope checks.</p>
    </section>
  </AdminLayout>
}

function statusStyle(status: McpAccessRequest['status']): React.CSSProperties {
  if (status === 'approved') return { color: '#217346', background: '#EAF7EF' }
  if (status === 'pending') return { color: '#805A0C', background: '#FFF4D8' }
  return { color: '#9D3129', background: '#FBECEC' }
}

const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,.55)', fontSize: 14, maxWidth: 760, lineHeight: 1.6, margin: '7px 0 0' }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,.08)', borderRadius: 17, padding: 18, boxShadow: '0 8px 28px rgba(10,12,16,.035)' }
const toolbar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }
const filters: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
const filterButton: React.CSSProperties = { border: '1px solid rgba(10,12,16,.12)', borderRadius: 9, background: '#fff', color: '#48505B', padding: '8px 10px', fontSize: 12, cursor: 'pointer' }
const activeFilter: React.CSSProperties = { background: '#0A0C10', color: '#fff', borderColor: '#0A0C10' }
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,.12)', borderRadius: 9, background: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 12 }
const list: React.CSSProperties = { display: 'grid' }
const requestRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '15px 4px', borderTop: '1px solid rgba(10,12,16,.07)', flexWrap: 'wrap' }
const identity: React.CSSProperties = { flex: '1 1 320px', minWidth: 0 }
const nameLine: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 14, color: '#171A20' }
const badge: React.CSSProperties = { display: 'inline-block', padding: '4px 8px', borderRadius: 999, textTransform: 'capitalize', fontSize: 10.5, fontWeight: 700 }
const details: React.CSSProperties = { marginTop: 5, color: 'rgba(10,12,16,.52)', fontSize: 11.5, overflowWrap: 'anywhere' }
const actions: React.CSSProperties = { display: 'flex', gap: 7, flexWrap: 'wrap' }
const approve: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 8, padding: '8px 10px', background: '#166B43', color: '#fff', fontSize: 11.5, fontWeight: 650, cursor: 'pointer' }
const reject: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #E5B6B3', borderRadius: 8, padding: '8px 10px', background: '#fff', color: '#9D3129', fontSize: 11.5, fontWeight: 650, cursor: 'pointer' }
const empty: React.CSSProperties = { minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(10,12,16,.48)', fontSize: 13 }
const footnote: React.CSSProperties = { borderTop: '1px solid rgba(10,12,16,.07)', margin: '12px 0 0', paddingTop: 12, color: 'rgba(10,12,16,.48)', fontSize: 11.5, lineHeight: 1.55 }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
const successBox: React.CSSProperties = { color: '#166B43', background: '#EAF7EF', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
