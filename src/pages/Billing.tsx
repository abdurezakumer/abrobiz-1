import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Check, Upload, Clock, CheckCircle2, XCircle, RefreshCw, Copy, CheckCheck } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import TelegramConnectCard from '../components/TelegramConnectCard'
import { useAuth } from '../lib/authContext'
import { listPlans } from '../lib/api/plans'
import { listPaymentMethods } from '../lib/api/paymentMethods'
import { uploadPaymentProof, submitPayment, listPaymentsForBusiness } from '../lib/api/payments'
import { daysRemaining } from '../lib/api/subscriptions'
import { getOrCreateBusinessTelegramLink, telegramPaymentDeepLink, notifyAdminsOfPayment, type TelegramLinkStatus } from '../lib/api/telegram'
import { friendlyError } from '../lib/errors'
import type { Plan, PaymentMethod, Payment } from '../types'
import { PAYMENT_UPLOAD_ACCEPT, detectedUploadType, takeSelectedFile } from '../lib/fileUpload'

export default function Billing() {
  const { business, subscription, refreshBusiness } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [history, setHistory] = useState<Payment[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [savingProof, setSavingProof] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedPaymentId, setSubmittedPaymentId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [telegramLink, setTelegramLink] = useState<TelegramLinkStatus | null>(null)
  const paymentIdempotencyKey = useRef<string | null>(null)
  const paymentProofPath = useRef<string | null>(null)

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

  useEffect(() => {
    const preventLossWhileWorking = (event: BeforeUnloadEvent) => {
      if (!savingProof && !submitting) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventLossWhileWorking)
    return () => window.removeEventListener('beforeunload', preventLossWhileWorking)
  }, [savingProof, submitting])

  // Keep the payment result current while the admin reviews it. The normal
  // notification bell also refreshes automatically, but this makes the
  // payment history and confirmation message update without a page reload.
  useEffect(() => {
    if (!business || !submittedPaymentId) return
    let active = true
    const refreshPaymentStatus = async () => {
      try {
        const payments = await listPaymentsForBusiness(business.id)
        if (!active) return
        setHistory(payments)
        const reviewedPayment = payments.find(payment => payment.id === submittedPaymentId)
        if (reviewedPayment && reviewedPayment.status !== 'pending') setSubmittedPaymentId(null)
      } catch {
        // Keep the current pending state if a background refresh is delayed.
      }
    }
    const timer = window.setInterval(() => void refreshPaymentStatus(), 10000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [business?.id, submittedPaymentId])

  const days = daysRemaining(subscription?.endDate ?? null)

  async function refreshBilling() {
    if (!business) return
    setRefreshing(true)
    setError('')
    try {
      const [payments] = await Promise.all([
        listPaymentsForBusiness(business.id),
        refreshBusiness(),
      ])
      setHistory(payments)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function copyAccountNumber(method: PaymentMethod) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(method.accountNumber)
      } else {
        const helper = document.createElement('textarea')
        helper.value = method.accountNumber
        helper.setAttribute('readonly', '')
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.select()
        if (!document.execCommand('copy')) throw new Error('Copy was not supported.')
        helper.remove()
      }
      setCopiedAccountId(method.id)
      window.setTimeout(() => setCopiedAccountId(current => current === method.id ? null : current), 1800)
    } catch {
      setError('Could not copy the account number. Please press and hold it to copy.')
    }
  }

  async function handleProofSelection(file: File | null) {
    if (!file) return
    setError('')
    setProofFile(null)
    setUploadProgress(0)
    paymentIdempotencyKey.current = null
    paymentProofPath.current = null
    setSavingProof(true)
    try {
      const detectedType = detectedUploadType(file)
      if (!detectedType || !detectedType.startsWith('image/')) {
        throw new Error('Use a JPEG, PNG, WebP, or phone photo up to 10 MB.')
      }
      if (!business) throw new Error('Your business account is not ready yet.')
      // Upload directly after selection, just like the logo uploader. The
      // receipt is kept in secure storage; no device cache is used.
      const proofPath = await uploadPaymentProof(business.id, file, progress => {
        setUploadProgress(Math.min(99, 8 + Math.round(progress * 0.92)))
      })
      paymentProofPath.current = proofPath
      setUploadProgress(100)
      setProofFile(file)
    } catch (err) {
      paymentProofPath.current = null
      setProofFile(null)
      setUploadProgress(null)
      setError(friendlyError(err))
    } finally {
      setSavingProof(false)
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
    const pendingPayment = history.find(payment => payment.status === 'pending')
    if (pendingPayment) {
      setSubmittedPaymentId(pendingPayment.id)
      setSubmitted(true)
      setError('Your payment is already waiting for admin confirmation. Please wait for the review notification.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      paymentIdempotencyKey.current ??= crypto.randomUUID()
      const idempotencyKey = paymentIdempotencyKey.current
      const proofPath = paymentProofPath.current
      if (!proofPath) throw new Error('Please upload your payment receipt before submitting.')
      const payment = await submitPayment({
        businessId: business.id,
        planId: selectedPlan.id,
        billingCycle: selectedPlan.billingInterval,
        amountEtb: selectedPlan.priceEtb,
        paymentMethodId: selectedMethod.id,
        proofPath,
        ownerNote: note,
        idempotencyKey,
      })
      notifyAdminsOfPayment(payment.id)
      paymentIdempotencyKey.current = null
      paymentProofPath.current = null
      setHistory(previous => [payment, ...previous.filter(item => item.id !== payment.id)])
      setSubmittedPaymentId(payment.id)
      setSubmitted(true)
      setSelectedPlan(null)
      setProofFile(null)
      setNote('')
      // A successful payment must not be shown as failed just because a
      // follow-up dashboard refresh is temporarily unavailable.
      await listPaymentsForBusiness(business.id).then(setHistory).catch(() => {})
      await refreshBusiness().catch(() => {})
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!business) return null

  const submittedPayment = submittedPaymentId ? history.find(payment => payment.id === submittedPaymentId) : undefined

  return (
    <DashboardLayout>
      <style>{'@keyframes abrobiz-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', margin: '0 0 4px' }}>Billing</h1>
          <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, margin: 0 }}>Manage your subscription and payments.</p>
        </div>
        <button type="button" onClick={() => void refreshBilling()} disabled={refreshing || savingProof || submitting} style={refreshBtn}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'abrobiz-spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: '18px 22px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>Current plan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#0A0C10', fontFamily: 'Outfit, sans-serif' }}>
              {subscription?.plan?.name ?? 'Free Trial'}
            </div>
            <span style={planBadge} aria-label={`Plan type: ${subscription?.plan?.name ?? 'Free Trial'}`}>
              {subscription?.plan?.name ?? 'Free Trial'}
            </span>
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
        <div role="status" aria-live="polite" style={{ background: submittedPayment?.status === 'rejected' ? 'rgba(220,38,38,0.08)' : 'rgba(74,222,128,0.1)', border: `1px solid ${submittedPayment?.status === 'rejected' ? 'rgba(220,38,38,0.25)' : 'rgba(74,222,128,0.3)'}`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: submittedPayment?.status === 'rejected' ? '#991B1B' : '#166534' }}>
          {submittedPayment?.status === 'approved' ? (
            <>Payment confirmed by AbroBiz admin. Your subscription is now active.</>
          ) : submittedPayment?.status === 'rejected' ? (
            <>Your payment was reviewed but rejected{submittedPayment.rejectionReason ? `: ${submittedPayment.rejectionReason}` : '.'} You can submit a new proof.</>
          ) : (
            <>Payment submitted successfully. It is pending admin confirmation. This page will update automatically when it is reviewed.</>
          )}
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
                <button onClick={() => { setSelectedPlan(plan); setSubmitted(false); setSubmittedPaymentId(null); setError('') }} style={selectBtn}>Select</button>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={stepNumber}>1</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: '#0A0C10' }}>Send payment to</span>
            <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>Choose a method below</span>
          </div>
          {methods.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <span style={secureBadge}>Send the exact amount</span>
                <button type="button" onClick={() => void copyAccountNumber(selectedMethod)} style={copyBtn} aria-label={`Copy ${selectedMethod.name} account number`}>
                  {copiedAccountId === selectedMethod.id ? <CheckCheck size={14} /> : <Copy size={14} />}
                  {copiedAccountId === selectedMethod.id ? 'Copied' : 'Copy account number'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
            <span style={stepNumber}>2</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: '#0A0C10' }}>Upload your receipt</span>
            <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>Photo up to 5 MB</span>
          </div>
          <label style={{ ...uploadSurface, opacity: savingProof || submitting ? 0.65 : 1, cursor: savingProof || submitting ? 'not-allowed' : 'pointer' }}>
            <div style={{ border: '1.5px dashed rgba(10,12,16,0.2)', borderRadius: 12, padding: '22px', textAlign: 'center', background: '#F6F3EE' }}>
              {savingProof ? (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.65)', fontWeight: 600 }}>Uploading photo… {uploadProgress ?? 0}%</div>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress ?? 0} style={{ height: 7, background: 'rgba(10,12,16,0.1)', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
                    <div style={{ width: `${uploadProgress ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #D4A853, #F0C978)', borderRadius: 999, transition: 'width 180ms ease' }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)', marginTop: 7 }}>Keep this page open while your receipt is uploading.</div>
                </div>
              ) : proofFile ? (
                <>
                  <CheckCircle2 size={22} color="#166534" style={{ display: 'block', margin: '0 auto 6px' }} />
                  <span style={{ fontSize: 13.5, color: '#166534', wordBreak: 'break-word' }}>Uploaded: {proofFile.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(10,12,16,0.45)', marginTop: 5 }}>Tap to choose a different file</span>
                </>
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
                  <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.45)' }}>Click to browse your receipt photo</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.35)', marginTop: 5 }}>JPG, PNG, or WebP from your phone</div>
                </>
              )}
            </div>
            <input
              type="file"
              accept={PAYMENT_UPLOAD_ACCEPT}
              aria-label="Browse payment proof"
              disabled={savingProof || submitting}
              hidden
              onChange={e => void handleProofSelection(takeSelectedFile(e.currentTarget))}
            />
            <span style={{ fontSize: 11.5, color: '#D4A853', marginTop: 4, display: 'block' }}>{savingProof ? 'Uploading…' : proofFile ? 'Click to change' : 'Choose a file'}</span>
          </label>

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note for admin (optional)" rows={2} style={{ width: '100%', border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />

          {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
            <span style={stepNumber}>3</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: '#0A0C10' }}>Submit for admin review</span>
          </div>
          <button type="button" onClick={handleSubmit} disabled={!selectedMethod || !proofFile || savingProof || submitting} style={{ ...selectBtn, width: '100%', opacity: !selectedMethod || !proofFile || savingProof || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </button>
          {telegramLink && telegramPaymentDeepLink(telegramLink.linkToken) && (
            <a href={telegramPaymentDeepLink(telegramLink.linkToken) ?? undefined} target="_blank" rel="noopener noreferrer" style={telegramPayBtn}>
              Submit through Telegram instead
            </a>
          )}
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
const uploadSurface: React.CSSProperties = { display: 'block', width: '100%', padding: 0, marginBottom: 14, background: 'transparent', cursor: 'pointer', textAlign: 'left' }
const telegramPayBtn: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'center', background: '#26A5E4', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginTop: 10 }
const planBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 9px', background: 'rgba(212,168,83,0.16)', border: '1px solid rgba(212,168,83,0.35)', color: '#8A6417', fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }
const refreshBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const stepNumber: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#0A0C10', color: '#D4A853', fontSize: 11, fontWeight: 700 }
const secureBadge: React.CSSProperties = { borderRadius: 999, padding: '5px 9px', background: 'rgba(22,101,52,0.1)', color: '#166534', fontSize: 10.5, fontWeight: 700 }
const copyBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 8, padding: '8px 10px', background: '#fff', color: '#0A0C10', fontSize: 12, fontWeight: 650, cursor: 'pointer' }
