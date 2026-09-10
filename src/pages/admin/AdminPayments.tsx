import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, ImageOff } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { adminListPendingPayments, adminListAllPayments, adminApprovePayment, adminRejectPayment, getPaymentProofUrl } from '../../lib/api/payments'
import type { Payment } from '../../types'
import { safeImageUrl } from '../../lib/safeUrl'

export default function AdminPayments() {
  const [pending, setPending] = useState<Payment[]>([])
  const [history, setHistory] = useState<Payment[]>([])
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const [p, h] = await Promise.all([adminListPendingPayments(), adminListAllPayments()])
    setPending(p)
    setHistory(h.filter(x => x.status !== 'pending'))
    for (const payment of p) {
      if (payment.proofUrl && !proofUrls[payment.id]) {
        getPaymentProofUrl(payment.proofUrl).then(url => setProofUrls(prev => ({ ...prev, [payment.id]: url }))).catch(() => {})
      }
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
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Payments</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>
        {pending.length} awaiting review.
      </p>

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
          history.map(p => (
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
