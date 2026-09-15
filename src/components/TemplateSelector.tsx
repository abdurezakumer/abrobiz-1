import { useMemo, useState, type CSSProperties } from 'react'
import { Check, Eye, Search, Sparkles, X } from 'lucide-react'
import type { Business, Template } from '../types'
import { templateCategory, templateComposition, templateSupportedTypes } from '../lib/templateRegistry'
import { safeImageUrl } from '../lib/safeUrl'

const categories = ['All', 'Restaurant', 'Beauty', 'Dental', 'Spa', 'Massage', 'Hair salon', 'Barbershop', 'Real estate', 'Hospitality', 'Healthcare', 'Professional', 'Retail', 'Fitness', 'Events', 'General'] as const

export default function TemplateSelector({
  templates, selectedSlug, onSelect, businessType, previewBusiness, dark = false, confirmSwitch = true,
}: {
  templates: Template[]
  selectedSlug: string
  onSelect: (slug: string) => void
  businessType?: string
  previewBusiness?: Business | null
  dark?: boolean
  confirmSwitch?: boolean
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Template | null>(null)
  const [pending, setPending] = useState<Template | null>(null)
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return templates.filter(template => {
      const matchesCategory = category === 'All' || templateCategory(template) === category
      const matchesQuery = !normalized || `${template.name} ${template.description} ${templateCategory(template)}`.toLowerCase().includes(normalized)
      return matchesCategory && matchesQuery
    })
  }, [category, query, templates])
  const surface = dark ? 'rgba(255,255,255,0.035)' : '#fff'
  const muted = dark ? 'rgba(240,237,231,0.55)' : 'rgba(10,12,16,0.55)'
  const ink = dark ? '#F0EDE7' : '#0A0C10'

  function requestSelect(template: Template) {
    if (template.slug === selectedSlug) return
    if (confirmSwitch) setPending(template)
    else onSelect(template.slug)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <label style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
          <Search size={15} color={muted} style={{ position: 'absolute', left: 11, top: 11 }} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search templates" aria-label="Search templates" style={{ ...inputStyle, width: '100%', paddingLeft: 34, background: surface, color: ink, borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(10,12,16,0.1)' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 17 }} role="tablist" aria-label="Template categories">
        {categories.map(item => (
          <button key={item} role="tab" aria-selected={category === item} onClick={() => setCategory(item)} style={{ ...pill, whiteSpace: 'nowrap', background: category === item ? (dark ? '#D4A853' : '#0A0C10') : surface, color: category === item ? (dark ? '#0A0C10' : '#fff') : ink, border: `1px solid ${category === item ? 'transparent' : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(10,12,16,0.1)')}` }}>{item}</button>
        ))}
      </div>
      {visible.length === 0 ? <div style={{ color: muted, padding: 24, textAlign: 'center', border: `1px dashed ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(10,12,16,0.15)'}`, borderRadius: 14 }}>No templates match that search.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {visible.map(template => {
            const selected = template.slug === selectedSlug
            const recommended = !!businessType && templateSupportedTypes(template).includes(businessType)
            const previewImage = safeImageUrl(template.previewUrl) ?? safeImageUrl(previewBusiness?.coverUrl)
            return (
              <article key={template.slug} aria-label={`${template.name} template`} style={{ overflow: 'hidden', borderRadius: 16, border: `1.5px solid ${selected ? '#D4A853' : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(10,12,16,0.08)')}`, background: surface, boxShadow: selected ? '0 10px 24px rgba(212,168,83,0.12)' : undefined }}>
                <div style={{ height: 92, position: 'relative', background: previewImage ? `linear-gradient(120deg, ${template.config.heroBg ?? template.config.bg ?? '#222'}88, ${template.config.bg ?? '#222'}), url("${previewImage}") center/cover` : `linear-gradient(135deg, ${template.config.heroBg ?? template.config.bg ?? '#222'}, ${template.config.bg ?? '#111'})` }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 12, color: template.config.text ?? '#fff', fontFamily: template.config.headingFont ?? 'Inter, sans-serif', fontSize: 19, fontWeight: 600 }}>{previewBusiness?.name ?? template.name}</div>
                  {selected && <span style={{ position: 'absolute', top: 10, right: 10, display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 99, background: '#D4A853', color: '#0A0C10' }}><Check size={15} /></span>}
                </div>
                <div style={{ padding: '12px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ margin: 0, color: ink, fontSize: 14, fontWeight: 650 }}>{template.name}</h3>
                    {recommended && <Sparkles size={14} color="#D4A853" aria-label="Recommended for this business type" />}
                  </div>
                  <p style={{ color: muted, fontSize: 12, lineHeight: 1.45, minHeight: 35, margin: '6px 0 10px' }}>{template.description}</p>
                  <div aria-label="Template details" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 11 }}>
                    <span style={featurePill(dark)}>{templateCategory(template)}</span>
                    {template.config.features?.slice(0, 2).map(feature => <span key={feature} style={featurePill(dark)}>{feature}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={() => setPreview(template)} style={{ ...smallButton, color: ink, background: dark ? 'rgba(255,255,255,0.08)' : '#F6F3EE' }}><Eye size={13} /> Preview</button>
                    <button onClick={() => requestSelect(template)} disabled={selected} style={{ ...smallButton, flex: 1, justifyContent: 'center', color: selected ? muted : '#0A0C10', background: selected ? (dark ? 'rgba(255,255,255,0.06)' : '#F0EEE9') : '#D4A853' }}>{selected ? 'Current' : 'Use template'}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {(preview || pending) && (
        <div role="dialog" aria-modal="true" style={overlay} onClick={() => { setPreview(null); setPending(null) }}>
          <div onClick={event => event.stopPropagation()} style={{ position: 'relative', width: 'min(520px, calc(100% - 32px))', maxHeight: '90vh', overflow: 'auto', borderRadius: 20, background: dark ? '#171A20' : '#fff', color: ink, boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>
            <button aria-label="Close" onClick={() => { setPreview(null); setPending(null) }} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'grid', placeItems: 'center', width: 34, height: 34, border: 0, borderRadius: 99, background: dark ? '#252A33' : '#fff', color: ink, cursor: 'pointer' }}><X size={17} /></button>
            {preview && <>
              <div style={{ minHeight: 180, display: 'flex', alignItems: 'flex-end', padding: 24, background: `linear-gradient(120deg, ${preview.config.heroBg ?? preview.config.bg ?? '#222'}ee, ${preview.config.bg ?? '#111'}aa), ${safeImageUrl(previewBusiness?.coverUrl) ? `url("${safeImageUrl(previewBusiness?.coverUrl)}") center/cover` : 'none'}`, color: preview.config.text ?? '#fff' }}><div><div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .7 }}>{templateCategory(preview)}</div><h2 style={{ margin: '8px 0 0', fontFamily: preview.config.headingFont, fontSize: 32 }}>{previewBusiness?.name ?? preview.name}</h2></div></div>
              <div style={{ padding: 22 }}><p style={{ margin: 0, color: muted, lineHeight: 1.6 }}>{preview.description}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>{[templateComposition(preview.slug, preview.config), ...(preview.config.features ?? [])].map(feature => <span key={feature} style={{ fontSize: 11.5, padding: '6px 9px', borderRadius: 99, background: dark ? 'rgba(255,255,255,0.08)' : '#F6F3EE', color: ink }}>{feature}</span>)}</div><button onClick={() => { requestSelect(preview); setPreview(null) }} style={{ ...smallButton, marginTop: 18, padding: '10px 14px', background: '#D4A853', color: '#0A0C10' }}>Use this template</button></div>
            </>}
            {pending && <div style={{ padding: 26 }}><div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#A47721' }}>Switch website design?</div><h2 style={{ margin: '8px 0', fontFamily: 'Outfit, sans-serif' }}>Use {pending.name}?</h2><p style={{ color: muted, lineHeight: 1.6, margin: 0 }}>Your business information, menu, services and settings stay the same. Only the presentation changes.</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}><button onClick={() => setPending(null)} style={{ ...smallButton, padding: '10px 14px', color: ink, background: dark ? 'rgba(255,255,255,0.08)' : '#F6F3EE' }}>Cancel</button><button onClick={() => { onSelect(pending.slug); setPending(null) }} style={{ ...smallButton, padding: '10px 14px', color: '#0A0C10', background: '#D4A853' }}>Confirm switch</button></div></div>}
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 10, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }
const pill: CSSProperties = { borderRadius: 999, padding: '7px 11px', fontSize: 11.5, cursor: 'pointer' }
const smallButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 8, padding: '8px 9px', fontSize: 11.5, fontWeight: 650, cursor: 'pointer' }
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(5,7,10,0.72)' }
const featurePill = (dark: boolean): CSSProperties => ({ fontSize: 10.5, lineHeight: 1, padding: '5px 7px', borderRadius: 99, background: dark ? 'rgba(255,255,255,0.07)' : '#F6F3EE', color: dark ? 'rgba(240,237,231,0.68)' : 'rgba(10,12,16,0.58)' })
