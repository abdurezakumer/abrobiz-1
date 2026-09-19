import { MapPin, Phone, Sparkles, Star } from 'lucide-react'
import type { Business, Template } from '../types'
import { safeImageUrl } from '../lib/safeUrl'
import { templateCategory, templateComposition } from '../lib/templateRegistry'

/**
 * A presentation-only, long-form preview used by the template selector.
 * It deliberately does not query Supabase: the selector supplies the current
 * business draft when one exists, otherwise this is clearly marked as sample
 * content and nothing is persisted.
 */
export default function TemplatePreviewSurface({ template, business }: { template: Template; business?: Business | null }) {
  const config = template.config
  const ink = config.text ?? '#F7F3EC'
  const muted = config.textDim ?? 'rgba(247,243,236,0.68)'
  const background = config.bg ?? '#161616'
  const card = config.card ?? 'rgba(255,255,255,0.08)'
  const accent = business?.accentColor ?? '#D4A853'
  const heroImage = safeImageUrl(business?.coverUrl)
  const logo = safeImageUrl(business?.logoUrl)
  const gallery = (business?.galleryUrls ?? []).map(safeImageUrl).filter((url): url is string => Boolean(url)).slice(0, 3)
  const name = business?.name?.trim() || 'Your business name'
  const description = business?.description?.trim() || 'A polished place for your customers to discover what makes your business special.'
  const category = templateCategory(template)
  const features = (config.features ?? []).slice(0, 4)
  const sample = !business

  return (
    <div style={{ background, color: ink, minHeight: 760, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', background: `${background}ee`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${config.border ?? 'rgba(255,255,255,0.12)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {logo ? <img src={logo} alt="" width={28} height={28} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: accent, color: '#101010', fontWeight: 800 }}>{name.slice(0, 1).toUpperCase()}</span>}
          <strong style={{ fontFamily: config.headingFont ?? 'Outfit, sans-serif', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 14, color: muted, fontSize: 11.5 }}><span>Home</span><span>Services</span><span>Contact</span></div>
      </div>

      {sample && <div style={{ margin: '14px 18px 0', padding: '8px 10px', borderRadius: 8, color: '#5D4617', background: '#FFF1C7', fontSize: 11.5 }}><Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Sample preview — replace the content with your business information.</div>}

      <section style={{ position: 'relative', minHeight: 270, display: 'flex', alignItems: 'flex-end', padding: 28, marginTop: sample ? 14 : 0, overflow: 'hidden', background: heroImage ? `linear-gradient(110deg, ${background}f2 18%, ${background}9c 65%, ${background}44), url("${heroImage}") center/cover` : `linear-gradient(125deg, ${config.heroBg ?? background}, ${background})` }}>
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ color: accent, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{category} · {templateComposition(template.slug, config)}</div>
          <h1 style={{ margin: '12px 0 10px', fontFamily: config.headingFont ?? 'Outfit, sans-serif', fontSize: 'clamp(31px, 6vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.035em' }}>{name}</h1>
          <p style={{ maxWidth: 470, margin: 0, color: muted, fontSize: 14, lineHeight: 1.65 }}>{description}</p>
          <button type="button" style={{ marginTop: 20, border: 0, borderRadius: 6, padding: '11px 16px', background: accent, color: '#17120A', fontSize: 12, fontWeight: 750 }}>Explore more</button>
        </div>
      </section>

      <section style={{ padding: '28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {(features.length ? features : ['Thoughtful service', 'Made for your guests', 'A beautiful experience']).map((feature, index) => <div key={feature} style={{ padding: '15px 14px', minHeight: 70, border: `1px solid ${config.border ?? 'rgba(255,255,255,0.1)'}`, background: card, borderRadius: index % 2 ? 18 : 5 }}><div style={{ color: accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>0{index + 1}</div><strong style={{ display: 'block', marginTop: 7, fontSize: 12.5 }}>{feature}</strong></div>)}
        </div>
      </section>

      <section style={{ padding: '8px 20px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 10, marginBottom: 14 }}><div><div style={{ color: accent, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase' }}>Curated for you</div><h2 style={{ margin: '7px 0 0', fontFamily: config.headingFont ?? 'Outfit, sans-serif', fontSize: 26 }}>What we offer</h2></div><span style={{ color: muted, fontSize: 11 }}>View all</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {['Signature experience', 'Everyday essentials', 'Personal attention'].map((item, index) => <article key={item} style={{ overflow: 'hidden', borderRadius: index === 1 ? 22 : 7, background: card, border: `1px solid ${config.border ?? 'rgba(255,255,255,0.1)'}` }}><div style={{ height: 94, background: gallery[index] ? `url("${gallery[index]}") center/cover` : `linear-gradient(135deg, ${config.heroBg ?? '#51402A'}, ${background})` }} /><div style={{ padding: 13 }}><strong style={{ fontSize: 13 }}>{item}</strong><p style={{ margin: '6px 0 0', color: muted, fontSize: 11.5, lineHeight: 1.5 }}>A flexible section ready for your services, menu, or products.</p></div></article>)}
        </div>
      </section>

      {gallery.length > 0 && <section style={{ padding: '0 20px 32px' }}><div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8, height: 150 }}>{gallery.map((url, index) => <img key={url} src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: index === 0 ? 18 : 5, gridRow: index === 0 ? 'span 1' : undefined }} />)}</div></section>}

      <section style={{ margin: '0 20px 28px', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: accent, color: '#17120A', borderRadius: 7 }}><div><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.4, opacity: .65 }}>Ready when you are</div><strong style={{ display: 'block', marginTop: 6, fontFamily: config.headingFont ?? 'Outfit, sans-serif', fontSize: 21 }}>Start a conversation</strong></div><button type="button" style={{ border: '1px solid rgba(23,18,10,0.28)', borderRadius: 5, background: 'transparent', padding: '10px 13px', color: 'inherit', fontSize: 11.5, fontWeight: 750 }}>Contact us</button></section>

      <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '20px', borderTop: `1px solid ${config.border ?? 'rgba(255,255,255,0.1)'}`, color: muted, fontSize: 11.5 }}><div><strong style={{ color: ink }}>{name}</strong><div style={{ marginTop: 5 }}>{business?.address || 'Your address will appear here'}</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{business?.phone && <><Phone size={12} />{business.phone}</>}{business?.address && <MapPin size={12} />}{business?.email && <span>{business.email}</span>}<span style={{ marginLeft: 5, color: accent }}><Star size={12} fill="currentColor" /></span></div></footer>
    </div>
  )
}
