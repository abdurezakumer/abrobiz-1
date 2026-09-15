import { type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Facebook, Instagram, Mail, MapPin, Music2, Phone, Send, Menu as MenuIcon, X } from 'lucide-react'
import { useState } from 'react'
import type { Business, Language } from '../types'
import type { StorefrontTheme } from '../lib/storefrontTheme'
import type { StorefrontEntitlements } from '../lib/useStorefrontData'
import { DAY_LABELS, t } from '../lib/i18n'
import { publicStorefrontUrl, storefrontPath } from '../lib/storefrontUrl'
import { safeHttpsUrl, safeImageUrl, safeMailto, safeTel, safeTelegramUrl } from '../lib/safeUrl'
import AmbientBackdrop from './AmbientBackdrop'
import BusinessLocation from './BusinessLocation'

function pageLabel(itemLabel: string): string {
  if (itemLabel === 'Service') return 'Services'
  if (itemLabel === 'Product') return 'Products'
  if (itemLabel === 'Room / Package') return 'Rooms'
  return 'Menu'
}

function bookLabel(itemLabel: string): string {
  if (itemLabel === 'Service') return 'Book Appointment'
  if (itemLabel === 'Room / Package') return 'Book a Room'
  return 'Reserve a Table'
}

export default function StorefrontLayout({
  business, theme, itemLabel, categoryLabel, lang, setLang, entitlements, children,
}: {
  business: Business
  theme: StorefrontTheme
  itemLabel: string
  categoryLabel?: string
  lang: Language
  setLang: (l: Language) => void
  entitlements: StorefrontEntitlements
  children: ReactNode
}) {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const base = storefrontPath(routeSlug ?? business.slug, '', window.location.hostname)

  const anchor = (section: string) => section === 'home' ? (base || '/') : `${base}#${section}`
  const navItems = [
    { href: anchor('home'), section: 'home', label: 'Home' },
    { href: anchor('menu'), section: 'menu', label: pageLabel(itemLabel) },
    ...(entitlements.bookings ? [{ href: anchor('book'), section: 'book', label: bookLabel(itemLabel) }] : []),
    { href: anchor('about'), section: 'about', label: 'About' },
    ...(business.galleryUrls.length > 0 ? [{ href: anchor('gallery'), section: 'gallery', label: 'Gallery' }] : []),
    { href: anchor('contact'), section: 'contact', label: 'Contact' },
  ]
  const logoUrl = safeImageUrl(business.logoUrl)
  const facebookUrl = safeHttpsUrl(business.social.facebookUrl)
  const instagramUrl = safeHttpsUrl(business.social.instagramUrl)
  const tiktokUrl = safeHttpsUrl(business.social.tiktokUrl)
  const telegramUrl = safeTelegramUrl(business.social.telegramHandle)

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop theme={theme} accentColor={business.accentColor} />
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20, background: theme.visualStyle === 'aurora' || theme.visualStyle === 'luxury' ? `color-mix(in srgb, ${theme.bg} 86%, transparent)` : theme.bg, backdropFilter: theme.visualStyle === 'aurora' || theme.visualStyle === 'luxury' ? 'blur(18px)' : undefined, borderBottom: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px',
        }}
      >
        <Link to={base} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: theme.text }}>
          {logoUrl ? (
            <img src={logoUrl} alt={business.name} width={30} height={30} decoding="async" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: business.accentColor, flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15.5 }}>{business.name}</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="storefront-nav-desktop">
          {navItems.map(item => {
            const active = location.hash === `#${item.section}` || (!location.hash && item.section === 'home')
            return (
              <a
                key={item.section}
                href={item.href}
                style={{
                  position: 'relative', fontSize: 13.5, fontWeight: 500, padding: '7px 13px', borderRadius: 8, textDecoration: 'none',
                  color: active ? '#0A0C10' : theme.textDim,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="storefront-nav-active"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: 8, background: business.accentColor, zIndex: -1 }}
                  />
                )}
                {item.label}
              </a>
            )
          })}
          {business.languages.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 10 }}>
              {business.languages.map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{ fontSize: 11, padding: '5px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: lang === l ? business.accentColor : 'rgba(255,255,255,0.08)', color: lang === l ? '#0A0C10' : theme.text }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </nav>

        <button type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="storefront-nav-toggle" style={{ display: 'none', background: 'none', border: 'none', color: theme.text }}>
          <MenuIcon size={22} />
        </button>
      </header>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, background: theme.bg, zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24 }}
        >
          <button type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: theme.text, marginBottom: 24 }}>
            <X size={24} />
          </button>
          {navItems.map(item => (
            <a key={item.section} href={item.href} onClick={() => setMobileOpen(false)} style={{ fontSize: 22, fontFamily: 'Outfit, sans-serif', color: theme.text, textDecoration: 'none', padding: '14px 0', borderBottom: `1px solid ${theme.border}` }}>
              {item.label}
            </a>
          ))}
        </motion.div>
      )}

      <main style={{ position: 'relative', zIndex: 1, flex: 1 }}>{children}</main>

      <StorefrontFooter business={business} theme={theme} lang={lang} categoryLabel={categoryLabel} navItems={navItems} logoUrl={logoUrl} facebookUrl={facebookUrl} instagramUrl={instagramUrl} tiktokUrl={tiktokUrl} telegramUrl={telegramUrl} />

      <style>{`
        @media (max-width: 720px) {
          .storefront-nav-desktop { display: none !important; }
          .storefront-nav-toggle { display: block !important; }
          .storefront-footer-grid { grid-template-columns: 1fr !important; gap: 26px !important; }
          .storefront-footer { padding-left: 18px !important; padding-right: 18px !important; }
        }
        .storefront-footer a:hover { color: ${theme.text} !important; }
        .storefront-footer a:focus-visible, .storefront-footer button:focus-visible { outline: 2px solid ${business.accentColor}; outline-offset: 3px; }
      `}</style>
    </div>
  )
}

type NavItem = { href: string; section: string; label: string }

function StorefrontFooter({ business, theme, lang, categoryLabel, navItems, logoUrl, facebookUrl, instagramUrl, tiktokUrl, telegramUrl }: { business: Business; theme: StorefrontTheme; lang: Language; categoryLabel?: string; navItems: NavItem[]; logoUrl: string | null; facebookUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null; telegramUrl: string | null }) {
  const phoneUrl = safeTel(business.phone)
  const emailUrl = safeMailto(business.email)
  const hasHours = Object.values(business.openingHours).some(hours => hours && (hours.closed || Boolean(hours.open) || Boolean(hours.close)))
  const socialLinks = [
    facebookUrl && { href: facebookUrl, label: 'Facebook', icon: <Facebook size={14} aria-hidden /> },
    instagramUrl && { href: instagramUrl, label: 'Instagram', icon: <Instagram size={14} aria-hidden /> },
    tiktokUrl && { href: tiktokUrl, label: 'TikTok', icon: <Music2 size={14} aria-hidden /> },
    telegramUrl && { href: telegramUrl, label: 'Telegram', icon: <Send size={14} aria-hidden /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[]

  return (
    <footer className="storefront-footer" aria-labelledby="storefront-footer-title" style={{ position: 'relative', zIndex: 2, width: '100%', borderTop: `1px solid ${theme.border}`, padding: 'clamp(42px, 6vw, 68px) 20px 24px', background: theme.heroBg, color: theme.text, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="storefront-footer-grid" style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.35fr .8fr 1fr 1fr', gap: 30 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {logoUrl ? <img src={logoUrl} alt="" width={38} height={38} decoding="async" style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover' }} /> : <div aria-hidden style={{ width: 38, height: 38, borderRadius: 12, background: business.accentColor }} />}
            <div><h2 id="storefront-footer-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.15, fontFamily: theme.headingFont, letterSpacing: '-.02em' }}>{business.name}</h2>{categoryLabel && categoryLabel !== 'Business' && <div style={{ marginTop: 5, color: theme.textDim, fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>{categoryLabel}</div>}</div>
          </div>
          {business.description && <p style={{ maxWidth: 300, margin: '16px 0 0', color: theme.textDim, fontSize: 12.5, lineHeight: 1.65 }}>{business.description}</p>}
          {socialLinks.length > 0 && <div aria-label="Social media" style={{ marginTop: 19 }}><h3 style={footerHeading}>Follow us</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{socialLinks.map(social => <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} style={{ ...socialIcon(theme), width: 'auto', minWidth: 28, padding: '0 9px', borderRadius: 99, gap: 6, fontSize: 11.5 }}>{social.icon}<span>{social.label}</span></a>)}</div></div>}
        </div>
        <div>
          <h3 style={footerHeading}>Explore</h3>
          <nav aria-label="Footer navigation" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{navItems.map(item => <a key={item.section} href={item.href} style={footerLink(theme)}>{item.label}</a>)}</nav>
        </div>
        <div>
          <h3 style={footerHeading}>Contact</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, color: theme.textDim, fontSize: 12.5, lineHeight: 1.45 }}>
            {phoneUrl && <a href={phoneUrl} style={footerLink(theme)}><Phone size={14} aria-hidden /> {business.phone}</a>}
            {emailUrl && <a href={emailUrl} style={footerLink(theme)}><Mail size={14} aria-hidden /> {business.email}</a>}
            {business.address && <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}><MapPin size={14} color={business.accentColor} aria-hidden /> {business.address}</span>}
            <a href={publicStorefrontUrl(business.slug)} style={footerLink(theme)}><ExternalWebsiteIcon /> Website</a>
          </div>
          {hasHours && <div style={{ marginTop: 19 }}><h3 style={footerHeading}><Clock size={14} aria-hidden /> Hours</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: theme.textDim, fontSize: 11.5 }}>{(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => { const hours = business.openingHours[day]; return <div key={day} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{DAY_LABELS[day][lang]}</span><span>{hours.closed ? t('closed', lang) : `${hours.open} – ${hours.close}`}</span></div> })}</div></div>}
        </div>
        <BusinessLocation business={business} theme={theme} lang={lang} />
      </div>
      <div style={{ maxWidth: 1120, margin: '34px auto 0', paddingTop: 18, borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, color: theme.textDim, fontSize: 11.5 }}>
        <span>{t('poweredBy', lang)} <a href="https://abrobiz.com" style={{ color: theme.text, textDecoration: 'none', fontWeight: 700 }}>AbroBiz</a></span>
        <div style={{ display: 'flex', gap: 12 }}><a href="/terms" style={footerLink(theme)}>Terms</a><a href="/privacy" style={footerLink(theme)}>Privacy</a></div>
      </div>
    </footer>
  )
}

function ExternalWebsiteIcon() { return <span aria-hidden style={{ width: 14, textAlign: 'center', color: '#D4A853' }}>↗</span> }

const footerHeading: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 13px', color: 'inherit', fontSize: 13, fontWeight: 700, fontFamily: 'Outfit, Inter, ui-sans-serif, system-ui, sans-serif', letterSpacing: '.02em' }
const footerLink = (theme: StorefrontTheme): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, color: theme.textDim, textDecoration: 'none' })

function socialIcon(theme: StorefrontTheme): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${theme.border}`, color: theme.text, textDecoration: 'none' }
}
