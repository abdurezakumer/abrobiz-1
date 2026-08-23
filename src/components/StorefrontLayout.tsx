import { type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Facebook, Instagram, Send, Menu as MenuIcon, X } from 'lucide-react'
import { useState } from 'react'
import type { Business, Language } from '../types'
import type { StorefrontTheme } from '../lib/storefrontTheme'
import type { StorefrontEntitlements } from '../lib/useStorefrontData'
import { t } from '../lib/i18n'
import { storefrontPath } from '../lib/storefrontUrl'
import AmbientBackdrop from './AmbientBackdrop'

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
  business, theme, itemLabel, lang, setLang, entitlements, children,
}: {
  business: Business
  theme: StorefrontTheme
  itemLabel: string
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
    { href: anchor('gallery'), section: 'gallery', label: 'Gallery' },
    { href: anchor('contact'), section: 'contact', label: 'Contact' },
  ]

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
          {business.logoUrl ? (
            <img src={business.logoUrl} alt={business.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
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

        <button onClick={() => setMobileOpen(true)} className="storefront-nav-toggle" style={{ display: 'none', background: 'none', border: 'none', color: theme.text }}>
          <MenuIcon size={22} />
        </button>
      </header>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, background: theme.bg, zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24 }}
        >
          <button onClick={() => setMobileOpen(false)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: theme.text, marginBottom: 24 }}>
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

      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: '24px 20px', background: theme.heroBg }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: theme.textDim }}>{t('poweredBy', lang)} AbroBiz</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {business.social.facebookUrl && <a href={business.social.facebookUrl} target="_blank" rel="noreferrer" style={socialIcon(theme)}><Facebook size={13} /></a>}
            {business.social.instagramUrl && <a href={business.social.instagramUrl} target="_blank" rel="noreferrer" style={socialIcon(theme)}><Instagram size={13} /></a>}
            {business.social.telegramHandle && <a href={`https://t.me/${business.social.telegramHandle.replace('@', '')}`} target="_blank" rel="noreferrer" style={socialIcon(theme)}><Send size={13} /></a>}
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 720px) {
          .storefront-nav-desktop { display: none !important; }
          .storefront-nav-toggle { display: block !important; }
        }
      `}</style>
    </div>
  )
}

function socialIcon(theme: StorefrontTheme): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${theme.border}`, color: theme.text, textDecoration: 'none' }
}
