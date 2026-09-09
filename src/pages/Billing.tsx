import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Check, Upload, Clock, CheckCircle2, XCircle } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import TelegramConnectCard from '../components/TelegramConnectCard'
import { useAuth } from '../lib/authContext'
import { listPlans } from '../lib/api/plans'
import { listPaymentMethods } from '../lib/api/paymentMethods'
import { uploadPaymentProof, submitPayment, listPaymentsForBusiness } from '../lib/api/payments'
import { daysRemaining } from '../lib/api/subscriptions'
import { getOrCreateBusinessTelegramLink, telegramDeepLink, notifyAdminsOfPayment, type TelegramLinkStatus } from '../lib/api/telegram'
import { friendlyError } from '../lib/errors'
import type { Plan, PaymentMethod, Payment } from '../types'
import { PAYMENT_UPLOAD_ACCEPT, isPdfFile, prepareImageForUpload, takeSelectedFile } from '../lib/fileUpload'

export default function Billing() {
  const { business, subscription, refreshBusiness } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [history, setHistory] = useState<Payment[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [preparingProof, setPreparingProof] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [telegramLink, setTelegramLink] = useState<TelegramLinkStatus | null>(null)
  const proofInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listPlans().then(setPlans)
    listPaymentMethods().then(ms => {
      setMethods(ms)
      setSelectedMethod(ms[0] ?? null)
    }).catch(err => setError(friendlyError(err)))
    if (business) {
      listPaymentsForBusiness(business.id).then(setHistory)
      getOrCreateBusinessTelegramLink(business.id).then(setTelegramLink).catch(() => {})
    }
  }, [business])

  const days = daysRemaining(subscription?.endDate ?? null)

  async function handleProofSelection(file: File | null) {
    if (!file) return
    setError('')
    setProofFile(null)
    setPreparingProof(true)
    try {
      const prepared = isPdfFile(file)
        ? (file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf' }))
        : await prepareImageForUpload(file, 10 * 1024 * 1024)
      if (prepared.size > 10 * 1024 * 1024) {
        throw new Error('Use a JPEG, PNG, WebP, or PDF file up to 10 MB.')
      }
      setProofFile(prepared)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setPreparingProof(false)
    }
  }

  async function handleSubmit() {
    if (!business || !selectedPlan) return
    if (!selectedMethod) {
      setError('Please select an available payment method before submitting.')
      return
    }
    if (!proofFile) {
      setError('Please upload your payment receipt before submitting.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const proofPath = await uploadPaymentProof(business.id, proofFile)
      const payment = await submitPayment({
        businessId: business.id,
        planId: selectedPlan.id,
        billingCycle: selectedPlan.billingInterval,
        amountEtb: selectedPlan.priceEtb,
        paymentMethodId: selectedMethod.id,
        proofPath,
        ownerNote: note,
      })
      notifyAdminsOfPayment(payment.id)
      setSubmitted(true)
      setSelectedPlan(null)
      setProofFile(null)
      setNote('')
      const updated = await listPaymentsForBusiness(business.id)
      setHistory(updated)
      await refreshBusiness()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!business) return null

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Billing</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>Manage your subscription and payments.</p>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: '18px 22px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>Current plan</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0A0C10', fontFamily: 'Outfit, sans-serif' }}>
            {subscription?.plan?.name ?? 'Free Trial'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>Status</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: subscription?.status === 'expired' ? '#DC2626' : '#16A34A', textTransform: 'capitalize' }}>
            {subscription?.status} {days !== null && days !== undefined && days >= 0 ? `· ${days}d left` : ''}
          </div>
        </div>
      </div>

      {submitted && (
        <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: '#166534' }}>
          Payment proof submitted! We'll review it and activate your plan shortly.
        </div>
      )}

      <TelegramConnectCard status={telegramLink} kind="business" />

      {!selectedPlan ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 12 }}>Choose a plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 30 }}>
            {plans.map(plan => (
              <div key={plan.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10' }}>{plan.name}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0A0C10', marginTop: 6, fontFamily: 'Outfit, sans-serif' }}>
                  {plan.priceEtb} <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(10,12,16,0.45)' }}>ETB/{plan.billingInterval}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'rgba(10,12,16,0.65)' }}>
                      <Check size={14} color="#D4A853" style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setSelectedPlan(plan)} style={selectBtn}>Select</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #D4A853', padding: 22, marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Pay for {selectedPlan.name} — {selectedPlan.priceEtb} ETB</div>
            <button onClick={() => setSelectedPlan(null)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'rgba(10,12,16,0.5)', cursor: 'pointer' }}>Cancel</button>
          </div>

          <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginBottom: 8 }}>1. Send payment to:</div>
          {methods.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {methods.map(m => (
                <button type="button" key={m.id} onClick={() => { setSelectedMethod(m); setError('') }} style={{ ...methodChip, background: selectedMethod?.id === m.id ? '#0A0C10' : '#F6F3EE', color: selectedMethod?.id === m.id ? '#fff' : '#0A0C10' }}>
                  {m.name}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#B45309', fontSize: 13, marginBottom: 16 }}>
              No active payment method is available yet. Please contact AbroBiz support.
            </div>
          )}
          {selectedMethod && (
            <div style={{ background: '#F6F3EE', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13.5 }}>
              <div><strong>{selectedMethod.accountName}</strong> — {selectedMethod.accountNumber}</div>
              <div style={{ color: 'rgba(10,12,16,0.55)', marginTop: 4 }}>{selectedMethod.instructions}</div>
            </div>
          )}

          <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginBottom: 8 }}>2. Upload your payment screenshot/receipt:</div>
          <button
            type="button"
            onClick={() => proofInputRef.current?.click()}
            disabled={preparingProof || submitting}
            aria-label="Upload payment proof"
            style={{ ...uploadSurface, opacity: preparingProof || submitting ? 0.65 : 1 }}
          >
            <div style={{ border: '1.5px dashed rgba(10,12,16,0.2)', borderRadius: 12, padding: '22px', textAlign: 'center' }}>
              {preparingProof ? (
                <span style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.55)' }}>Preparing image…</span>
              ) : proofFile ? (
                <span style={{ fontSize: 13.5, color: '#0A0C10' }}>{proofFile.name}</span>
              ) : (
                <>
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginBottom: 6 }}
                  >
                    <ArrowUp size={15} color="#D4A853" strokeWidth={2.5} />
                    <Upload size={18} color="rgba(10,12,16,0.35)" />
                  </motion.div>
                  <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.45)' }}>Click to upload proof</div>
                </>
              )}
            </div>
          </button>
          <input
            ref={proofInputRef}
            type="file"
            accept={PAYMENT_UPLOAD_ACCEPT}
            style={{ display: 'none' }}
            onChange={e => void handleProofSelection(takeSelectedFile(e.currentTarget))}
          />

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note for admin (optional)" rows={2} style={{ width: '100%', border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />

          {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button type="button" onClick={handleSubmit} disabled={!selectedMethod || !proofFile || submitting} style={{ ...selectBtn, width: '100%', opacity: !selectedMethod || !proofFile || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </button>
        </motion.div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 12 }}>Payment history</div>
      {history.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.4)' }}>No payments yet.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden' }}>
          {history.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid rgba(10,12,16,0.05)', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.plan?.name ?? 'Plan'} — {p.amountEtb} ETB</div>
                <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.4)' }}>{new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              <StatusBadge status={p.status} reason={p.rejectionReason} />
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}

function StatusBadge({ status, reason }: { status: Payment['status']; reason?: string }) {
  const config = {
    pending: { icon: Clock, color: '#B45309', bg: 'rgba(180,83,9,0.1)', label: 'Pending review' },
    approved: { icon: CheckCircle2, color: '#16A34A', bg: 'rgba(22,163,74,0.1)', label: 'Approved' },
    rejected: { icon: XCircle, color: '#DC2626', bg: 'rgba(220,38,38,0.1)', label: 'Rejected' },
  }[status]
  const Icon = config.icon
  return (
    <div title={reason} style={{ display: 'flex', alignItems: 'center', gap: 6, background: config.bg, color: config.color, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      <Icon size={13} /> {config.label}
    </div>
  )
}

const selectBtn: React.CSSProperties = { background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', width: '100%' }
const methodChip: React.CSSProperties = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
const uploadSurface: React.CSSProperties = { display: 'block', width: '100%', padding: 0, marginBottom: 14, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }
