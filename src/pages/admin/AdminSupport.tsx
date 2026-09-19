import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, RefreshCw, Search, X } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { adminListSupportRequests, adminResolveSubdomainRequest, type SupportRequest } from '../../lib/api/support'
import { friendlyError } from '../../lib/errors'

export default function AdminSupport() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | SupportRequest['status']>('all')
  const [selected, setSelected] = useState<SupportRequest | null>(null)
  const [newSubdomain, setNewSubdomain] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setRequests(await adminListSupportRequests()) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return requests.filter(request => {
      const matchesStatus = status === 'all' || request.status === status
      const matchesQuery = !term || `${request.businessName} ${request.ownerName} ${request.ownerEmail} ${request.ownerPlatformId} ${request.currentSubdomain} ${request.requestedSubdomain ?? ''}`.toLowerCase().includes(term)
      return matchesStatus && matchesQuery
    })
  }, [query, requests, status])

  function open(request: SupportRequest) {
    setSelected(request)
    setNewSubdomain(request.requestedSubdomain ?? '')
    setNote(request.resolutionNote ?? '')
    setSaved('')
  }

  async function resolve(approved: boolean) {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const updated = await adminResolveSubdomainRequest({ id: selected.id, approved, newSubdomain, resolutionNote: note })
      setRequests(current => current.map(request => request.id === updated.id ? updated : request))
      setSelected(updated)
      setSaved(approved ? 'Address approved and updated.' : 'Request rejected and owner notified.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div><div style={eyebrow}>OWNER SUPPORT</div><h1 style={heading}>Support requests</h1><p style={subheading}>Review protected website-address requests and keep every resolution accountable.</p></div>
        <button type="button" onClick={() => void load()} style={refreshButton}><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <div style={toolbar}>
        <label style={{ position: 'relative', flex: '1 1 260px' }}><Search size={15} color="rgba(10,12,16,.4)" style={{ position: 'absolute', left: 11, top: 11 }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search owner, business, platform ID…" style={{ ...input, paddingLeft: 34, width: '100%' }} /></label>
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)} style={input}><option value="all">All statuses</option><option value="requested">Requested</option><option value="under_review">Under review</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select>
      </div>
      <div style={summary}><span><strong>{filtered.length}</strong> visible requests</span><span><strong>{requests.filter(request => request.status === 'requested').length}</strong> awaiting review</span></div>
      <section style={panel}>
        {loading ? <div style={empty}>Loading support requests…</div> : filtered.length === 0 ? <div style={empty}>No support requests match these filters.</div> : filtered.map(request => <button type="button" key={request.id} onClick={() => open(request)} style={requestRow}>
          <div style={{ minWidth: 210, textAlign: 'left' }}><strong>{request.businessName}</strong><small>{request.ownerName} · {request.ownerPlatformId}</small></div>
          <div style={{ minWidth: 200, textAlign: 'left' }}><span style={address}>{request.currentSubdomain}.abrobiz.com</span><span style={{ color: '#8A6417', margin: '0 7px' }}>→</span><span style={address}>{request.requestedSubdomain ?? '—'}.abrobiz.com</span></div>
          <span style={{ ...statusBadge, color: statusColor(request.status), background: `${statusColor(request.status)}14` }}>{request.status.replace('_', ' ')}</span>
          <small style={{ color: 'rgba(10,12,16,.45)', whiteSpace: 'nowrap' }}>{new Date(request.createdAt).toLocaleDateString()}</small>
        </button>)}
      </section>
      {selected && <div role="dialog" aria-modal="true" style={overlay} onClick={() => setSelected(null)}><aside onClick={event => event.stopPropagation()} style={drawer}><button type="button" onClick={() => setSelected(null)} aria-label="Close" style={close}><X size={17} /></button><div style={eyebrow}>REQUEST DETAIL</div><h2 style={{ ...heading, fontSize: 22, marginTop: 7 }}>{selected.businessName}</h2><div style={muted}>{selected.ownerName} · {selected.ownerEmail || 'No email'} · {selected.ownerPlatformId}</div><div style={details}><Detail label="Current address" value={`${selected.currentSubdomain}.abrobiz.com`} /><Detail label="Requested address" value={`${selected.requestedSubdomain ?? '—'}.abrobiz.com`} /><Detail label="Submitted" value={new Date(selected.createdAt).toLocaleString()} /><Detail label="Owner message" value={selected.message || 'No message provided'} /></div>{selected.status === 'requested' || selected.status === 'under_review' ? <><label style={fieldLabel}>Approved address<input value={newSubdomain} onChange={event => setNewSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={input} /></label><label style={fieldLabel}>Resolution note<textarea value={note} onChange={event => setNote(event.target.value)} rows={4} maxLength={1000} style={{ ...input, resize: 'vertical' }} /></label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" disabled={busy || newSubdomain.trim().length < 3} onClick={() => void resolve(true)} style={approveButton}><Check size={14} /> {busy ? 'Saving…' : 'Approve and update'}</button><button type="button" disabled={busy} onClick={() => void resolve(false)} style={rejectButton}><X size={14} /> Reject</button></div></> : <div style={resolved}><Clock3 size={15} /> Resolved: {selected.status}{selected.resolutionNote ? ` — ${selected.resolutionNote}` : ''}</div>}{saved && <div style={success}>{saved}</div>}</aside></div>}
    </AdminLayout>
  )
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function statusColor(status: SupportRequest['status']) { return status === 'completed' ? '#16803C' : status === 'rejected' ? '#B42318' : '#9A6B16' }

const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 25, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,.52)', fontSize: 14, margin: '5px 0 0', lineHeight: 1.55 }
const eyebrow: React.CSSProperties = { color: '#9A6B16', fontSize: 10.5, letterSpacing: 1.7, fontWeight: 750 }
const toolbar: React.CSSProperties = { display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 10 }
const input: React.CSSProperties = { border: '1px solid rgba(10,12,16,.12)', borderRadius: 9, padding: '9px 11px', fontSize: 13, outline: 'none', background: '#fff', color: '#0A0C10' }
const summary: React.CSSProperties = { display: 'flex', gap: 18, color: 'rgba(10,12,16,.5)', fontSize: 12.5, marginBottom: 12 }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,.06)', borderRadius: 16, overflow: 'hidden' }
const requestRow: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', border: 0, borderBottom: '1px solid rgba(10,12,16,.06)', background: '#fff', padding: '15px 17px', cursor: 'pointer', textAlign: 'left' }
const address: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, color: '#0A0C10' }
const statusBadge: React.CSSProperties = { padding: '5px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }
const empty: React.CSSProperties = { padding: 30, color: 'rgba(10,12,16,.45)', fontSize: 13.5, textAlign: 'center' }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,.12)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,7,10,.58)', display: 'flex', justifyContent: 'flex-end' }
const drawer: React.CSSProperties = { position: 'relative', width: 'min(470px, 100%)', height: '100%', overflowY: 'auto', background: '#fff', padding: '30px 24px', boxShadow: '-20px 0 60px rgba(0,0,0,.18)' }
const close: React.CSSProperties = { position: 'absolute', top: 18, right: 18, width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, borderRadius: 99, background: '#F6F3EE', color: '#0A0C10', cursor: 'pointer' }
const muted: React.CSSProperties = { color: 'rgba(10,12,16,.5)', fontSize: 12.5, lineHeight: 1.55 }
const details: React.CSSProperties = { display: 'grid', gap: 14, margin: '24px 0', padding: '16px 0', borderTop: '1px solid rgba(10,12,16,.08)', borderBottom: '1px solid rgba(10,12,16,.08)' }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 6, marginBottom: 13, color: 'rgba(10,12,16,.55)', fontSize: 12 }
const approveButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 9, padding: '10px 13px', background: '#D4A853', color: '#0A0C10', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const rejectButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(180,35,24,.25)', borderRadius: 9, padding: '10px 13px', background: '#FFF5F3', color: '#B42318', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const resolved: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: 12, borderRadius: 9, background: '#F4FAF5', color: '#16803C', fontSize: 12.5 }
const success: React.CSSProperties = { marginTop: 14, color: '#16803C', fontSize: 12.5 }
