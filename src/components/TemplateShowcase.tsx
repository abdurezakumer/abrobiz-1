import { motion } from 'framer-motion'
import { ArrowRight, Clock, MapPin, Phone } from 'lucide-react'
import type { Business, Item, Language } from '../types'
import type { TemplateComposition } from '../types'
import type { StorefrontTheme } from '../lib/storefrontTheme'
import type { StorefrontLabels } from '../lib/useStorefrontData'
import type { GeneratedCopy } from '../lib/aiCopy'
import { safeImageUrl } from '../lib/safeUrl'
import SpotlightHero from './SpotlightHero'
import AnimatedHeading from './AnimatedHeading'
import ShinyText from './ShinyText'
import TiltCard from './TiltCard'
import { t } from '../lib/i18n'

interface ShowcaseProps {
  business: Business
  theme: StorefrontTheme
  labels: StorefrontLabels
  lang: Language
  open: boolean
  todayHours: { open: string; close: string; closed: boolean }
  copy?: GeneratedCopy
}

export function TemplateHero({ business, theme, labels, lang, open, todayHours, copy }: ShowcaseProps) {
  const image = safeImageUrl(business.coverUrl) ?? safeImageUrl(business.galleryUrls[0]) ?? undefined
  const logo = safeImageUrl(business.logoUrl) ?? undefined
  const headline = copy?.hero?.headline || business.name
  const description = copy?.hero?.subheadline || business.description
  if (copy) business = { ...business, name: headline, description }
  const cta = labels.itemLabel === 'Service' ? 'View services' : labels.itemLabel === 'Product' ? 'Shop products' : labels.itemLabel === 'Room / Package' ? 'View rooms' : 'Explore the menu'
  const status = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: open ? '#4ADE80' : '#F87171', fontSize: 12.5, fontWeight: 650 }}><i style={{ width: 7, height: 7, borderRadius: 99, background: 'currentColor' }} />{open ? t('currentlyOpen', lang) : t('currentlyClosed', lang)}</span>
  const actions = <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 25 }}><a href="#menu" style={{ ...primaryButton, background: business.accentColor, borderRadius: theme.composition === 'minimal' ? 8 : 999, color: theme.bg }}>{cta}<ArrowRight size={15} /></a><a href="#contact" style={{ ...secondaryButton, color: theme.text, borderColor: theme.border }}>Contact us</a></div>

  if (isNicheComposition(theme.composition)) return <NicheHero composition={theme.composition} business={business} theme={theme} status={status} actions={actions} image={image} logo={logo} todayHours={todayHours} />

  if (theme.composition === 'split') {
    return <section className="template-hero-split" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(42px, 8vw, 96px) 22px', display: 'grid', gridTemplateColumns: 'minmax(0, .9fr) minmax(300px, 1.1fr)', gap: 'clamp(28px, 6vw, 84px)', alignItems: 'center' }}>
      <div>{logo && <img src={logo} alt={business.name} width={64} height={64} style={{ width: 64, height: 64, borderRadius: 18, objectFit: 'cover', marginBottom: 24 }} />}<div style={{ color: business.accentColor, fontSize: 11.5, letterSpacing: 1.7, textTransform: 'uppercase', fontWeight: 700 }}>A considered local business</div><AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, fontSize: 'clamp(42px, 7vw, 82px)', lineHeight: .98, letterSpacing: '-.045em', margin: '15px 0 18px' }} />{business.description && <p style={{ color: theme.textDim, fontSize: 16, lineHeight: 1.7, maxWidth: 490, margin: 0 }}>{business.description}</p>}{actions}<div style={{ marginTop: 24 }}>{status}</div></div>
      <div style={{ minHeight: 390, borderRadius: 26, overflow: 'hidden', position: 'relative', background: theme.heroBg, backgroundImage: image ? `linear-gradient(160deg, transparent 25%, ${theme.heroBg}cc), url("${image}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: `0 28px 80px ${business.accentColor}18` }}><div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderRadius: 14, background: 'rgba(0,0,0,.42)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: 12.5 }}><span>{business.address || 'Visit us in person'}</span>{business.phone && <span>{business.phone}</span>}</div></div>
      <style>{'@media(max-width:760px){.template-hero-split{grid-template-columns:1fr!important}.template-hero-split>div:nth-child(2){min-height:280px!important}}'}</style>
    </section>
  }

  if (theme.composition === 'minimal') {
    return <section style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(54px, 11vw, 128px) 22px 72px' }}><div style={{ maxWidth: 820 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'center', borderBottom: `1px solid ${theme.border}`, paddingBottom: 18 }}>{logo ? <img src={logo} alt={business.name} width={48} height={48} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} /> : <span style={{ color: business.accentColor, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>Welcome</span>}{status}</div><AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, fontSize: 'clamp(52px, 10vw, 120px)', lineHeight: .92, letterSpacing: '-.07em', margin: '40px 0 24px' }} />{business.description && <p style={{ color: theme.textDim, fontSize: 18, lineHeight: 1.65, maxWidth: 580, margin: 0 }}>{business.description}</p>}{actions}</div><div style={{ display: 'flex', gap: 20, marginTop: 62, paddingTop: 18, borderTop: `1px solid ${theme.border}`, color: theme.textDim, fontSize: 12.5, flexWrap: 'wrap' }}>{business.address && <span><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />{business.address}</span>}{todayHours && <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />{todayHours.closed ? 'Closed today' : `${todayHours.open} – ${todayHours.close}`}</span>}</div></section>
  }

  if (theme.composition === 'corporate') {
    return <section style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(42px, 8vw, 92px) 22px 60px' }}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(230px, .8fr)', gap: 22, alignItems: 'stretch' }} className="template-hero-corporate"><div style={{ background: theme.heroBg, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 'clamp(28px, 5vw, 58px)' }}>{logo && <img src={logo} alt={business.name} width={56} height={56} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', marginBottom: 26 }} />}<div style={{ color: business.accentColor, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 700 }}>Trusted to do things well</div><AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, fontSize: 'clamp(38px, 6vw, 70px)', lineHeight: 1, margin: '16px 0' }} />{business.description && <p style={{ color: theme.textDim, lineHeight: 1.7, maxWidth: 570, margin: 0 }}>{business.description}</p>}{actions}</div><div style={{ background: image ? `linear-gradient(180deg, transparent, ${theme.heroBg}e8), url("${image}") center/cover` : theme.card, borderRadius: 22, minHeight: 320, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: theme.text }}><div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>{status}<p style={{ margin: '9px 0 0', color: theme.textDim, fontSize: 12.5 }}>{business.phone || business.email || 'Connect with us'}</p></div></div></div><style>{'@media(max-width:760px){.template-hero-corporate{grid-template-columns:1fr!important}}'}</style></section>
  }

  if (theme.composition === 'hospitality') {
    return <SpotlightHero templateSlug={business.templateSlug} visualStyle={theme.visualStyle} accentColor={business.accentColor} coverUrl={business.coverUrl} heroBg={theme.heroBg} minHeight={520}><div style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(92px, 16vw, 160px) 22px 92px', textAlign: 'center' }}>{logo && <img src={logo} alt={business.name} width={70} height={70} style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 22px', border: `2px solid ${business.accentColor}` }} />}<ShinyText text="Stay awhile" color="#fff" accent={business.accentColor} /><AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, color: '#fff', fontSize: 'clamp(42px, 8vw, 88px)', lineHeight: .98, margin: '16px 0' }} />{business.description && <p style={{ maxWidth: 570, margin: '0 auto', color: 'rgba(255,255,255,.8)', lineHeight: 1.7 }}>{business.description}</p>}{actions}</div></SpotlightHero>
  }

  return <SpotlightHero templateSlug={business.templateSlug} visualStyle={theme.visualStyle} accentColor={business.accentColor} coverUrl={business.coverUrl} heroBg={theme.heroBg} minHeight={theme.composition === 'bento' ? 430 : 420}><div style={{ maxWidth: 850, margin: '0 auto', padding: theme.composition === 'bento' ? 'clamp(74px, 12vw, 126px) 22px 86px' : '82px 22px 68px', textAlign: 'center' }}>{logo && <motion.img initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} src={logo} alt={business.name} width={80} height={80} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 20px', border: `3px solid ${business.accentColor}` }} />}{theme.visualStyle !== 'minimal' && <div style={{ marginBottom: 13 }}><ShinyText text={theme.visualStyle === 'luxury' ? 'A considered experience' : 'Discover something beautiful'} color={business.coverUrl ? '#fff' : theme.text} accent={business.accentColor} /></div>}<AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, fontSize: 'clamp(38px, 8vw, 72px)', color: business.coverUrl ? '#fff' : theme.text, lineHeight: 1, margin: 0 }} />{business.description && <p style={{ maxWidth: 530, margin: '18px auto 0', color: business.coverUrl ? 'rgba(255,255,255,.84)' : theme.textDim, lineHeight: 1.7 }}>{business.description}</p>}<div style={{ marginTop: 18 }}>{status}</div><div style={{ justifyContent: 'center' }}>{actions}</div></div></SpotlightHero>
}

function isNicheComposition(composition: TemplateComposition): boolean {
  return composition.includes('-') && !['restaurant-cafe'].includes(composition)
}

function NicheHero({ composition, business, theme, status, actions, image, logo, todayHours }: Pick<ShowcaseProps, 'business' | 'theme' | 'todayHours'> & { composition: TemplateComposition; status: React.ReactNode; actions: React.ReactNode; image?: string; logo?: string }) {
  const dark = ['fitness-command', 'fitness-athletic', 'clinical-cosmetic', 'spa-ritual', 'massage-therapy', 'salon-editorial', 'barber-luxe', 'barber-classic'].includes(composition)
  const centered = ['fitness-coach', 'fitness-personal', 'clinical-smile', 'spa-ritual', 'spa-balance', 'massage-wellness', 'salon-editorial', 'barber-classic'].includes(composition)
  const imageFirst = ['fitness-athletic', 'clinical-cosmetic', 'salon-fashion', 'barber-modern'].includes(composition)
  const compact = ['fitness-personal', 'clinical-smile', 'massage-flow', 'salon-studio', 'barber-modern'].includes(composition)
  const borderColor = dark ? 'rgba(255,255,255,.14)' : theme.border
  const titleSize = compact ? 'clamp(40px, 7vw, 74px)' : 'clamp(48px, 9vw, 108px)'
  const info = [business.address && { icon: <MapPin size={14} />, text: business.address }, business.phone && { icon: <Phone size={14} />, text: business.phone }, !todayHours.closed && { icon: <Clock size={14} />, text: `${todayHours.open} – ${todayHours.close}` }].filter(Boolean) as { icon: React.ReactNode; text: string }[]
  const copy = <div style={{ order: imageFirst ? 2 : 1, position: 'relative', zIndex: 1 }}>{logo && <img src={logo} alt={business.name} width={compact ? 52 : 68} height={compact ? 52 : 68} style={{ width: compact ? 52 : 68, height: compact ? 52 : 68, borderRadius: composition.startsWith('barber') ? 12 : '50%', objectFit: 'cover', marginBottom: 22, border: `2px solid ${business.accentColor}` }} />}<div style={{ color: business.accentColor, fontSize: 11.5, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 750 }}>{nicheEyebrow(composition)}</div><AnimatedHeading text={business.name} style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: titleSize, lineHeight: .92, letterSpacing: composition.includes('fashion') ? '-.06em' : '-.04em', margin: '16px 0 20px' }} />{business.description && <p style={{ maxWidth: centered ? 550 : 470, margin: centered ? '0 auto' : 0, color: theme.textDim, fontSize: compact ? 15 : 16, lineHeight: 1.7 }}>{business.description}</p>}{actions}<div style={{ marginTop: 20 }}>{status}</div></div>
  const visual = <div style={{ order: imageFirst ? 1 : 2, minHeight: compact ? 280 : 390, position: 'relative', borderRadius: composition === 'barber-modern' ? 10 : composition === 'spa-balance' ? 110 : 26, overflow: 'hidden', background: image ? `linear-gradient(155deg, transparent 25%, ${theme.heroBg}e8), url("${image}") center/cover` : theme.heroBg, border: `1px solid ${borderColor}`, boxShadow: dark ? `0 24px 70px ${business.accentColor}24` : '0 18px 48px rgba(20,30,24,.08)' }}><div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{info.map(item => <span key={item.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderRadius: 99, background: dark ? 'rgba(0,0,0,.38)' : 'rgba(255,255,255,.86)', backdropFilter: 'blur(9px)', color: dark ? '#fff' : theme.text, fontSize: 11.5 }}>{item.icon}{item.text}</span>)}</div></div>
  const layoutStyle: React.CSSProperties = centered ? { maxWidth: 940, margin: '0 auto', padding: 'clamp(58px, 11vw, 126px) 22px 82px', textAlign: 'center' } : { maxWidth: 1180, margin: '0 auto', padding: 'clamp(50px, 9vw, 110px) 22px 76px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, .82fr)', gap: 'clamp(28px, 7vw, 92px)', alignItems: 'center' }
  const background = dark ? theme.bg : theme.bg
  return <section style={{ background }}><div className="template-niche-grid" style={layoutStyle}>{centered ? <>{copy}{visual}</> : <>{copy}{visual}</>}</div>{centered && <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 22px 34px', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', color: theme.textDim, fontSize: 12.5 }}>{info.map(item => <span key={item.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{item.icon}{item.text}</span>)}</div>}<style>{'@media(max-width:700px){.template-niche-grid{grid-template-columns:1fr!important}}'}</style></section>
}

function nicheEyebrow(composition: TemplateComposition): string {
  if (composition.startsWith('fitness')) return 'Train with intention'
  if (composition.startsWith('clinical')) return 'Care with confidence'
  if (composition.startsWith('spa')) return 'Make space for yourself'
  if (composition.startsWith('massage')) return 'Restore your rhythm'
  if (composition.startsWith('salon')) return 'Your next signature look'
  if (composition.startsWith('barber')) return 'Crafted for your confidence'
  return 'Made for your next step'
}

export function TemplateFeatured({ items, business, theme, lang, title = 'Featured', copy }: { items: Item[]; business: Business; theme: StorefrontTheme; lang: Language; title?: string; copy?: GeneratedCopy }) {
  if (items.length === 0) return null
  if (copy?.services) {
    const generatedById = new Map(copy.services.map(item => [item.sourceId, item]))
    items = items.map(item => {
      const generated = generatedById.get(item.id)
      if (!generated) return item
      const existing = item.translations[lang] ?? item.translations.en ?? { name: '', description: '' }
      return { ...item, translations: { ...item.translations, [lang]: { name: generated.title, description: generated.shortDescription || existing.description } } }
    })
  }
  const cards = items.slice(0, 4)
  if (theme.composition === 'minimal') return <div style={{ maxWidth: 820, margin: '0 auto', padding: '12px 22px 58px' }}><div style={{ borderTop: `1px solid ${theme.border}` }}><h2 style={{ fontFamily: theme.headingFont, fontSize: 23, margin: '25px 0 12px' }}>{title}</h2>{cards.map(item => { const tr = item.translations[lang] ?? item.translations.en; const image = safeImageUrl(item.imageUrl); return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: `1px solid ${theme.border}` }}>{image && <img src={image} alt={tr?.name ?? ''} width={56} height={56} loading="lazy" decoding="async" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} />}<div style={{ flex: 1 }}><strong style={{ fontSize: 14 }}>{tr?.name}</strong>{tr?.description && <p style={{ margin: '4px 0 0', color: theme.textDim, fontSize: 12.5 }}>{tr.description}</p>}</div><span style={{ color: business.accentColor, fontSize: 13, fontWeight: 700 }}>{item.price} {business.currency}</span></div>})}</div></div>
  const masonry = theme.composition === 'salon-fashion' || theme.composition === 'barber-classic'
  const medical = theme.composition.startsWith('clinical')
  const imageHeight = theme.composition === 'bento' ? 250 : masonry ? 190 : 145
  const radius = theme.composition.startsWith('spa') || theme.composition.startsWith('massage') ? 24 : medical ? 10 : masonry ? 8 : 14
  return <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 22px 65px' }}><div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 15, marginBottom: 16 }}><h2 style={{ fontFamily: theme.headingFont, fontSize: 22, margin: 0 }}>{title}</h2><a href="#menu" style={{ color: business.accentColor, textDecoration: 'none', fontSize: 12.5, fontWeight: 650 }}>View all <ArrowRight size={13} style={{ verticalAlign: 'middle' }} /></a></div><div style={{ display: 'grid', gridTemplateColumns: theme.composition === 'bento' ? '1.25fr .75fr' : masonry ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: theme.composition.startsWith('spa') ? 20 : 14 }} className="template-featured-grid">{cards.map((item, index) => { const tr = item.translations[lang] ?? item.translations.en; const image = safeImageUrl(item.imageUrl); return <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} style={{ gridRow: theme.composition === 'bento' && index === 0 ? 'span 2' : undefined }}><TiltCard style={{ height: '100%', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: radius, overflow: 'hidden', boxShadow: theme.composition.startsWith('spa') ? '0 14px 38px rgba(30,45,33,.08)' : undefined }}><div style={{ height: theme.composition === 'bento' && index === 0 ? 250 : imageHeight, background: image ? `url("${image}") center/cover` : theme.heroBg }} /><div style={{ padding: '13px 14px' }}><div style={{ fontSize: 14, fontWeight: 650 }}>{tr?.name}</div><div style={{ color: business.accentColor, fontWeight: 700, fontSize: 12.5, marginTop: 4 }}>{item.price} {business.currency}</div></div></TiltCard></motion.div>})}</div><style>{'@media(max-width:560px){.template-featured-grid{grid-template-columns:1fr!important}}'}</style></div>
}

export function QuickFacts({ business, theme, todayHours }: { business: Business; theme: StorefrontTheme; todayHours: { open: string; close: string; closed: boolean } }) {
  return <div style={{ borderTop: `1px solid ${theme.border}`, padding: '26px 22px' }}><div style={{ maxWidth: 850, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', color: theme.textDim, fontSize: 12.5, textAlign: 'center' }}>{business.address && <span><MapPin size={16} color={business.accentColor} style={{ verticalAlign: 'middle', marginRight: 5 }} />{business.address}</span>}{business.phone && <span><Phone size={16} color={business.accentColor} style={{ verticalAlign: 'middle', marginRight: 5 }} />{business.phone}</span>}<span><Clock size={16} color={business.accentColor} style={{ verticalAlign: 'middle', marginRight: 5 }} />{todayHours.closed ? 'Closed today' : `${todayHours.open} – ${todayHours.close}`}</span></div></div>
}

const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 20px', textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }
const secondaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '11px 18px', border: '1px solid', borderRadius: 999, textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }
