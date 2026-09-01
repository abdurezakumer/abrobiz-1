import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Phone, Clock, ArrowRight } from 'lucide-react'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import StorefrontReviews from '../../components/StorefrontReviews'
import SpotlightHero from '../../components/SpotlightHero'
import AnimatedHeading from '../../components/AnimatedHeading'
import TiltCard from '../../components/TiltCard'
import ShinyText from '../../components/ShinyText'
import { categoryIcon } from '../../lib/icons'
import { currentWeekday, isOpenNow } from '../../lib/storefrontTheme'
import { t } from '../../lib/i18n'
import { MenuSection } from './StorefrontMenu'
import { AboutSection } from './StorefrontAbout'
import { ContactSection } from './StorefrontContact'
import { BookSection } from './StorefrontBook'
import { safeImageUrl } from '../../lib/safeUrl'

function ctaVerb(itemLabel: string): string {
  if (itemLabel === 'Service') return 'View Services'
  if (itemLabel === 'Product') return 'Shop Products'
  if (itemLabel === 'Room / Package') return 'View Rooms'
  return 'View Menu'
}

export default function StorefrontHome() {
  return (
    <StorefrontPageShell
      pagePath="/home"
      render={({ business, categories, items, labels, lang, theme, entitlements }) => {
        if (!business) return null
        const open = isOpenNow(business.openingHours, business.timezone)
        const CategoryIcon = categoryIcon(labels.icon)
        const featured = items.filter(i => i.isFeatured && i.isAvailable).slice(0, 4)
        const fallback = featured.length === 0 ? items.filter(i => i.isAvailable).slice(0, 4) : []
        const highlight = featured.length > 0 ? featured : fallback
        const aboutSnippet = (business.aboutContent || business.description || '').slice(0, 220)
        const todayKey = currentWeekday(business.timezone)
        const todayHours = business.openingHours[todayKey]

        return (
          <>
            <LegacyRouteScroller />
            <section id="home" style={{ scrollMarginTop: 72 }}>
            {/* Hero */}
            <SpotlightHero templateSlug={business.templateSlug} visualStyle={theme.visualStyle} accentColor={business.accentColor} coverUrl={business.coverUrl} heroBg={theme.layout === 'restaurant-cafe' ? theme.heroBg : undefined} minHeight={theme.visualStyle === 'luxury' || theme.visualStyle === 'aurora' || theme.layout === 'restaurant-cafe' ? 420 : 320}>
              <div style={{ padding: theme.visualStyle === 'luxury' ? '88px 20px 66px' : '64px 20px 48px', textAlign: 'center' }}>
                {safeImageUrl(business.logoUrl) && (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
                    src={safeImageUrl(business.logoUrl) ?? undefined} alt={business.name} width={84} height={84} decoding="async"
                    style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 18px', border: `3px solid ${business.accentColor}` }}
                  />
                )}
                {theme.visualStyle !== 'minimal' && (
                  <div style={{ marginBottom: 16 }}>
                    <ShinyText text={theme.visualStyle === 'luxury' ? 'A considered experience' : theme.visualStyle === 'heritage' ? 'Rooted in character' : 'Discover something beautiful'} color={business.coverUrl ? '#fff' : theme.text} accent={business.accentColor} />
                  </div>
                )}
                <AnimatedHeading
                  text={business.name}
                  style={{ fontFamily: theme.headingFont, fontSize: 'clamp(32px, 6vw, 58px)', fontWeight: 700, letterSpacing: theme.visualStyle === 'luxury' ? '-0.035em' : undefined, color: business.coverUrl || theme.layout === 'restaurant-cafe' ? '#fff' : theme.text, marginBottom: 10 }}
                />
                {business.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
                    style={{ maxWidth: 480, margin: '0 auto', fontSize: 15, color: business.coverUrl ? 'rgba(255,255,255,0.85)' : theme.textDim, lineHeight: 1.6 }}
                  >
                    {business.description}
                  </motion.p>
                )}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.38 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '5px 12px', borderRadius: 999, background: open ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: open ? '#4ADE80' : '#F87171', fontSize: 12.5, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {open ? t('currentlyOpen', lang) : t('currentlyClosed', lang)}
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.44 }} style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
                  <a href="#menu" style={{ background: business.accentColor, color: '#0A0C10', padding: '12px 24px', borderRadius: theme.visualStyle === 'luxury' ? 999 : 10, fontSize: 13.5, fontWeight: 700, letterSpacing: theme.visualStyle === 'luxury' ? 0.6 : undefined, textDecoration: 'none', boxShadow: theme.visualStyle === 'luxury' ? `0 10px 30px ${business.accentColor}38` : undefined }}>
                    {ctaVerb(labels.itemLabel)}
                  </a>
                  <a href="#contact" style={{ background: 'rgba(255,255,255,0.1)', color: business.coverUrl ? '#fff' : theme.text, padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    Contact Us
                  </a>
                </motion.div>
              </div>
            </SpotlightHero>

            {/* About teaser */}
            {aboutSnippet && (
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ maxWidth: 620, margin: '0 auto', padding: '44px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, color: business.accentColor, textTransform: 'uppercase' }}>About Us</span>
                <p style={{ fontSize: 15, color: theme.textDim, lineHeight: 1.7, marginTop: 10 }}>{aboutSnippet}{business.aboutContent.length > 220 ? '…' : ''}</p>
                <a href="#about" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: business.accentColor, textDecoration: 'none' }}>
                  Learn more <ArrowRight size={14} />
                </a>
              </motion.div>
            )}

            {/* Featured items */}
            {highlight.length > 0 && (
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 48px' }}>
                <h2 style={{ fontFamily: theme.headingFont, fontSize: 18, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CategoryIcon size={16} color={business.accentColor} /> Featured
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {highlight.map((item, i) => {
                    const tr = item.translations[lang] ?? item.translations.en
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.06 }}
                      >
                        <TiltCard style={{ background: theme.card, borderRadius: theme.visualStyle === 'luxury' || theme.visualStyle === 'heritage' ? 20 : 14, border: `1px solid ${theme.border}`, overflow: 'hidden', boxShadow: theme.visualStyle === 'aurora' ? `0 18px 60px ${business.accentColor}12` : undefined }}>
                          <div style={{ height: 100, background: safeImageUrl(item.imageUrl) ? `url("${safeImageUrl(item.imageUrl)}") center/cover` : theme.heroBg }} />
                          <div style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{tr?.name}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: business.accentColor, marginTop: 2 }}>{item.price} {business.currency}</div>
                          </div>
                        </TiltCard>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick info strip */}
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: '28px 20px' }}>
              <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', textAlign: 'center' }}>
                {business.address && (
                  <div>
                    <MapPin size={17} color={business.accentColor} style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 12.5, color: theme.textDim, maxWidth: 160 }}>{business.address}</div>
                  </div>
                )}
                {business.phone && (
                  <div>
                    <Phone size={17} color={business.accentColor} style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 12.5, color: theme.textDim }}>{business.phone}</div>
                  </div>
                )}
                <div>
                  <Clock size={17} color={business.accentColor} style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 12.5, color: theme.textDim }}>
                    {todayHours.closed ? t('closed', lang) : `${todayHours.open} \u2013 ${todayHours.close}`}
                  </div>
                </div>
              </div>
            </div>

            {entitlements.reviews && (
              <StorefrontReviews businessId={business.id} accentColor={business.accentColor} theme={theme} />
            )}
            </section>

            <section id="menu" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
              <SectionHeading eyebrow={labels.itemLabel === 'Service' ? 'Our services' : 'Explore'} title={labels.itemLabel === 'Service' ? 'Services' : labels.itemLabel === 'Product' ? 'Products' : 'Menu'} theme={theme} accentColor={business.accentColor} />
              <MenuSection
                business={business}
                categories={categories}
                items={items}
                labels={labels}
                lang={lang}
                theme={theme}
                CategoryIcon={categoryIcon(labels.icon)}
                orderingEnabled={entitlements.ordering}
              />
            </section>

            <section id="about" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
              <AboutSection business={business} theme={theme} />
            </section>

            <section id="gallery" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
              <GallerySection images={business.galleryUrls} theme={theme} accentColor={business.accentColor} />
            </section>

            <section id="contact" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
              <ContactSection business={business} lang={lang} theme={theme} />
            </section>

            {entitlements.bookings && (
              <section id="book" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
                <BookSection business={business} itemLabel={labels.itemLabel} theme={theme} />
              </section>
            )}
          </>
        )
      }}
    />
  )
}

function GallerySection({ images, theme, accentColor }: { images: string[]; theme: { textDim: string; headingFont: string; border: string; card: string }; accentColor: string }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '64px 20px 76px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span style={{ color: accentColor, fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Moments, meals and memories</span>
        <h2 style={{ fontFamily: theme.headingFont, fontSize: 'clamp(28px, 5vw, 42px)', margin: '8px 0 0' }}>Gallery</h2>
      </div>
      {images.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textDim, fontSize: 14 }}>Gallery photos will appear here soon.</p>
      ) : (
        <div style={{ columns: '3 220px', columnGap: 14 }}>
          {images.map((url, index) => (
            <motion.div key={url} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }} style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <TiltCard style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
                <img src={safeImageUrl(url) ?? undefined} alt="" loading="lazy" decoding="async" style={{ display: 'block', width: '100%', minHeight: index % 3 === 1 ? 220 : 160, objectFit: 'cover' }} />
              </TiltCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function LegacyRouteScroller() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) return
    const section = location.pathname.match(/\/(menu|about|gallery|contact|book)\/?$/)?.[1]
    if (!section) return
    const timer = window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => window.clearTimeout(timer)
  }, [location.pathname, location.hash])

  return null
}

function SectionHeading({ eyebrow, title, theme, accentColor }: { eyebrow: string; title: string; theme: { textDim: string }; accentColor: string }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '46px 20px 0', textAlign: 'center' }}>
      <span style={{ color: accentColor, fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{eyebrow}</span>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 30, margin: '8px 0 0' }}>{title}</h2>
      <p style={{ color: theme.textDim, fontSize: 13.5, margin: '8px auto 0' }}>Everything you need to know, all in one place.</p>
    </div>
  )
}
