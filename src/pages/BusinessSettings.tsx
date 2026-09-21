import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Building2, Check, Facebook, FileText, Instagram, LayoutTemplate, Music2, Palette, Send, Share2, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { updateBusiness, uploadBusinessImage } from '../lib/api/businesses'
import { listBusinessCategories } from '../lib/api/businessCategories'
import { friendlyError } from '../lib/errors'
import { DAY_LABELS } from '../lib/i18n'
import { listActiveTemplates, mergeTemplateOptions } from '../lib/api/templates'
import { publicStorefrontUrl } from '../lib/storefrontUrl'
import { safeImageUrl } from '../lib/safeUrl'
import type { Business, BusinessCategory, Language, Template, WeeklyHours } from '../types'
import { fileInputStyle, IMAGE_UPLOAD_ACCEPT, takeSelectedFile } from '../lib/fileUpload'
import TemplateSelector from '../components/TemplateSelector'
import { BUILTIN_TEMPLATES } from '../lib/templateRegistry'
import AICopyGenerator from '../components/AICopyGenerator'
import { hasFeature } from '../lib/entitlements'
import { listMySupportRequests, requestWebsiteAddressChange, type SupportRequest } from '../lib/api/support'

const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'Amharic' },
  { code: 'or', label: 'Afaan Oromo' },
]

const DAYS: (keyof WeeklyHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
type SettingsCategory = 'business' | 'branding' | 'social' | 'template' | 'content'

const SETTINGS_CATEGORIES: { id: SettingsCategory; label: string; description: string; icon: typeof Building2 }[] = [
  { id: 'business', label: 'Business info', description: 'Details, address, hours, and visibility', icon: Building2 },
  { id: 'branding', label: 'Branding', description: 'Logo, cover photo, and colors', icon: Palette },
  { id: 'social', label: 'Social links', description: 'Profiles shown on your website', icon: Share2 },
  { id: 'template', label: 'Website template', description: 'Choose your website design', icon: LayoutTemplate },
  { id: 'content', label: 'Content & preferences', description: 'About, languages, and AI writing', icon: FileText },
]

export default function BusinessSettings() {
  const { business, subscription, refreshBusiness } = useAuth()
  const [form, setForm] = useState<Business | null>(business)
  const [templates, setTemplates] = useState<Template[]>(BUILTIN_TEMPLATES)
  const [categories, setCategories] = useState<BusinessCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [requestedSubdomain, setRequestedSubdomain] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportError, setSupportError] = useState('')
  const [supportSaved, setSupportSaved] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('business')

  useEffect(() => setForm(business), [business])
  useEffect(() => {
    listActiveTemplates().then(remote => setTemplates(mergeTemplateOptions(remote, BUILTIN_TEMPLATES))).catch(() => {})
  }, [])
  useEffect(() => { listBusinessCategories().then(setCategories).catch(() => {}) }, [])
  useEffect(() => {
    if (!business?.id) return
    listMySupportRequests(business.id).then(setSupportRequests).catch(() => setSupportRequests([]))
  }, [business?.id])

  if (!form) return null

  function patch<K extends keyof Business>(key: K, value: Business[K]) {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setSaveError('')
    try {
      await updateBusiness(form.id, {
        name: form.name,
        description: form.description,
        aboutContent: form.aboutContent,
        galleryUrls: form.galleryUrls,
        phone: form.phone,
        email: form.email,
        address: form.address,
        mapsUrl: form.mapsUrl,
        templateSlug: form.templateSlug,
        languages: form.languages,
        accentColor: form.accentColor,
        openingHours: form.openingHours,
        social: form.social,
        currency: form.currency,
        timezone: form.timezone,
        categoryId: form.categoryId,
        isPublished: form.isPublished,
      })
      await refreshBusiness()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    setUploadError('')
    setUploadProgress(0)
    try {
      const url = await uploadBusinessImage('logos', form!.id, file, setUploadProgress)
      await updateBusiness(form!.id, { logoUrl: url })
      patch('logoUrl', url)
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingLogo(false)
      setUploadProgress(null)
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true)
    setUploadError('')
    setUploadProgress(0)
    try {
      const url = await uploadBusinessImage('covers', form!.id, file, setUploadProgress)
      await updateBusiness(form!.id, { coverUrl: url })
      patch('coverUrl', url)
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingCover(false)
      setUploadProgress(null)
    }
  }

  async function handleGalleryUpload(file: File) {
    setUploadingGallery(true)
    setUploadError('')
    setUploadProgress(0)
    try {
      const url = await uploadBusinessImage('covers', form!.id, file, setUploadProgress)
      const nextGallery = [...form!.galleryUrls, url]
      await updateBusiness(form!.id, { galleryUrls: nextGallery })
      patch('galleryUrls', nextGallery)
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingGallery(false)
      setUploadProgress(null)
    }
  }

  async function handleGalleryRemove(index: number) {
    const previousGallery = form!.galleryUrls
    const nextGallery = previousGallery.filter((_, itemIndex) => itemIndex !== index)
    patch('galleryUrls', nextGallery)
    setSaveError('')
    try {
      await updateBusiness(form!.id, { galleryUrls: nextGallery })
    } catch (err) {
      patch('galleryUrls', previousGallery)
      setSaveError(friendlyError(err))
    }
  }

  async function handleAddressRequest() {
    if (!form || !requestedSubdomain.trim()) return
    setSupportBusy(true)
    setSupportError('')
    setSupportSaved(false)
    try {
      const created = await requestWebsiteAddressChange(form.id, requestedSubdomain.trim().toLowerCase(), requestMessage)
      setSupportRequests(current => [created, ...current])
      setRequestedSubdomain('')
      setRequestMessage('')
      setSupportSaved(true)
    } catch (err) {
      setSupportError(friendlyError(err))
    } finally {
      setSupportBusy(false)
    }
  }

  function toggleLanguage(code: Language) {
    const has = form!.languages.includes(code)
    if (has && form!.languages.length === 1) return
    patch('languages', has ? form!.languages.filter(l => l !== code) : [...form!.languages, code])
  }

  return (
    <DashboardLayout>
      <style>{`\n        .settings-category-nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }\n        .settings-section { min-width: 0; }\n        .settings-category-button { min-width: 0; }\n        .settings-save-button { white-space: nowrap; }\n        @media (max-width: 760px) {\n          .settings-header { top: 58px !important; }\n          .settings-header > div:first-child { min-width: 0; }\n          .settings-header h1 { font-size: 21px !important; }\n          .settings-header p { max-width: 220px; line-height: 1.35; }\n          .settings-save-button { width: 100%; justify-content: center; }\n          .settings-category-nav { display: flex; overflow-x: auto; padding: 2px 1px 6px; scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }\n          .settings-category-nav::-webkit-scrollbar { display: none; }\n          .settings-category-button { flex: 0 0 184px; }\n          .settings-section { padding: 15px 14px !important; border-radius: 14px !important; overflow: hidden; }\n          .settings-section input, .settings-section select, .settings-section textarea { max-width: 100%; }\n        }\n        @media (max-width: 380px) {\n          .settings-category-button { flex-basis: 168px; }\n        }\n      `}</style>
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 12, background: '#F6F3EE', padding: '8px 0 14px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10' }}>Settings</h1>
          <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginTop: 2 }}>Customize how your site looks and works.</p>
        </div>
        <button className="settings-save-button" onClick={handleSave} disabled={saving} style={saveBtn}>
          {saved ? <><Check size={15} /> Saved</> : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="settings-category-nav" role="tablist" aria-label="Settings categories">
        {SETTINGS_CATEGORIES.map(category => {
          const Icon = category.icon
          const active = activeCategory === category.id
          return (
            <button
              key={category.id}
              className="settings-category-button"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveCategory(category.id)}
              style={{ ...categoryButton, ...(active ? categoryButtonActive : {}) }}
            >
              <Icon size={17} />
              <span style={{ minWidth: 0, textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: 13 }}>{category.label}</strong>
                <small style={{ display: 'block', marginTop: 3, color: active ? 'rgba(10,12,16,0.62)' : 'rgba(10,12,16,0.48)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{category.description}</small>
              </span>
            </button>
          )
        })}
      </div>

      {saveError && (
        <div style={{ color: '#B91C1C', fontSize: 13, background: 'rgba(220,38,38,0.08)', padding: '10px 12px', borderRadius: 10, marginBottom: 16 }}>
          {saveError}
        </div>
      )}

      <Section title="Visibility" category="business" activeCategory={activeCategory}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isPublished} onChange={e => patch('isPublished', e.target.checked)} style={{ width: 17, height: 17 }} />
          <span style={{ fontSize: 14 }}>Site is published (visible to customers)</span>
        </label>
      </Section>

      <Section title="Website address" category="business" activeCategory={activeCategory}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, background: '#F6F3EE', borderRadius: 9, padding: '10px 12px', color: 'rgba(10,12,16,0.65)', fontSize: 13.5 }}>
            {publicStorefrontUrl(form.slug)}
          </div>
          <a href={publicStorefrontUrl(form.slug)} target="_blank" rel="noopener noreferrer" style={{ color: '#8A6417', fontSize: 13, fontWeight: 600 }}>
            View website ↗
          </a>
        </div>
        <p style={{ color: 'rgba(10,12,16,0.45)', fontSize: 12.5, marginTop: 9 }}>
          Your address is protected after setup. If you need a change, send a request to AbroBiz Support for review.
        </p>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(10,12,16,0.07)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Request a different address</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 230px', border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '0 10px' }}>
              <input value={requestedSubdomain} onChange={event => setRequestedSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="new-business-name" aria-label="Requested subdomain" style={{ ...inputStyle, border: 0, paddingLeft: 0, flex: 1, minWidth: 0 }} />
              <span style={{ color: 'rgba(10,12,16,0.4)', fontSize: 12 }}>.abrobiz.com</span>
            </div>
            <button type="button" onClick={() => void handleAddressRequest()} disabled={supportBusy || requestedSubdomain.trim().length < 3} style={{ ...saveBtn, opacity: supportBusy || requestedSubdomain.trim().length < 3 ? .55 : 1 }}>{supportBusy ? 'Sending…' : 'Send request'}</button>
          </div>
          <textarea value={requestMessage} onChange={event => setRequestMessage(event.target.value)} rows={2} maxLength={1000} placeholder="Optional: tell support why you need this change." style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: 9 }} />
          {supportSaved && <div style={{ color: '#166534', fontSize: 12.5, marginTop: 8 }}>Request sent. Support will review it and notify you in your AbroBiz account.</div>}
          {supportError && <div style={{ color: '#B91C1C', fontSize: 12.5, marginTop: 8 }}>{supportError}</div>}
          {supportRequests.length > 0 && <div style={{ display: 'grid', gap: 7, marginTop: 14 }}>{supportRequests.slice(0, 3).map(request => <div key={request.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '9px 10px', borderRadius: 9, background: '#F6F3EE', fontSize: 12 }}><span><strong>{request.currentSubdomain}.abrobiz.com</strong> → <strong>{request.requestedSubdomain ?? '—'}.abrobiz.com</strong><small style={{ display: 'block', color: 'rgba(10,12,16,0.48)', marginTop: 3 }}>{new Date(request.createdAt).toLocaleDateString()}</small></span><span style={{ color: request.status === 'completed' ? '#166534' : request.status === 'rejected' ? '#B91C1C' : '#8A6417', fontWeight: 700, textTransform: 'capitalize' }}>{request.status.replace('_', ' ')}</span></div>)}</div>}
        </div>
      </Section>

      <Section title="Branding" category="branding" activeCategory={activeCategory}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <ImageUploader label="Logo" imageUrl={form.logoUrl} uploading={uploadingLogo} progress={uploadingLogo ? uploadProgress : null} onUpload={handleLogoUpload} shape="round" />
          <ImageUploader label="Cover photo" imageUrl={form.coverUrl} uploading={uploadingCover} progress={uploadingCover ? uploadProgress : null} onUpload={handleCoverUpload} shape="wide" />
        </div>
        {uploadError && (
          <div style={{ color: '#DC2626', fontSize: 12.5, marginTop: 12, background: 'rgba(220,38,38,0.08)', padding: '9px 12px', borderRadius: 9 }}>
            {uploadError}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <label style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)' }}>Accent color</label>
          <input type="color" value={form.accentColor} onChange={e => patch('accentColor', e.target.value)} style={{ width: 42, height: 30, padding: 2, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 7, background: '#fff', cursor: 'pointer' }} />
          <code style={{ fontSize: 12, color: 'rgba(10,12,16,0.55)' }}>{form.accentColor}</code>
        </div>
      </Section>

      <Section title="Business info" category="business" activeCategory={activeCategory}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Name"><input value={form.name} onChange={e => patch('name', e.target.value)} style={inputStyle} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={e => patch('phone', e.target.value)} style={inputStyle} /></Field>
          <Field label="Email"><input value={form.email} onChange={e => patch('email', e.target.value)} style={inputStyle} /></Field>
          <Field label="Address"><input value={form.address} onChange={e => patch('address', e.target.value)} style={inputStyle} /></Field>
          <Field label="Google Maps link"><input value={form.mapsUrl} onChange={e => patch('mapsUrl', e.target.value)} style={inputStyle} /></Field>
          <Field label="Business type">
            <select value={form.categoryId ?? ''} onChange={e => patch('categoryId', e.target.value || null)} style={inputStyle}>
              <option value="">Choose a type</option>
              {categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Short tagline (shown on your homepage)">
            <textarea value={form.description} onChange={e => patch('description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', width: '100%' }} placeholder="One or two sentences that sum up your business" />
          </Field>
        </div>
      </Section>

      <Section title="About page" category="content" activeCategory={activeCategory}>
        <Field label="Your story">
          <textarea
            value={form.aboutContent}
            onChange={e => patch('aboutContent', e.target.value)}
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', width: '100%' }}
            placeholder="Tell customers who you are, your history, what makes you different. Use a blank line between paragraphs."
          />
        </Field>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)', marginBottom: 8 }}>Photo gallery (shown on your About page)</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {form.galleryUrls.map((url, i) => (
              <div key={url} style={{ position: 'relative', width: 90, height: 90 }}>
                <img src={safeImageUrl(url) ?? undefined} alt="" width={90} height={90} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                <button
                  onClick={() => handleGalleryRemove(i)}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#0A0C10', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
            {form.galleryUrls.length < 8 && (
              <label style={{ width: 90, height: 90, borderRadius: 10, border: '1px dashed rgba(10,12,16,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F6F3EE' }}>
                {uploadingGallery ? <div style={{ width: 58, textAlign: 'center' }}><span style={{ fontSize: 11, color: 'rgba(10,12,16,0.4)' }}>{uploadProgress ?? 0}%</span><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress ?? 0} style={{ height: 4, marginTop: 5, borderRadius: 99, background: 'rgba(10,12,16,0.1)', overflow: 'hidden' }}><div style={{ width: `${uploadProgress ?? 0}%`, height: '100%', background: '#D4A853' }} /></div></div> : (
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <ArrowUp size={12} color="#D4A853" strokeWidth={2.5} />
                    <Upload size={16} color="rgba(10,12,16,0.3)" />
                  </motion.div>
                )}
                <input type="file" accept={IMAGE_UPLOAD_ACCEPT} style={fileInputStyle} onChange={e => { const file = takeSelectedFile(e.currentTarget); if (file) void handleGalleryUpload(file) }} />
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section title="AI website copy" category="content" activeCategory={activeCategory}>
        <AICopyGenerator businessId={form.id} languages={form.languages} enabled={hasFeature(subscription, 'aiCopy')} planName={subscription?.plan?.name} />
      </Section>

      <Section title="Languages" category="content" activeCategory={activeCategory}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_LANGUAGES.map(l => {
            const active = form.languages.includes(l.code)
            return (
              <button key={l.code} onClick={() => toggleLanguage(l.code)} style={{ ...chip, background: active ? '#0A0C10' : '#F6F3EE', color: active ? '#fff' : '#0A0C10' }}>
                {l.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Regional settings" category="business" activeCategory={activeCategory}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Currency">
            <select value={form.currency} onChange={e => patch('currency', e.target.value)} style={inputStyle}>
              <option value="ETB">ETB — Ethiopian birr</option>
              <option value="USD">USD — US dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British pound</option>
              <option value="KES">KES — Kenyan shilling</option>
            </select>
          </Field>
          <Field label="Timezone">
            <select value={form.timezone} onChange={e => patch('timezone', e.target.value)} style={inputStyle}>
              <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
              <option value="Africa/Nairobi">Africa/Nairobi</option>
              <option value="Africa/Cairo">Africa/Cairo</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Template" category="template" activeCategory={activeCategory}>
        <a href="/demo/restaurant-cafe" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 12, color: '#8A6417', fontSize: 12.5, textDecoration: 'underline' }}>Preview the Restaurant & Café demo ↗</a>
        <TemplateSelector
          templates={templates}
          selectedSlug={form.templateSlug}
          onSelect={slug => patch('templateSlug', slug)}
          businessType={categories.find(category => category.id === form.categoryId)?.slug}
          previewBusiness={form}
        />
      </Section>

      <Section title="Opening hours" category="business" activeCategory={activeCategory}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAYS.map(day => {
            const hours = form.openingHours[day]
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 90, fontSize: 13, color: '#0A0C10' }}>{DAY_LABELS[day].en}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <input type="checkbox" checked={!hours.closed} onChange={e => patch('openingHours', { ...form.openingHours, [day]: { ...hours, closed: !e.target.checked } })} />
                  Open
                </label>
                {!hours.closed && (
                  <>
                    <input type="time" value={hours.open} onChange={e => patch('openingHours', { ...form.openingHours, [day]: { ...hours, open: e.target.value } })} style={{ ...inputStyle, width: 110 }} />
                    <span style={{ fontSize: 12, color: 'rgba(10,12,16,0.4)' }}>to</span>
                    <input type="time" value={hours.close} onChange={e => patch('openingHours', { ...form.openingHours, [day]: { ...hours, close: e.target.value } })} style={{ ...inputStyle, width: 110 }} />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Social links" category="social" activeCategory={activeCategory}>
        <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 12.5, lineHeight: 1.55, margin: '-3px 0 14px' }}>Add only your username or page name. AbroBiz adds the official platform link automatically, and saved profiles appear as real icons in your public website footer.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <SocialField label="Facebook" prefix="https://facebook.com/" icon={<Facebook size={16} />} value={socialUsername(form.social.facebookUrl, 'facebook.com')} onChange={value => patch('social', { ...form.social, facebookUrl: socialUrl(value, 'https://facebook.com/') })} />
          <SocialField label="Instagram" prefix="https://instagram.com/" icon={<Instagram size={16} />} value={socialUsername(form.social.instagramUrl, 'instagram.com')} onChange={value => patch('social', { ...form.social, instagramUrl: socialUrl(value, 'https://instagram.com/') })} />
          <SocialField label="TikTok" prefix="https://tiktok.com/" icon={<Music2 size={16} />} value={socialUsername(form.social.tiktokUrl, 'tiktok.com')} onChange={value => patch('social', { ...form.social, tiktokUrl: socialUrl(value, 'https://tiktok.com/') })} />
          <SocialField label="Telegram" prefix="https://t.me/" icon={<Send size={16} />} value={socialUsername(form.social.telegramHandle, 't.me')} onChange={value => patch('social', { ...form.social, telegramHandle: socialHandle(value) })} />
        </div>
      </Section>
    </DashboardLayout>
  )
}

function Section({ title, children, category, activeCategory }: { title: string; children: React.ReactNode; category: SettingsCategory; activeCategory: SettingsCategory }) {
  const hidden = category !== activeCategory
  return (
    <motion.div className="settings-section" initial={{ opacity: 0, y: 6 }} animate={{ opacity: hidden ? 0 : 1, y: hidden ? 0 : 6 }} style={{ display: hidden ? 'none' : 'block', background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0C10', marginBottom: 14 }}>{title}</div>
      {children}
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}

function SocialField({ label, prefix, icon, value, onChange }: { label: string; prefix: string; icon: ReactNode; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#0A0C10', fontSize: 12.5, fontWeight: 650 }}>{icon}<span>{label}</span></span>
      <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, background: '#fff', overflow: 'hidden' }}>
        <span style={{ flexShrink: 0, padding: '9px 0 9px 10px', color: 'rgba(10,12,16,0.42)', fontSize: 12 }}>{prefix}</span>
        <input aria-label={`${label} username`} value={value} onChange={event => onChange(event.target.value)} placeholder="your-username" style={{ ...inputStyle, minWidth: 0, flex: 1, border: 'none', borderRadius: 0, paddingLeft: 3 }} />
      </span>
    </label>
  )
}

function socialUsername(value: string | undefined, host: string): string {
  if (!value?.trim()) return ''
  const candidate = value.trim()
  try {
    const parsed = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
    if (parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)) return parsed.pathname.replace(/^\/+|\/+$/g, '').replace(/^@/, '')
  } catch { /* Treat it as a username below. */ }
  return candidate.replace(/^@/, '').replace(/^\/+|\/+$/g, '')
}

function socialUrl(value: string, prefix: string): string | undefined {
  const clean = value.trim()
  if (!clean) return undefined
  if (/^https:\/\//i.test(clean)) return clean
  return `${prefix}${clean.replace(/^@/, '').replace(/^\/+/, '')}`
}

function socialHandle(value: string): string | undefined {
  const clean = value.trim()
  if (!clean) return undefined
  return socialUsername(clean, 't.me').replace(/^@/, '')
}

function ImageUploader({ label, imageUrl, uploading, progress, onUpload, shape }: { label: string; imageUrl?: string; uploading: boolean; progress: number | null; onUpload: (f: File) => void; shape: 'round' | 'wide' }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)', marginBottom: 6 }}>{label}</div>
      <label style={{ cursor: 'pointer', display: 'block' }}>
        <div
          style={{
            width: shape === 'round' ? 84 : 220, height: shape === 'round' ? 84 : 100,
            borderRadius: shape === 'round' ? '50%' : 12,
            background: safeImageUrl(imageUrl) ? `url("${safeImageUrl(imageUrl)}") center/cover` : '#F6F3EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(10,12,16,0.15)',
          }}
        >
          {!imageUrl && (
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <ArrowUp size={14} color="#D4A853" strokeWidth={2.5} />
              <Upload size={18} color="rgba(10,12,16,0.3)" />
            </motion.div>
          )}
        </div>
        <input type="file" accept={IMAGE_UPLOAD_ACCEPT} style={fileInputStyle} disabled={uploading} onChange={e => { const file = takeSelectedFile(e.currentTarget); if (file) void onUpload(file) }} />
        {uploading && <div role="progressbar" aria-label={`${label} upload progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0} style={{ height: 5, width: shape === 'round' ? 84 : 220, maxWidth: '100%', marginTop: 7, borderRadius: 99, background: 'rgba(10,12,16,0.1)', overflow: 'hidden' }}><div style={{ width: `${progress ?? 0}%`, height: '100%', background: '#D4A853', transition: 'width 180ms ease' }} /></div>}
        <span style={{ fontSize: 11.5, color: '#D4A853', marginTop: 4, display: 'block' }}>{uploading ? `Uploading… ${progress ?? 0}%` : 'Click to change'}</span>
      </label>
    </div>
  )
}

const inputStyle: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }
const chip: React.CSSProperties = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
const saveBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const categoryButton: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, padding: '11px 12px', border: '1px solid rgba(10,12,16,0.08)', borderRadius: 12, background: '#fff', color: '#0A0C10', cursor: 'pointer', textAlign: 'left' }
const categoryButtonActive: React.CSSProperties = { background: '#D4A853', borderColor: '#D4A853', boxShadow: '0 5px 14px rgba(212,168,83,0.22)' }
