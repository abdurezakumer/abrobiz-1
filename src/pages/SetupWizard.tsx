import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { listBusinessCategories } from '../lib/api/businessCategories'
import { createBusinessWithTrial, getMyBusiness, isSlugAvailable, updateBusiness } from '../lib/api/businesses'
import { categoryIcon } from '../lib/icons'
import { useAuth } from '../lib/authContext'
import { isValidBusinessSlug, slugify } from '../lib/slugify'
import { listActiveTemplates, mergeTemplateOptions } from '../lib/api/templates'
import { friendlyError } from '../lib/errors'
import type { BusinessCategory, Template, TemplateSlug } from '../types'

const DEFAULT_TEMPLATES: Template[] = [
  { id: 'modern-dark', slug: 'modern-dark', name: 'Modern Dark', description: 'Bold, moody, great for evening/nightlife spots', config: { bg: '#111318' }, isBuiltin: true, isActive: true, sortOrder: 10, createdAt: '' },
  { id: 'clean-minimal', slug: 'clean-minimal', name: 'Clean Minimal', description: 'Light, crisp, works for almost any business', config: { bg: '#F6F3EE' }, isBuiltin: true, isActive: true, sortOrder: 20, createdAt: '' },
  { id: 'traditional-warm', slug: 'traditional-warm', name: 'Traditional Warm', description: 'Earthy tones, welcoming, culturally rich', config: { bg: '#5A3E2B' }, isBuiltin: true, isActive: true, sortOrder: 30, createdAt: '' },
  { id: 'restaurant-cafe', slug: 'restaurant-cafe', name: 'Restaurant & Café Editorial', description: 'Warm cream, espresso, amber and editorial typography for restaurants, cafés and bakeries.', config: { bg: '#FAF8F3', visualStyle: 'heritage', layout: 'restaurant-cafe' }, isBuiltin: true, isActive: true, sortOrder: 35, createdAt: '' },
  { id: 'aurora-glass', slug: 'aurora-glass', name: 'Aurora Glass', description: 'Luminous glass surfaces with a calm, modern glow.', config: { bg: '#07131A' }, isBuiltin: true, isActive: true, sortOrder: 40, createdAt: '' },
  { id: 'luxury-editorial', slug: 'luxury-editorial', name: 'Luxury Editorial', description: 'High-end hospitality styling with cinematic gold accents.', config: { bg: '#110F0D' }, isBuiltin: true, isActive: true, sortOrder: 50, createdAt: '' },
  { id: 'heritage-boutique', slug: 'heritage-boutique', name: 'Heritage Boutique', description: 'Rich, warm and crafted for distinctive local brands.', config: { bg: '#2A1B16' }, isBuiltin: true, isActive: true, sortOrder: 60, createdAt: '' },
]

export default function SetupWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshBusiness } = useAuth()
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState<BusinessCategory[]>([])
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES)
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [templateSlug, setTemplateSlug] = useState<TemplateSlug>('clean-minimal')
  const [templateTouched, setTemplateTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(() => {
    const state = location.state as { emailError?: string } | null
    const saved = sessionStorage.getItem('abrobiz:email-error')
    if (saved) sessionStorage.removeItem('abrobiz:email-error')
    return state?.emailError ?? saved ?? ''
  })

  useEffect(() => {
    listBusinessCategories().then(setCategories)
    listActiveTemplates().then(remote => setTemplates(mergeTemplateOptions(remote, DEFAULT_TEMPLATES))).catch(() => {})
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginTop: 24 }}>
                  {templates.map(tpl => {
                    const selected = templateSlug === tpl.slug
                    return (
                      <button
                        key={tpl.slug}
                        onClick={() => { setTemplateTouched(true); setTemplateSlug(tpl.slug) }}
                        style={{
                          borderRadius: 14, cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
                          border: selected ? '1.5px solid #D4A853' : '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ height: 70, background: tpl.previewUrl ? `url(${tpl.previewUrl}) center/cover` : tpl.config.bg ?? '#F6F3EE' }} />
                        <div style={{ padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F0EDE7' }}>{tpl.name}</span>
                            {selected && <Check size={14} color="#D4A853" />}
                          </div>
                          <p style={{ fontSize: 11.5, color: 'rgba(240,237,231,0.45)', marginTop: 4, lineHeight: 1.4 }}>{tpl.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
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
