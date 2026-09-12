import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, ImageOff, RefreshCw, Download, Search } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { adminListPendingPayments, adminListAllPayments, adminApprovePayment, adminRejectPayment, getPaymentProofUrl } from '../../lib/api/payments'
import type { Payment } from '../../types'
import { safeImageUrl } from '../../lib/safeUrl'
import { friendlyError } from '../../lib/errors'

export default function AdminPayments() {
  const [pending, setPending] = useState<Payment[]>([])
  const [history, setHistory] = useState<Payment[]>([])
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [p, h] = await Promise.all([adminListPendingPayments(), adminListAllPayments()])
      setPending(p)
      setHistory(h.filter(x => x.status !== 'pending'))
      for (const payment of p) {
        if (payment.proofUrl && !proofUrls[payment.id]) {
          getPaymentProofUrl(payment.proofUrl).then(url => setProofUrls(prev => ({ ...prev, [payment.id]: url }))).catch(() => {})
        }
      }
    } catch (err) {
      setError(friendlyError(err))
      throw err
    }
  }

  async function refreshPayments() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load().catch(() => {})
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load().catch(() => {})
    }, 10000)
    return () => window.clearInterval(timer)
  }, [])

  async function handleApprove(id: string) {
    setBusyId(id)
    try {
      await adminApprovePayment(id)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Reason for rejecting (shown to the business owner):')
    if (reason === null) return
    setBusyId(id)
    try {
      await adminRejectPayment(id, reason)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  function exportCsv() {
    const rows = [...pending, ...history]
    const csv = [['Payment ID', 'Business', 'Plan', 'Amount ETB', 'Status', 'Created'], ...rows.map(payment => [payment.id, payment.business?.name ?? 'Business', payment.plan?.name ?? '', String(payment.amountEtb), payment.status, payment.createdAt])]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `abrobiz-payments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredHistory = history.filter(payment => (statusFilter === 'all' || payment.status === statusFilter) && (payment.business?.name ?? '').toLowerCase().includes(query.toLowerCase()))

  return (
    <AdminLayout>
      <style>{'@keyframes abrobiz-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', margin: '0 0 4px' }}>Payments</h1>
          <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, margin: 0 }}>
            {pending.length} awaiting review.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={exportCsv} style={refreshBtn}><Download size={14} /> Export CSV</button>
          <button type="button" onClick={() => void refreshPayments()} disabled={refreshing || busyId !== null} style={refreshBtn}><RefreshCw size={14} style={{ animation: refreshing ? 'abrobiz-spin 0.8s linear infinite' : 'none' }} /> {refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      <div style={toolbar}><div style={{ position: 'relative', flex: '1 1 220px' }}><Search size={14} color="rgba(10,12,16,0.35)" style={{ position: 'absolute', left: 11, top: 10 }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by business" style={{ ...input, width: '100%', paddingLeft: 32 }} /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} style={input}><option value="all">All reviewed</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>

      {pending.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 30, textAlign: 'center', fontSize: 13.5, color: 'rgba(10,12,16,0.4)', marginBottom: 30 }}>
          No pending payments.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 34 }}>
          {pending.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden' }}>
              <div style={{ height: 160, background: '#F6F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {safeImageUrl(proofUrls[p.id]) ? (
                  <a href={safeImageUrl(proofUrls[p.id]) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                    <img src={safeImageUrl(proofUrls[p.id]) ?? undefined} alt="Payment proof" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ) : (
                  <ImageOff size={20} color="rgba(10,12,16,0.25)" />
                )}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.business?.name ?? 'Business'}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginTop: 2 }}>
                  {p.plan?.name} · {p.amountEtb} ETB · {new Date(p.createdAt).toLocaleDateString()}
                </div>
                {p.ownerNote && <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)', marginTop: 6, fontStyle: 'italic' }}>"{p.ownerNote}"</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => handleApprove(p.id)} disabled={busyId === p.id} style={approveBtn}>
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => handleReject(p.id)} disabled={busyId === p.id} style={rejectBtn}>
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 12 }}>History</div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden' }}>
        {history.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13.5, color: 'rgba(10,12,16,0.4)' }}>No reviewed payments yet.</div>
        ) : (
          filteredHistory.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid rgba(10,12,16,0.05)', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.business?.name} — {p.plan?.name}, {p.amountEtb} ETB</div>
                <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.4)' }}>{new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.status === 'approved' ? '#16A34A' : '#DC2626', textTransform: 'capitalize' }}>{p.status}</span>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}

const approveBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 9, padding: '9px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const rejectBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 9, padding: '9px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const refreshBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const toolbar: React.CSSProperties = { display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', padding: 11, background: '#fff', border: '1px solid rgba(10,12,16,0.06)', borderRadius: 14, marginBottom: 22 }
const input: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '8px 11px', fontSize: 12.5, outline: 'none', background: '#fff', fontFamily: 'inherit' }
const errorBox: React.CSSProperties = { color: '#B42318', background: '#FFF5F3', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }
