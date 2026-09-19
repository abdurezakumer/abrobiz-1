import { useState } from 'react'
import { Check, Copy, Sparkles } from 'lucide-react'
import { approveWebsiteCopy, COPY_SECTIONS, COPY_TONES, generateWebsiteCopy, type AICopyGeneration, type CopySection, type CopyTone } from '../lib/aiCopy'
import { friendlyError } from '../lib/errors'
import type { Language } from '../types'

const sectionLabels: Record<CopySection, string> = { all: 'Full website', hero: 'Homepage hero', about: 'About section', services: 'Services / menu', contact: 'Contact intro', location: 'Location intro', seo: 'SEO metadata' }
const toneLabels: Record<CopyTone, string> = { professional: 'Professional', premium: 'Premium', friendly: 'Friendly', modern: 'Modern', minimal: 'Minimal', persuasive: 'Persuasive' }

export default function AICopyGenerator({ businessId, languages, enabled = true, planName }: { businessId: string; languages: Language[]; enabled?: boolean; planName?: string }) {
  const [language, setLanguage] = useState<Language>(languages[0] ?? 'en')
  const [tone, setTone] = useState<CopyTone>('professional')
  const [section, setSection] = useState<CopySection>('all')
  const [generation, setGeneration] = useState<AICopyGeneration | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!enabled) {
    return (
      <div style={{ border: '1px solid rgba(138,100,23,.2)', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg, #fffdf8, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8A6417', fontWeight: 700, fontSize: 14 }}><Sparkles size={16} /> Professional copy assistant</div>
        <p style={{ color: 'rgba(10,12,16,.62)', fontSize: 12.5, lineHeight: 1.55, margin: '8px 0 0' }}>Coming soon on your current plan. Upgrade to a higher plan to unlock AI-powered website copy.</p>
        {planName && <div style={{ color: 'rgba(10,12,16,.42)', fontSize: 11.5, marginTop: 8 }}>Current plan: {planName}</div>}
      </div>
    )
  }

  async function handleGenerate() {
    setBusy(true); setError(''); setMessage('')
    try {
      setGeneration(await generateWebsiteCopy({ businessId, language, tone, section }))
      setMessage('Draft ready. Review it before applying it to your public website.')
    } catch (err) {
      setError(err instanceof Error ? err.message : friendlyError(err))
    } finally { setBusy(false) }
  }

  async function handleApprove() {
    if (!generation) return
    setApplying(true); setError(''); setMessage('')
    try {
      const approved = await approveWebsiteCopy(generation.id)
      setGeneration(approved)
      setMessage('Copy applied. Your public website will use it on its next refresh.')
    } catch (err) {
      setError(err instanceof Error ? err.message : friendlyError(err))
    } finally { setApplying(false) }
  }

  const content = generation?.content
  return (
    <div aria-busy={busy} style={{ border: '1px solid rgba(138,100,23,.2)', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg, #fffdf8, #fff)' }}>
      <style>{'@keyframes abrobiz-ai-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8A6417', fontWeight: 700, fontSize: 14 }}><Sparkles size={16} /> Professional copy assistant</div>
          <p style={{ color: 'rgba(10,12,16,.56)', fontSize: 12.5, lineHeight: 1.55, margin: '7px 0 0', maxWidth: 610 }}>Creates a reviewable draft from your currently saved business information. It never changes your name, prices, services, contact details, or other source data.</p>
        </div>
        {generation && <span style={{ fontSize: 11, fontWeight: 700, color: generation.status === 'APPROVED' ? '#166534' : '#8A6417', background: generation.status === 'APPROVED' ? '#DCFCE7' : '#F7EBCB', borderRadius: 999, padding: '6px 9px' }}>{generation.status === 'APPROVED' ? 'Live on website' : 'Draft preview'}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 15 }}>
        <label style={labelStyle}>Language<select value={language} onChange={event => setLanguage(event.target.value as Language)} style={inputStyle}>{languages.map(value => <option key={value} value={value}>{value === 'en' ? 'English' : value === 'am' ? 'Amharic' : 'Afaan Oromo'}</option>)}</select></label>
        <label style={labelStyle}>Tone<select value={tone} onChange={event => setTone(event.target.value as CopyTone)} style={inputStyle}>{COPY_TONES.map(value => <option key={value} value={value}>{toneLabels[value]}</option>)}</select></label>
        <label style={labelStyle}>Generate<select value={section} onChange={event => setSection(event.target.value as CopySection)} style={inputStyle}>{COPY_SECTIONS.map(value => <option key={value} value={value}>{sectionLabels[value]}</option>)}</select></label>
      </div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 13 }}>
        <button type="button" onClick={() => void handleGenerate()} disabled={busy || applying} style={primaryButton}>{busy ? 'Writing a draft…' : generation ? 'Regenerate draft' : 'Generate professional copy'}</button>
        {generation && generation.status === 'DRAFT' && <button type="button" onClick={() => void handleApprove()} disabled={busy || applying} style={secondaryButton}>{applying ? 'Applying…' : <><Check size={14} /> Apply to website</>}</button>}
      </div>
      {busy && <div style={{ color: '#8A6417', fontSize: 12, marginTop: 10 }}>Analyzing your saved details, writing, and checking the draft…</div>}
      {message && <div style={{ color: '#166534', fontSize: 12.5, marginTop: 10 }}>{message}</div>}
      {error && <div style={{ color: '#B91C1C', background: '#FEF2F2', borderRadius: 9, padding: '9px 10px', fontSize: 12.5, marginTop: 10 }}>{error}</div>}

      {busy && <CopyLoadingSkeleton />}
      {content && <div style={{ marginTop: 16, borderTop: '1px solid rgba(10,12,16,.09)', paddingTop: 15 }}>
        <div style={{ fontSize: 12, color: 'rgba(10,12,16,.48)', marginBottom: 10 }}>Preview — nothing becomes public until you apply this draft.</div>
        {content.hero && <PreviewBlock title="Homepage hero"><strong style={{ fontSize: 19 }}>{content.hero.headline}</strong><p style={previewText}>{content.hero.subheadline}</p><small>{content.hero.primaryCta || 'Primary action'}{content.hero.secondaryCta ? ` · ${content.hero.secondaryCta}` : ''}</small></PreviewBlock>}
        {content.about && <PreviewBlock title={content.about.title}><p style={previewText}>{content.about.description}</p></PreviewBlock>}
        {content.services?.length ? <PreviewBlock title="Services / menu"><div style={{ display: 'grid', gap: 8 }}>{content.services.map(item => <div key={item.sourceId} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8F5EE' }}><strong style={{ fontSize: 13 }}>{item.title}</strong><div style={{ color: 'rgba(10,12,16,.58)', fontSize: 12, marginTop: 3 }}>{item.shortDescription}</div></div>)}</div></PreviewBlock> : null}
        {content.seo && <PreviewBlock title="SEO"><strong style={{ fontSize: 13 }}>{content.seo.title}</strong><p style={previewText}>{content.seo.description}</p></PreviewBlock>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(10,12,16,.45)', fontSize: 11.5, marginTop: 10 }}><Copy size={12} /> Source facts remain controlled by your business settings.</div>
      </div>}
    </div>
  )
}

function CopyLoadingSkeleton() {
  return (
    <div role="status" aria-label="Preparing your AI copy preview" style={{ marginTop: 16, borderTop: '1px solid rgba(10,12,16,.09)', paddingTop: 15 }}>
      <div style={{ width: 118, height: 10, borderRadius: 999, ...skeletonBlock, marginBottom: 12 }} />
      <div style={{ width: '72%', height: 21, borderRadius: 6, ...skeletonBlock, marginBottom: 9 }} />
      <div style={{ width: '94%', height: 11, borderRadius: 999, ...skeletonBlock, marginBottom: 7 }} />
      <div style={{ width: '82%', height: 11, borderRadius: 999, ...skeletonBlock, marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {[1, 2, 3].map(item => <div key={item} style={{ height: 48, borderRadius: 9, ...skeletonBlock }} />)}
      </div>
      <span style={{ display: 'block', color: 'rgba(10,12,16,.45)', fontSize: 11.5, marginTop: 10 }}>Preparing a safe draft preview…</span>
    </div>
  )
}

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><div style={{ color: '#8A6417', fontSize: 11, fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase', marginBottom: 5 }}>{title}</div>{children}</div>
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'rgba(10,12,16,.5)', fontWeight: 600 }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid rgba(10,12,16,.13)', borderRadius: 8, background: '#fff', padding: '9px 10px', color: '#0A0C10', fontSize: 12.5 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 9, background: '#0A0C10', color: '#fff', padding: '10px 13px', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(138,100,23,.35)', borderRadius: 9, background: '#fff', color: '#8A6417', padding: '9px 12px', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const previewText: React.CSSProperties = { color: 'rgba(10,12,16,.62)', fontSize: 13, lineHeight: 1.6, margin: '5px 0' }
const skeletonBlock: React.CSSProperties = { background: 'linear-gradient(100deg, rgba(10,12,16,.07) 30%, rgba(255,255,255,.88) 50%, rgba(10,12,16,.07) 70%)', backgroundSize: '220% 100%', animation: 'abrobiz-ai-skeleton 1.25s ease-in-out infinite' }
