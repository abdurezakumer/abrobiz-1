import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Upload } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { updateBusiness, uploadBusinessImage } from '../lib/api/businesses'
import { listBusinessCategories } from '../lib/api/businessCategories'
import { friendlyError } from '../lib/errors'
import { DAY_LABELS } from '../lib/i18n'
import { listActiveTemplates, mergeTemplateOptions } from '../lib/api/templates'
import { publicStorefrontUrl } from '../lib/storefrontUrl'
import type { Business, BusinessCategory, Language, Template, TemplateSlug, WeeklyHours } from '../types'

const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'Amharic' },
  { code: 'or', label: 'Afaan Oromo' },
]

const DEFAULT_TEMPLATES: Template[] = [
  { id: 'modern-dark', slug: 'modern-dark', name: 'Modern Dark', description: '', config: { bg: '#111318' }, isBuiltin: true, isActive: true, sortOrder: 10, createdAt: '' },
  { id: 'clean-minimal', slug: 'clean-minimal', name: 'Clean Minimal', description: '', config: { bg: '#F6F3EE' }, isBuiltin: true, isActive: true, sortOrder: 20, createdAt: '' },
  { id: 'traditional-warm', slug: 'traditional-warm', name: 'Traditional Warm', description: '', config: { bg: '#5A3E2B' }, isBuiltin: true, isActive: true, sortOrder: 30, createdAt: '' },
  { id: 'restaurant-cafe', slug: 'restaurant-cafe', name: 'Restaurant & Café Editorial', description: 'Warm cream, espresso, amber and editorial typography.', config: { bg: '#FAF8F3', visualStyle: 'heritage', layout: 'restaurant-cafe' }, isBuiltin: true, isActive: true, sortOrder: 35, createdAt: '' },
  { id: 'aurora-glass', slug: 'aurora-glass', name: 'Aurora Glass', description: '', config: { bg: '#07131A' }, isBuiltin: true, isActive: true, sortOrder: 40, createdAt: '' },
  { id: 'luxury-editorial', slug: 'luxury-editorial', name: 'Luxury Editorial', description: '', config: { bg: '#110F0D' }, isBuiltin: true, isActive: true, sortOrder: 50, createdAt: '' },
  { id: 'heritage-boutique', slug: 'heritage-boutique', name: 'Heritage Boutique', description: '', config: { bg: '#2A1B16' }, isBuiltin: true, isActive: true, sortOrder: 60, createdAt: '' },
]

const DAYS: (keyof WeeklyHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function BusinessSettings() {
  const { business, refreshBusiness } = useAuth()
  const [form, setForm] = useState<Business | null>(business)
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES)
  const [categories, setCategories] = useState<BusinessCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => setForm(business), [business])
  useEffect(() => {
    listActiveTemplates().then(remote => setTemplates(mergeTemplateOptions(remote, DEFAULT_TEMPLATES))).catch(() => {})
  }, [])
  useEffect(() => { listBusinessCategories().then(setCategories).catch(() => {}) }, [])

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
    try {
      const url = await uploadBusinessImage('logos', form!.id, file)
      patch('logoUrl', url)
      await updateBusiness(form!.id, { logoUrl: url })
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true)
    setUploadError('')
    try {
      const url = await uploadBusinessImage('covers', form!.id, file)
      patch('coverUrl', url)
      await updateBusiness(form!.id, { coverUrl: url })
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleGalleryUpload(file: File) {
    setUploadingGallery(true)
    setUploadError('')
    try {
      const url = await uploadBusinessImage('covers', form!.id, file)
      const nextGallery = [...form!.galleryUrls, url]
      patch('galleryUrls', nextGallery)
      await updateBusiness(form!.id, { galleryUrls: nextGallery })
    } catch (err) {
      setUploadError(friendlyError(err))
    } finally {
      setUploadingGallery(false)
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

  function toggleLanguage(code: Language) {
    const has = form!.languages.includes(code)
    if (has && form!.languages.length === 1) return
    patch('languages', has ? form!.languages.filter(l => l !== code) : [...form!.languages, code])
  }

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10' }}>Settings</h1>
          <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginTop: 2 }}>Customize how your site looks and works.</p>
        </div>
        <button onClick={handleSave} disabled={saving} style={saveBtn}>
          {saved ? <><Check size={15} /> Saved</> : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {saveError && (
        <div style={{ color: '#B91C1C', fontSize: 13, background: 'rgba(220,38,38,0.08)', padding: '10px 12px', borderRadius: 10, marginBottom: 16 }}>
          {saveError}
        </div>
      )}

      <Section title="Visibility">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isPublished} onChange={e => patch('isPublished', e.target.checked)} style={{ width: 17, height: 17 }} />
          <span style={{ fontSize: 14 }}>Site is published (visible to customers)</span>
        </label>
      </Section>

      <Section title="Website address">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, background: '#F6F3EE', borderRadius: 9, padding: '10px 12px', color: 'rgba(10,12,16,0.65)', fontSize: 13.5 }}>
            {publicStorefrontUrl(form.slug)}
          </div>
          <a href={publicStorefrontUrl(form.slug)} target="_blank" rel="noreferrer" style={{ color: '#8A6417', fontSize: 13, fontWeight: 600 }}>
            View website ↗
          </a>
        </div>
        <p style={{ color: 'rgba(10,12,16,0.45)', fontSize: 12.5, marginTop: 9 }}>
          Your subdomain is based on your business slug. Contact support if you need to change it.
        </p>
      </Section>

      <Section title="Branding">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <ImageUploader label="Logo" imageUrl={form.logoUrl} uploading={uploadingLogo} onUpload={handleLogoUpload} shape="round" />
          <ImageUploader label="Cover photo" imageUrl={form.coverUrl} uploading={uploadingCover} onUpload={handleCoverUpload} shape="wide" />
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

      <Section title="Business info">
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

      <Section title="About page">
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
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
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
                {uploadingGallery ? <span style={{ fontSize: 11, color: 'rgba(10,12,16,0.4)' }}>…</span> : <Upload size={16} color="rgba(10,12,16,0.3)" />}
                <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleGalleryUpload(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section title="Languages">
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

      <Section title="Regional settings">
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

      <Section title="Template">
        <a href="/demo/restaurant-cafe" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 12, color: '#8A6417', fontSize: 12.5, textDecoration: 'underline' }}>Preview the Restaurant & Café demo ↗</a>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {templates.map(tpl => (
            <button
              key={tpl.slug}
              onClick={() => patch('templateSlug', tpl.slug)}
              style={{ borderRadius: 12, overflow: 'hidden', border: form.templateSlug === tpl.slug ? '2px solid #D4A853' : '2px solid transparent', cursor: 'pointer', width: 130 }}
            >
              <div style={{ height: 60, background: tpl.previewUrl ? `url(${tpl.previewUrl}) center/cover` : tpl.config.bg ?? '#F6F3EE' }} />
              <div style={{ fontSize: 12, padding: '6px 8px', textAlign: 'left' }}>{tpl.name}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Opening hours">
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

      <Section title="Social links">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Facebook URL"><input value={form.social.facebookUrl ?? ''} onChange={e => patch('social', { ...form.social, facebookUrl: e.target.value })} style={inputStyle} /></Field>
          <Field label="Instagram URL"><input value={form.social.instagramUrl ?? ''} onChange={e => patch('social', { ...form.social, instagramUrl: e.target.value })} style={inputStyle} /></Field>
          <Field label="TikTok URL"><input value={form.social.tiktokUrl ?? ''} onChange={e => patch('social', { ...form.social, tiktokUrl: e.target.value })} style={inputStyle} /></Field>
          <Field label="Telegram handle"><input value={form.social.telegramHandle ?? ''} onChange={e => patch('social', { ...form.social, telegramHandle: e.target.value })} style={inputStyle} /></Field>
        </div>
      </Section>
    </DashboardLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: '18px 20px', marginBottom: 16 }}>
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

function ImageUploader({ label, imageUrl, uploading, onUpload, shape }: { label: string; imageUrl?: string; uploading: boolean; onUpload: (f: File) => void; shape: 'round' | 'wide' }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)', marginBottom: 6 }}>{label}</div>
      <label style={{ cursor: 'pointer', display: 'block' }}>
        <div
          style={{
            width: shape === 'round' ? 84 : 220, height: shape === 'round' ? 84 : 100,
            borderRadius: shape === 'round' ? '50%' : 12,
            background: imageUrl ? `url(${imageUrl}) center/cover` : '#F6F3EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(10,12,16,0.15)',
          }}
        >
          {!imageUrl && <Upload size={18} color="rgba(10,12,16,0.3)" />}
        </div>
        <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        <span style={{ fontSize: 11.5, color: '#D4A853', marginTop: 4, display: 'block' }}>{uploading ? 'Uploading…' : 'Click to change'}</span>
      </label>
    </div>
  )
}

const inputStyle: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }
const chip: React.CSSProperties = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
const saveBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
