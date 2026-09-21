import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Check, Upload, Clock, CheckCircle2, XCircle, RefreshCw, Copy, CheckCheck, Sparkles, BadgePercent } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import TelegramConnectCard from '../components/TelegramConnectCard'
import { useAuth } from '../lib/authContext'
import { listPlans } from '../lib/api/plans'
import { listPaymentMethods } from '../lib/api/paymentMethods'
import { uploadPaymentProof, submitPayment, listPaymentsForBusiness } from '../lib/api/payments'
import { daysRemaining } from '../lib/api/subscriptions'
import { getOrCreateBusinessTelegramLink, disconnectTelegram, telegramPaymentDeepLink, notifyAdminsOfPayment, type TelegramLinkStatus } from '../lib/api/telegram'
import { friendlyError } from '../lib/errors'
import type { BillingInterval, Plan, PaymentMethod, Payment } from '../types'
import { formatEtb, getPlanPrice } from '../lib/planPricing'
import { fileInputStyle, PAYMENT_UPLOAD_ACCEPT, createClientUuid, detectedUploadType, takeSelectedFile } from '../lib/fileUpload'

interface PaymentDraft {
  planId: string | null
  paymentMethodId: string | null
  billingCycle: BillingInterval
  note: string
  proofFlowOpen: boolean
}

function paymentDraftKey(businessId: string) {
  return `abrobiz:payment-draft:${businessId}`
}

function readPaymentDraft(businessId: string): PaymentDraft | null {
  try {
    const key = paymentDraftKey(businessId)
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PaymentDraft> & { proofPath?: unknown; proofFileName?: unknown }
    const draft: PaymentDraft = {
      planId: typeof parsed.planId === 'string' ? parsed.planId : null,
      paymentMethodId: typeof parsed.paymentMethodId === 'string' ? parsed.paymentMethodId : null,
      billingCycle: parsed.billingCycle === 'year' ? 'year' : 'month',
      note: typeof parsed.note === 'string' ? parsed.note : '',
      proofFlowOpen: parsed.proofFlowOpen === true,
    }
    // Remove proof references written by older versions. A Telegram proof is
    // intentionally memory-only and must never be restored from browser cache.
    if ('proofPath' in parsed || 'proofFileName' in parsed) window.sessionStorage.setItem(key, JSON.stringify(draft))
    return draft
  } catch {
    return null
  }
}

function writePaymentDraft(businessId: string, draft: PaymentDraft) {
  try { window.sessionStorage.setItem(paymentDraftKey(businessId), JSON.stringify(draft)) } catch { /* Storage may be unavailable in private mode. */ }
}

function clearPaymentDraft(businessId: string) {
  try { window.sessionStorage.removeItem(paymentDraftKey(businessId)) } catch { /* Ignore unavailable browser storage. */ }
}

function paymentUploadErrorMessage(error: unknown): string {
  const message = friendlyError(error)
  const requestId = (error as { requestId?: unknown } | null)?.requestId
  return typeof requestId === 'string' && requestId ? `${message} Reference: ${requestId}` : message
}

export default function Billing() {
  const { business, subscription, refreshBusiness } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [methodsError, setMethodsError] = useState('')
  const [showOptionsOverlay, setShowOptionsOverlay] = useState(true)
  const [history, setHistory] = useState<Payment[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [billingCycle, setBillingCycle] = useState<BillingInterval>('month')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofFileName, setProofFileName] = useState('')
  const [proofPath, setProofPath] = useState<string | null>(null)
  const [savingProof, setSavingProof] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [proofUploadError, setProofUploadError] = useState(false)
  const [proofFlowOpen, setProofFlowOpen] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedPaymentId, setSubmittedPaymentId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [telegramLink, setTelegramLink] = useState<TelegramLinkStatus | null>(null)
  const paymentIdempotencyKey = useRef<string | null>(null)
  const proofUploadController = useRef<AbortController | null>(null)
  const proofDialogRef = useRef<HTMLDivElement | null>(null)
  const draftHydrated = useRef(false)
  const optionsRequestId = useRef(0)

  async function loadBillingOptions(businessId: string, restoreDraft: boolean, showOverlay = false) {
    const requestId = ++optionsRequestId.current
    const draft = restoreDraft ? readPaymentDraft(businessId) : null
    draftHydrated.current = false
    setPlansLoading(true)
    setMethodsLoading(true)
    setPlansError('')
    setMethodsError('')
    if (showOverlay) setShowOptionsOverlay(true)

    let plansFinished = false
    let methodsFinished = false
    const finish = () => {
      if (requestId !== optionsRequestId.current || !plansFinished || !methodsFinished) return
      draftHydrated.current = true
      setProofFlowOpen(draft?.proofFlowOpen === true)
      setShowOptionsOverlay(false)
    }

    const plansRequest = listPlans()
      .then(availablePlans => {
        if (requestId !== optionsRequestId.current) return
        setPlans(availablePlans)
        const restoredPlan = draft?.planId ? availablePlans.find(plan => plan.id === draft.planId) ?? null : null
        setSelectedPlan(current => {
          if (current && availablePlans.some(plan => plan.id === current.id)) return current
          return restoredPlan
        })
        if (draft?.billingCycle) setBillingCycle(draft.billingCycle)
        if (draft?.note) setNote(current => current || draft.note)
      })
      .catch(err => {
        if (requestId === optionsRequestId.current) setPlansError(friendlyError(err))
      })
      .finally(() => {
        if (requestId !== optionsRequestId.current) return
        plansFinished = true
        setPlansLoading(false)
        finish()
      })

    const methodsRequest = listPaymentMethods()
      .then(availableMethods => {
        if (requestId !== optionsRequestId.current) return
        setMethods(availableMethods)
        const restoredMethod = draft?.paymentMethodId ? availableMethods.find(method => method.id === draft.paymentMethodId) ?? null : null
        setSelectedMethod(current => {
          if (current && availableMethods.some(method => method.id === current.id)) return current
          return restoredMethod ?? availableMethods[0] ?? null
        })
      })
      .catch(err => {
        if (requestId === optionsRequestId.current) setMethodsError(friendlyError(err))
      })
      .finally(() => {
        if (requestId !== optionsRequestId.current) return
        methodsFinished = true
        setMethodsLoading(false)
        finish()
      })

    await Promise.allSettled([plansRequest, methodsRequest])
  }

  useEffect(() => {
    if (!business?.id) return
    const businessId = business.id
    void loadBillingOptions(businessId, true, true)
    void listPaymentsForBusiness(businessId).then(setHistory).catch(() => {})
    getOrCreateBusinessTelegramLink(businessId).then(setTelegramLink).catch(() => {})
  }, [business?.id])

  // Keep only non-sensitive payment form choices in sessionStorage. The
  // Telegram proof reference is deliberately memory-only and is never cached.
  useEffect(() => {
    if (!business?.id || !draftHydrated.current) return
    if (!selectedPlan && !note) {
      if (plansError) return
      clearPaymentDraft(business.id)
      return
    }
    writePaymentDraft(business.id, {
      planId: selectedPlan?.id ?? null,
      paymentMethodId: selectedMethod?.id ?? null,
      billingCycle,
      note,
      proofFlowOpen,
    })
  }, [business?.id, billingCycle, note, plansError, proofFlowOpen, selectedMethod?.id, selectedPlan, selectedPlan?.id])

  useEffect(() => {
    if (!proofFlowOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusDialog = () => proofDialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingProof && !submitting) setProofFlowOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(focusDialog)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [proofFlowOpen, savingProof, submitting])

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
      const options = loadBillingOptions(business.id, true)
      const [payments] = await Promise.all([
        listPaymentsForBusiness(business.id),
        refreshBusiness(),
      ])
      setHistory(payments)
      await options
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
    setProofFlowOpen(true)
    const previousProofPath = proofPath
    const previousProofFileName = proofFile?.name ?? proofFileName
    const uploadController = new AbortController()
    proofUploadController.current = uploadController
    setError('')
    setProofUploadError(false)
    setUploadProgress(0)
    paymentIdempotencyKey.current = null
    setSavingProof(true)
    try {
      const detectedType = detectedUploadType(file)
      if (!detectedType || !detectedType.startsWith('image/')) {
        throw new Error('Use a JPEG, PNG, WebP, or phone photo up to 10 MB.')
      }
      if (!business) throw new Error('Your business account is not ready yet.')
      // Upload directly after selection, just like the logo uploader. The
      // receipt is archived by the protected Telegram workflow; no device
      // cache or Supabase Storage copy is used.
      const proofPath = await uploadPaymentProof(business.id, file, progress => {
        setUploadProgress(Math.min(99, 8 + Math.round(progress * 0.92)))
      }, uploadController.signal)
      setProofPath(proofPath)
      setUploadProgress(100)
      setProofFile(file)
      setProofFileName(file.name)
      setProofUploadError(false)
    } catch (err) {
      setUploadProgress(null)
      if (uploadController.signal.aborted) {
        setError(previousProofPath ? 'Upload canceled. Your previous receipt is still ready to submit.' : '')
      } else if (previousProofPath) {
        // A replacement upload must never destroy a receipt that is already
        // ready to submit. Keep the previous path usable and let the owner
        // retry the replacement without starting the payment flow over.
        setProofPath(previousProofPath)
        setProofFileName(previousProofFileName)
        setProofUploadError(true)
        setError(`The new receipt could not be saved. Your previous receipt is still ready to submit. ${paymentUploadErrorMessage(err)} Please try again or submit the new receipt via Telegram.`)
      } else {
        setProofUploadError(true)
        setError(`${paymentUploadErrorMessage(err)} Please try again or submit the receipt via Telegram.`)
      }
    } finally {
      if (proofUploadController.current === uploadController) proofUploadController.current = null
      setSavingProof(false)
    }
  }

  function cancelProofUpload() {
    proofUploadController.current?.abort()
  }

  function closeProofFlow() {
    if (savingProof || submitting) return
    setProofFlowOpen(false)
  }

  async function handleSubmit() {
    if (!business || !selectedPlan) return
    if (!selectedMethod) {
      setError('Please select an available payment method before submitting.')
      return
    }
    if (!proofPath) {
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
    setProofUploadError(false)
    try {
      paymentIdempotencyKey.current ??= createClientUuid()
      const idempotencyKey = paymentIdempotencyKey.current
      if (!proofPath) throw new Error('Please upload your payment receipt before submitting.')
      const payment = await submitPayment({
        businessId: business.id,
        planId: selectedPlan.id,
        billingCycle,
        amountEtb: getPlanPrice(selectedPlan, billingCycle).priceEtb,
        paymentMethodId: selectedMethod.id,
        proofPath,
        ownerNote: note,
        idempotencyKey,
      })
      notifyAdminsOfPayment(payment.id)
      paymentIdempotencyKey.current = null
      setProofFlowOpen(false)
      setProofPath(null)
      setHistory(previous => [payment, ...previous.filter(item => item.id !== payment.id)])
      setSubmittedPaymentId(payment.id)
      setSubmitted(true)
      setSelectedPlan(null)
      setProofFile(null)
      setProofFileName('')
      setNote('')
      clearPaymentDraft(business.id)
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
  const proofReady = Boolean(proofPath)
  const displayedProofName = proofFile?.name ?? proofFileName
  const telegramPaymentUrl = telegramLink ? telegramPaymentDeepLink(telegramLink.linkToken) : null

  return (
    <DashboardLayout>
      <style>{'@keyframes abrobiz-spin { to { transform: rotate(360deg); } } @keyframes billing-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }'}</style>
      <div aria-hidden={proofFlowOpen} style={proofFlowOpen ? billingPageBlur : undefined}>
      {showOptionsOverlay && (plansLoading || methodsLoading) && (
        <div role="dialog" aria-modal="true" aria-labelledby="billing-loading-title" style={billingOverlay}>
          <div style={billingOverlayCard}>
            <div style={billingSpinner} aria-hidden="true" />
            <div id="billing-loading-title" style={{ fontSize: 16, fontWeight: 700, color: '#0A0C10', marginBottom: 6 }}>Preparing billing</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(10,12,16,0.58)', marginBottom: 16 }}>Loading plans and payment methods securely.</div>
            <button type="button" onClick={() => setShowOptionsOverlay(false)} style={overlayCancelBtn}>Cancel</button>
          </div>
        </div>
      )}
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

      <TelegramConnectCard status={telegramLink} kind="business" onDisconnect={async () => { await disconnectTelegram('business'); if (business) setTelegramLink(await getOrCreateBusinessTelegramLink(business.id)) }} />

      {!selectedPlan ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10' }}>Choose a plan</div>
            <div style={billingCycleToggle} role="group" aria-label="Billing cycle">
              {(['month', 'year'] as const).map(cycle => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} style={{ ...billingCycleButton, ...(billingCycle === cycle ? billingCycleButtonActive : {}) }}>
                  {cycle === 'month' ? 'Monthly' : 'Annual'}
                </button>
              ))}
            </div>
            {(plansLoading || methodsLoading) && <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>Updating available options…</div>}
          </div>
          {error && <div role="alert" style={inlineError}>{error}</div>}
          {plansLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 30 }}>
              {[1, 2, 3].map(item => <div key={item} style={planSkeleton} aria-hidden="true" />)}
            </div>
          ) : plansError ? (
            <div role="alert" style={optionStateCard}>
              <div style={{ fontWeight: 600, color: '#991B1B', marginBottom: 5 }}>Plans could not be loaded</div>
              <div style={{ color: 'rgba(10,12,16,0.6)', marginBottom: 13 }}>{plansError}</div>
              <button type="button" onClick={() => void loadBillingOptions(business.id, true)} style={retryBtn}><RefreshCw size={14} /> Try again</button>
            </div>
          ) : plans.length === 0 ? (
            <div style={optionStateCard}>
              <div style={{ fontWeight: 600, color: '#0A0C10', marginBottom: 5 }}>No plans are currently available</div>
              <div style={{ color: 'rgba(10,12,16,0.6)', marginBottom: 13 }}>Please refresh in a moment or contact AbroBiz support if this continues.</div>
              <button type="button" onClick={() => void loadBillingOptions(business.id, true)} style={retryBtn}><RefreshCw size={14} /> Refresh plans</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 30 }}>
              {plans.map(plan => {
                const pricing = getPlanPrice(plan, billingCycle)
                return <div key={plan.id} style={{ ...planCard, border: pricing.hasDiscount ? '1.5px solid rgba(212,168,83,0.7)' : planCard.border, boxShadow: pricing.hasDiscount ? '0 16px 34px rgba(212,168,83,0.15)' : planCard.boxShadow }}>
                  <div style={planCardGlow} aria-hidden="true" />
                  <div style={planCycleHeader}>
                    <div style={planCycleMark}><Sparkles size={14} /></div>
                    <span>{billingCycle === 'month' ? 'MONTHLY PLAN' : 'ANNUAL PLAN'}</span>
                    {billingCycle === 'year' && pricing.annualSavingsEtb > 0 && <span style={bestValuePill}>BEST VALUE</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                    <div><div style={{ fontSize: 17, fontWeight: 750, color: '#0A0C10', fontFamily: 'Outfit, sans-serif' }}>{plan.name}</div><div style={planCycleCaption}>{billingCycle === 'month' ? 'Flexible month-to-month access' : 'One full year of access'}</div></div>
                    {pricing.hasDiscount && <span style={offerBadge}><BadgePercent size={12} /> {pricing.discountLabel}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 750, color: '#0A0C10', fontFamily: 'Outfit, sans-serif' }}>{formatEtb(pricing.priceEtb)}</span>
                    <span style={{ fontSize: 13, color: 'rgba(10,12,16,0.45)' }}>ETB/{billingCycle === 'month' ? 'month' : 'year'}</span>
                    {pricing.hasDiscount && <span style={{ fontSize: 13, color: 'rgba(10,12,16,0.42)', textDecoration: 'line-through' }}>{formatEtb(pricing.originalPriceEtb)} ETB</span>}
                  </div>
                  {billingCycle === 'year' && pricing.annualSavingsEtb > 0 && <div style={savingText}>Save {formatEtb(pricing.annualSavingsEtb)} ETB vs monthly</div>}
                  <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'rgba(10,12,16,0.65)' }}>
                        <Check size={14} color="#D4A853" style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => { clearPaymentDraft(business.id); setProofFlowOpen(false); setSelectedPlan(plan); setSelectedMethod(methods[0] ?? null); setProofPath(null); setProofFile(null); setProofFileName(''); setNote(''); setSubmitted(false); setSubmittedPaymentId(null); setError('') }} style={selectBtn}>Select {plan.name}</button>
                </div>
              })}
            </div>
          )}
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #D4A853', padding: 22, marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Full payment for {selectedPlan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 750, fontFamily: 'Outfit, sans-serif' }}>{formatEtb(getPlanPrice(selectedPlan, billingCycle).priceEtb)} ETB/{billingCycle}</span>
                {getPlanPrice(selectedPlan, billingCycle).hasDiscount && <span style={{ color: 'rgba(10,12,16,0.45)', textDecoration: 'line-through', fontSize: 12.5 }}>{formatEtb(getPlanPrice(selectedPlan, billingCycle).originalPriceEtb)} ETB</span>}
              </div>
            </div>
            <button onClick={() => { clearPaymentDraft(business.id); setProofFlowOpen(false); setSelectedPlan(null); setSelectedMethod(methods[0] ?? null); setProofPath(null); setProofFile(null); setProofFileName(''); setNote('') }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'rgba(10,12,16,0.5)', cursor: 'pointer' }}>Cancel</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={stepNumber}>1</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: '#0A0C10' }}>Send payment to</span>
            <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>Choose a method below</span>
          </div>
          {methodsLoading ? (
            <div style={{ color: 'rgba(10,12,16,0.5)', fontSize: 13, marginBottom: 16 }}>Loading payment methods…</div>
          ) : methodsError ? (
            <div role="alert" style={{ ...optionStateCard, marginBottom: 16 }}>
              <div style={{ color: '#991B1B', marginBottom: 10 }}>{methodsError}</div>
              <button type="button" onClick={() => void loadBillingOptions(business.id, true)} style={retryBtn}><RefreshCw size={14} /> Try again</button>
            </div>
          ) : methods.length > 0 ? (
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
                <span style={secureBadge}>Full plan payment required</span>
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
              ) : proofReady ? (
                <>
                  <CheckCircle2 size={22} color="#166534" style={{ display: 'block', margin: '0 auto 6px' }} />
                  <span style={{ fontSize: 13.5, color: '#166534', wordBreak: 'break-word' }}>Uploaded: {displayedProofName || 'Receipt photo'}</span>
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
              style={fileInputStyle}
              onChange={e => void handleProofSelection(takeSelectedFile(e.currentTarget))}
            />
            <span style={{ fontSize: 11.5, color: '#D4A853', marginTop: 4, display: 'block' }}>{savingProof ? 'Uploading…' : proofReady ? 'Click to change' : 'Choose a file'}</span>
          </label>
          {savingProof && (
            <button type="button" onClick={cancelProofUpload} style={uploadCancelBtn}>
              Cancel upload
            </button>
          )}

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note for admin (optional)" rows={2} style={{ width: '100%', border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />

          {error && (
            <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>
              <div>{error}</div>
              {proofUploadError && telegramPaymentUrl && (
                <a href={telegramPaymentUrl} target="_blank" rel="noopener noreferrer" style={telegramErrorLink}>
                  Open Telegram payment upload
                </a>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
            <span style={stepNumber}>3</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: '#0A0C10' }}>Submit for admin review</span>
          </div>
          <button type="button" onClick={handleSubmit} disabled={!selectedMethod || !proofReady || savingProof || submitting} style={{ ...selectBtn, width: '100%', opacity: !selectedMethod || !proofReady || savingProof || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </button>
          {telegramPaymentUrl && (
            <a href={telegramPaymentUrl} target="_blank" rel="noopener noreferrer" style={telegramPayBtn}>
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
      </div>

      {proofFlowOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="proof-dialog-title" style={proofOverlay}>
          <div ref={proofDialogRef} tabIndex={-1} style={proofDialog}>
            <div style={proofDialogHeader}>
              <div>
                <div style={proofDialogEyebrow}>SECURE PAYMENT FLOW</div>
                <h2 id="proof-dialog-title" style={proofDialogTitle}>Upload payment proof</h2>
              </div>
              <button type="button" onClick={closeProofFlow} disabled={savingProof || submitting} style={proofBackButton}>
                Back
              </button>
            </div>
            <p style={proofDialogText}>
              Keep this screen open while AbroBiz securely receives your receipt. Your image is sent directly for payment review and is not saved in browser cache.
            </p>
            <label style={{ ...uploadSurface, marginBottom: 12, opacity: savingProof || submitting ? 0.7 : 1, cursor: savingProof || submitting ? 'not-allowed' : 'pointer' }}>
              <div style={proofUploadCard}>
                {savingProof ? (
                  <>
                    <div style={proofStatusTitle}>Uploading receipt… {uploadProgress ?? 0}%</div>
                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress ?? 0} style={proofProgressTrack}>
                      <div style={{ ...proofProgressFill, width: `${uploadProgress ?? 0}%` }} />
                    </div>
                    <div style={proofStatusHint}>Do not close this screen until the upload finishes.</div>
                  </>
                ) : proofReady ? (
                  <>
                    <CheckCircle2 size={34} color="#166534" style={{ display: 'block', margin: '0 auto 8px' }} />
                    <div style={{ ...proofStatusTitle, color: '#166534' }}>Receipt uploaded successfully</div>
                    <div style={proofStatusHint}>{displayedProofName || 'Payment receipt'} is ready to submit.</div>
                    <div style={{ ...proofStatusHint, marginTop: 4 }}>Tap here if you want to replace it.</div>
                  </>
                ) : (
                  <>
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} style={proofUploadIcon}>
                      <ArrowUp size={17} color="#D4A853" strokeWidth={2.5} />
                      <Upload size={24} color="rgba(10,12,16,0.4)" />
                    </motion.div>
                    <div style={proofStatusTitle}>Choose your receipt photo</div>
                    <div style={proofStatusHint}>JPG, PNG, WebP, or a photo from your phone · up to 5 MB</div>
                  </>
                )}
              </div>
              <input
                type="file"
                accept={PAYMENT_UPLOAD_ACCEPT}
                aria-label="Choose payment proof photo"
                disabled={savingProof || submitting}
                style={fileInputStyle}
                onChange={e => void handleProofSelection(takeSelectedFile(e.currentTarget))}
              />
              <span style={proofChooseText}>{savingProof ? 'Uploading…' : proofReady ? 'Choose another photo' : 'Choose receipt photo'}</span>
            </label>

            {savingProof && (
              <button type="button" onClick={cancelProofUpload} style={proofCancelButton}>Cancel upload</button>
            )}
            {error && (
              <div role="alert" style={proofDialogError}>
                <div>{error}</div>
                {proofUploadError && telegramPaymentUrl && (
                  <a href={telegramPaymentUrl} target="_blank" rel="noopener noreferrer" style={telegramErrorLink}>Open Telegram payment upload</a>
                )}
              </div>
            )}
            {!savingProof && proofReady && (
              <button type="button" onClick={closeProofFlow} style={proofContinueButton}>Continue to payment submission</button>
            )}
            {!savingProof && !proofReady && (
              <div style={proofDialogHint}>If you refreshed during an upload, choose the receipt again to restart it safely.</div>
            )}
          </div>
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
const billingCycleToggle: React.CSSProperties = { display: 'inline-flex', padding: 3, gap: 2, borderRadius: 10, background: '#F0EDE7', border: '1px solid rgba(10,12,16,0.08)' }
const billingCycleButton: React.CSSProperties = { border: 'none', borderRadius: 7, padding: '7px 11px', background: 'transparent', color: 'rgba(10,12,16,0.55)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const billingCycleButtonActive: React.CSSProperties = { background: '#0A0C10', color: '#F0EDE7', boxShadow: '0 2px 5px rgba(10,12,16,0.14)' }
const planCard: React.CSSProperties = { position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 20, border: '1px solid rgba(10,12,16,0.06)', padding: 20, boxShadow: '0 8px 24px rgba(10,12,16,0.04)' }
const planCardGlow: React.CSSProperties = { position: 'absolute', top: -44, right: -28, width: 128, height: 128, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.22), rgba(212,168,83,0) 70%)', pointerEvents: 'none' }
const planCycleHeader: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18, color: '#8A6417', fontSize: 10, fontWeight: 850, letterSpacing: 1.05 }
const planCycleMark: React.CSSProperties = { width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 9, background: 'linear-gradient(135deg, #0A0C10, #34404A)', color: '#F0C978' }
const bestValuePill: React.CSSProperties = { marginLeft: 'auto', padding: '4px 7px', borderRadius: 999, background: 'rgba(22,101,52,0.1)', color: '#166534', fontSize: 9, letterSpacing: 0.5 }
const planCycleCaption: React.CSSProperties = { color: 'rgba(10,12,16,0.44)', fontSize: 11.5, marginTop: 3 }
const offerBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '5px 8px', background: 'rgba(212,168,83,0.16)', color: '#8A6417', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }
const savingText: React.CSSProperties = { color: '#166534', fontSize: 11.5, fontWeight: 700, marginTop: 5 }
const methodChip: React.CSSProperties = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
const uploadSurface: React.CSSProperties = { display: 'block', width: '100%', padding: 0, marginBottom: 14, background: 'transparent', cursor: 'pointer', textAlign: 'left' }
const telegramPayBtn: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'center', background: '#26A5E4', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginTop: 10 }
const telegramErrorLink: React.CSSProperties = { display: 'inline-block', marginTop: 7, color: '#0B76B7', fontWeight: 700, textDecoration: 'underline' }
const planBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 9px', background: 'rgba(212,168,83,0.16)', border: '1px solid rgba(212,168,83,0.35)', color: '#8A6417', fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }
const refreshBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const stepNumber: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#0A0C10', color: '#D4A853', fontSize: 11, fontWeight: 700 }
const secureBadge: React.CSSProperties = { borderRadius: 999, padding: '5px 9px', background: 'rgba(22,101,52,0.1)', color: '#166534', fontSize: 10.5, fontWeight: 700 }
const copyBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 8, padding: '8px 10px', background: '#fff', color: '#0A0C10', fontSize: 12, fontWeight: 650, cursor: 'pointer' }
const billingPageBlur: React.CSSProperties = { filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', transition: 'filter 180ms ease' }
const billingOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(10,12,16,0.34)', backdropFilter: 'blur(3px)' }
const billingOverlayCard: React.CSSProperties = { width: 'min(100%, 340px)', background: '#fff', borderRadius: 18, padding: '26px 24px 22px', textAlign: 'center', boxShadow: '0 24px 70px rgba(10,12,16,0.2)' }
const billingSpinner: React.CSSProperties = { width: 30, height: 30, border: '3px solid rgba(212,168,83,0.25)', borderTopColor: '#D4A853', borderRadius: '50%', animation: 'abrobiz-spin 0.8s linear infinite', margin: '0 auto 14px' }
const overlayCancelBtn: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.14)', borderRadius: 9, padding: '9px 18px', background: '#fff', color: '#0A0C10', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const proofOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))', background: 'rgba(10,12,16,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }
const proofDialog: React.CSSProperties = { width: 'min(100%, 470px)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: '22px 20px 20px', boxShadow: '0 24px 90px rgba(10,12,16,0.32)', outline: 'none' }
const proofDialogHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 10 }
const proofDialogEyebrow: React.CSSProperties = { color: '#A27A22', fontSize: 10, fontWeight: 800, letterSpacing: 1.2, marginBottom: 5 }
const proofDialogTitle: React.CSSProperties = { color: '#0A0C10', fontFamily: 'Outfit, sans-serif', fontSize: 23, lineHeight: 1.15, margin: 0 }
const proofBackButton: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.14)', borderRadius: 9, padding: '8px 12px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer', flexShrink: 0 }
const proofDialogText: React.CSSProperties = { color: 'rgba(10,12,16,0.58)', fontSize: 13, lineHeight: 1.55, margin: '0 0 16px' }
const proofUploadCard: React.CSSProperties = { border: '1.5px dashed rgba(10,12,16,0.2)', borderRadius: 14, padding: '30px 18px', textAlign: 'center', background: '#F6F3EE', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }
const proofUploadIcon: React.CSSProperties = { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }
const proofStatusTitle: React.CSSProperties = { color: 'rgba(10,12,16,0.74)', fontSize: 15, fontWeight: 700, lineHeight: 1.35, wordBreak: 'break-word' }
const proofStatusHint: React.CSSProperties = { color: 'rgba(10,12,16,0.48)', fontSize: 12, lineHeight: 1.45, marginTop: 7 }
const proofProgressTrack: React.CSSProperties = { width: '100%', height: 9, background: 'rgba(10,12,16,0.1)', borderRadius: 999, overflow: 'hidden', marginTop: 15 }
const proofProgressFill: React.CSSProperties = { height: '100%', background: 'linear-gradient(90deg, #D4A853, #F0C978)', borderRadius: 999, transition: 'width 180ms ease' }
const proofChooseText: React.CSSProperties = { display: 'block', color: '#A27A22', fontSize: 12.5, fontWeight: 700, textAlign: 'center', marginTop: 8 }
const proofCancelButton: React.CSSProperties = { display: 'block', width: '100%', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 10, padding: '10px 12px', background: 'rgba(220,38,38,0.06)', color: '#991B1B', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }
const proofDialogError: React.CSSProperties = { color: '#991B1B', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginBottom: 12 }
const proofContinueButton: React.CSSProperties = { display: 'block', width: '100%', border: 'none', borderRadius: 10, padding: '11px 14px', background: '#D4A853', color: '#0A0C10', fontSize: 13.5, fontWeight: 750, cursor: 'pointer' }
const proofDialogHint: React.CSSProperties = { color: 'rgba(10,12,16,0.48)', fontSize: 12, lineHeight: 1.45, textAlign: 'center', marginTop: 10 }
const planSkeleton: React.CSSProperties = { minHeight: 250, borderRadius: 16, background: 'linear-gradient(100deg, rgba(10,12,16,0.06) 30%, rgba(255,255,255,0.8) 50%, rgba(10,12,16,0.06) 70%)', backgroundSize: '200% 100%', animation: 'billing-skeleton 1.2s ease-in-out infinite' }
const optionStateCard: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 30, fontSize: 13.5 }
const inlineError: React.CSSProperties = { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#991B1B', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }
const retryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(10,12,16,0.14)', borderRadius: 8, padding: '8px 11px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const uploadCancelBtn: React.CSSProperties = { display: 'block', width: '100%', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 9, padding: '9px 12px', background: 'rgba(220,38,38,0.06)', color: '#991B1B', fontSize: 12.5, fontWeight: 650, cursor: 'pointer', margin: '-4px 0 14px' }
