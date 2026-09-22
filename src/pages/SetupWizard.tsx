import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { listBusinessCategories } from '../lib/api/businessCategories'
import { createBusinessWithTrial, getMyBusiness, isSlugAvailable, updateBusiness } from '../lib/api/businesses'
import { categoryIcon } from '../lib/icons'
import { useAuth } from '../lib/authContext'
import { completeGooglePhonePrompt, completeGoogleReferralPrompt } from '../lib/api/marketing'
import { isValidBusinessSlug, slugify } from '../lib/slugify'
import { listActiveTemplates, mergeTemplateOptions } from '../lib/api/templates'
import { friendlyError } from '../lib/errors'
import type { BusinessCategory, Template, TemplateSlug } from '../types'
import TemplateSelector from '../components/TemplateSelector'
import { BUILTIN_TEMPLATES } from '../lib/templateRegistry'

export default function SetupWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshBusiness, profile, session } = useAuth()
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState<BusinessCategory[]>([])
  const [templates, setTemplates] = useState<Template[]>(BUILTIN_TEMPLATES)
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [templateSlug, setTemplateSlug] = useState<TemplateSlug>('clean-minimal')
  const [templateTouched, setTemplateTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralPromptOpen, setReferralPromptOpen] = useState(false)
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralError, setReferralError] = useState('')
  const [referralCompletedLocally, setReferralCompletedLocally] = useState(false)
  const [phone, setPhone] = useState('')
  const [phonePromptOpen, setPhonePromptOpen] = useState(false)
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [error, setError] = useState(() => {
    const state = location.state as { emailError?: string } | null
    const saved = sessionStorage.getItem('abrobiz:email-error')
    if (saved) sessionStorage.removeItem('abrobiz:email-error')
    return state?.emailError ?? saved ?? ''
  })

  const isGoogleAccount = Boolean(
    session?.user.app_metadata?.provider === 'google'
      || session?.user.identities?.some(identity => identity.provider === 'google'),
  )
  const referralComplete = profile?.referralPromptCompletedAt != null || referralCompletedLocally

  useEffect(() => {
    if (isGoogleAccount && profile?.role === 'owner' && !referralComplete) {
      setReferralPromptOpen(true)
    }
  }, [isGoogleAccount, profile?.role, referralComplete])

  useEffect(() => {
    if (isGoogleAccount && profile?.role === 'owner' && referralComplete && !profile.phone?.trim()) {
      setPhonePromptOpen(true)
    }
  }, [isGoogleAccount, profile?.role, referralComplete, profile?.phone])

  async function finishGoogleReferralPrompt(code?: string) {
    setReferralSubmitting(true)
    setReferralError('')
    try {
      await completeGoogleReferralPrompt(code)
      setReferralPromptOpen(false)
      setReferralCode('')
      setReferralCompletedLocally(true)
      if (!profile?.phone?.trim()) setPhonePromptOpen(true)
    } catch (err) {
      setReferralError(friendlyError(err))
    } finally {
      setReferralSubmitting(false)
    }
  }

  async function finishGooglePhonePrompt() {
    const normalizedPhone = phone.trim()
    if (!/^[+0-9() .-]{3,40}$/.test(normalizedPhone)) {
      setPhoneError('Enter a valid phone number.')
      return
    }
    setPhoneSubmitting(true)
    setPhoneError('')
    try {
      await completeGooglePhonePrompt(normalizedPhone)
      setPhonePromptOpen(false)
    } catch (err) {
      setPhoneError(friendlyError(err))
    } finally {
      setPhoneSubmitting(false)
    }
  }

  useEffect(() => {
    listBusinessCategories().then(setCategories)
    listActiveTemplates().then(remote => setTemplates(mergeTemplateOptions(remote, BUILTIN_TEMPLATES))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  useEffect(() => {
    if (templateTouched) return
    const category = categories.find(item => item.id === categoryId)
    if (category?.slug === 'restaurant' || category?.slug === 'cafe') setTemplateSlug('restaurant-cafe')
    if (category?.slug === 'salon' || category?.slug === 'hotel') setTemplateSlug('luxury-editorial')
    if (category?.slug === 'retail') setTemplateSlug('clean-minimal')
    const nicheDefaults: Record<string, TemplateSlug> = {
      fitness: 'luxury-gym', dental: 'dental-trust', spa: 'spa-luxe', massage: 'massage-center', 'hair-salon': 'hair-luxury', barbershop: 'barber-luxe',
      'real-estate': 'property-atelier', healthcare: 'clinic-modern', professional: 'studio-corporate', events: 'event-house',
    }
    if (category?.slug && nicheDefaults[category.slug]) setTemplateSlug(nicheDefaults[category.slug])
  }, [categories, categoryId, templateTouched])

  useEffect(() => {
    if (!isValidBusinessSlug(slug)) {
      setSlugAvailable(false)
      return
    }
    setSlugAvailable(null)
    const timeout = setTimeout(() => {
      isSlugAvailable(slug).then(setSlugAvailable)
    }, 350)
    return () => clearTimeout(timeout)
  }, [slug])

  const steps = ['Business type', 'Name your site', 'Pick a look']
  const canProceed = step === 0 ? !!categoryId : step === 1 ? !!name.trim() && isValidBusinessSlug(slug) && slugAvailable === true : true

  async function handleFinish() {
    setSubmitting(true)
    setError('')
    try {
      let business
      try {
        business = await createBusinessWithTrial({ name, slug, categoryId })
      } catch (createError) {
        // A previous attempt may have created the business before the final
        // template/publish update completed. Recover that owner instead of
        // showing "already has a business" and trapping them in setup.
        const existing = await getMyBusiness().catch(() => null)
        if (!existing) throw createError
        business = existing
      }

      await updateBusiness(business.id, { templateSlug, isPublished: true })
      await refreshBusiness()
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C10', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? '#D4A853' : 'rgba(255,255,255,0.1)', marginBottom: 8, transition: 'background 0.3s' }} />
              <div style={{ fontSize: 12, color: i <= step ? '#D4A853' : 'rgba(240,237,231,0.35)' }}>{s}</div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && (
              <div>
                <h1 style={heading}>What kind of business is this?</h1>
                <p style={subheading}>This shapes your site's layout and labels — you can't change it later without contacting support.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 24 }}>
                  {categories.map(cat => {
                    const Icon = categoryIcon(cat.icon)
                    const selected = categoryId === cat.id
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryId(cat.id)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '22px 14px',
                          borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                          border: selected ? '1.5px solid #D4A853' : '1.5px solid rgba(255,255,255,0.08)',
                          background: selected ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <Icon size={24} color={selected ? '#D4A853' : 'rgba(240,237,231,0.6)'} />
                        <span style={{ fontSize: 13.5, color: '#F0EDE7', fontWeight: 500 }}>{cat.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h1 style={heading}>Choose your subdomain</h1>
                <p style={subheading}>This unique address is reserved for your account and becomes your public website.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={labelStyle}>Business name</span>
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. Habesha Kitchen" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={labelStyle}>Your unique AbroBiz subdomain</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 13px' }}>
                      <input
                        aria-label="Choose your unique subdomain"
                        value={slug}
                        onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
                        placeholder="your-business"
                        style={{ background: 'none', border: 'none', outline: 'none', color: '#F0EDE7', fontSize: 14.5, flex: 1, minWidth: 0 }}
                      />
                      <span style={{ color: 'rgba(240,237,231,0.45)', fontSize: 14, whiteSpace: 'nowrap' }}>.abrobiz.com</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(240,237,231,0.42)' }}>Use 3–63 lowercase letters, numbers, or hyphens. It cannot start or end with a hyphen.</span>
                    {slug && !isValidBusinessSlug(slug) && <span style={{ fontSize: 12.5, color: '#F87171' }}>Choose a valid, non-reserved subdomain.</span>}
                    {isValidBusinessSlug(slug) && slugAvailable === null && <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.55)' }}>Checking availability…</span>}
                    {isValidBusinessSlug(slug) && slugAvailable === false && <span style={{ fontSize: 12.5, color: '#F87171' }}>That subdomain is taken or reserved — try another.</span>}
                    {isValidBusinessSlug(slug) && slugAvailable === true && <span style={{ fontSize: 12.5, color: '#4ADE80' }}>Available: {slug}.abrobiz.com</span>}
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 style={heading}>Pick a look</h1>
                <p style={subheading}>You can change this anytime from Settings.</p>
                <a href="/demo/restaurant-cafe" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#D4A853', fontSize: 12.5, textDecoration: 'underline' }}>Preview the Restaurant & Café demo ↗</a>
                <TemplateSelector
                  templates={templates}
                  selectedSlug={templateSlug}
                  onSelect={slug => { setTemplateTouched(true); setTemplateSlug(slug) }}
                  businessType={categories.find(category => category.id === categoryId)?.slug}
                  dark
                  confirmSwitch={false}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div style={{ color: '#F87171', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10, marginTop: 20 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ ...ghostBtn, opacity: step === 0 ? 0.3 : 1, cursor: step === 0 ? 'default' : 'pointer' }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed} style={{ ...primaryBtn, opacity: canProceed ? 1 : 0.4 }}>
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={submitting} style={primaryBtn}>
              {submitting ? 'Launching your site…' : 'Launch my site'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {referralPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={referralOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-prompt-title"
          >
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} style={referralCard}>
              <div style={referralEyebrow}>WELCOME TO ABROBIZ</div>
              <h2 id="referral-prompt-title" style={referralTitle}>Were you referred by a partner?</h2>
              <p style={referralCopy}>Enter the short code from your Sales Person or Marketing Admin. You can also skip this step and continue setting up your website.</p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={labelStyle}>Referral code (optional)</span>
                <input
                  value={referralCode}
                  onChange={event => setReferralCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                  placeholder="SA123 or MA12"
                  maxLength={5}
                  autoCapitalize="characters"
                  autoComplete="off"
                  style={inputStyle}
                  aria-describedby={referralError ? 'referral-prompt-error' : undefined}
                />
              </label>
              {referralError && <div id="referral-prompt-error" style={referralErrorStyle}>{referralError}</div>}
              <div style={referralActions}>
                <button type="button" disabled={referralSubmitting} onClick={() => void finishGoogleReferralPrompt()} style={ghostBtn}>Skip for now</button>
                <button
                  type="button"
                  disabled={referralSubmitting || !/^(SA\d{3}|MA\d{2})$/.test(referralCode)}
                  onClick={() => void finishGoogleReferralPrompt(referralCode)}
                  style={{ ...primaryBtn, opacity: referralSubmitting || !/^(SA\d{3}|MA\d{2})$/.test(referralCode) ? 0.45 : 1 }}
                >
                  {referralSubmitting ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phonePromptOpen && !referralPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={referralOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-prompt-title"
          >
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} style={referralCard}>
              <div style={referralEyebrow}>ONE MORE DETAIL</div>
              <h2 id="phone-prompt-title" style={referralTitle}>Add your phone number</h2>
              <p style={referralCopy}>We use this to help you manage your AbroBiz account and contact you about important website or payment updates.</p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={labelStyle}>Phone number</span>
                <input
                  value={phone}
                  onChange={event => setPhone(event.target.value.slice(0, 40))}
                  placeholder="+251 9XX XXX XXX"
                  inputMode="tel"
                  autoComplete="tel"
                  style={inputStyle}
                  aria-describedby={phoneError ? 'phone-prompt-error' : undefined}
                  autoFocus
                />
              </label>
              {phoneError && <div id="phone-prompt-error" style={referralErrorStyle}>{phoneError}</div>}
              <div style={{ ...referralActions, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={phoneSubmitting || !/^[+0-9() .-]{3,40}$/.test(phone.trim())}
                  onClick={() => void finishGooglePhonePrompt()}
                  style={{ ...primaryBtn, opacity: phoneSubmitting || !/^[+0-9() .-]{3,40}$/.test(phone.trim()) ? 0.45 : 1 }}
                >
                  {phoneSubmitting ? 'Saving…' : 'Save and continue'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, color: '#F0EDE7' }
const subheading: React.CSSProperties = { color: 'rgba(240,237,231,0.5)', fontSize: 14, marginTop: 6 }
const labelStyle: React.CSSProperties = { fontSize: 12.5, color: 'rgba(240,237,231,0.5)', fontWeight: 500 }
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '11px 13px', color: '#F0EDE7', fontSize: 14.5, outline: 'none',
}
const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: '#D4A853', color: '#0A0C10', border: 'none',
  borderRadius: 10, padding: '12px 22px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: 'rgba(240,237,231,0.6)',
  border: 'none', fontSize: 14.5, fontWeight: 500,
}
const referralOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(3,5,8,0.82)', backdropFilter: 'blur(10px)' }
const referralCard: React.CSSProperties = { width: '100%', maxWidth: 430, background: '#12161D', border: '1px solid rgba(212,168,83,0.28)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }
const referralEyebrow: React.CSSProperties = { color: '#D4A853', fontSize: 11, letterSpacing: 1.8, fontWeight: 700 }
const referralTitle: React.CSSProperties = { color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontSize: 24, lineHeight: 1.2, margin: '10px 0 9px' }
const referralCopy: React.CSSProperties = { color: 'rgba(240,237,231,0.58)', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }
const referralActions: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 22 }
const referralErrorStyle: React.CSSProperties = { color: '#F87171', fontSize: 13, lineHeight: 1.45, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10, marginTop: 12 }
