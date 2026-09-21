import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import StorefrontReviews from '../../components/StorefrontReviews'
import { TemplateHero, TemplateFeatured, QuickFacts } from '../../components/TemplateShowcase'
import TiltCard from '../../components/TiltCard'
import { categoryIcon } from '../../lib/icons'
import { currentWeekday, isOpenNow } from '../../lib/storefrontTheme'
import { MenuSection } from './StorefrontMenu'
import { AboutSection } from './StorefrontAbout'
import { ContactSection } from './StorefrontContact'
import { BookSection } from './StorefrontBook'
import { safeImageUrl } from '../../lib/safeUrl'

export default function StorefrontHome() {
  return (
    <StorefrontPageShell
      pagePath="/home"
      render={({ business, categories, items, labels, lang, theme, entitlements, approvedCopy }) => {
        if (!business) return null
        const open = isOpenNow(business.openingHours, business.timezone)
        const featured = items.filter(i => i.isFeatured && i.isAvailable).slice(0, 4)
        const fallback = featured.length === 0 ? items.filter(i => i.isAvailable).slice(0, 4) : []
        const highlight = featured.length > 0 ? featured : fallback
        const copy = approvedCopy[lang] ?? approvedCopy.en
        const aboutSnippet = (copy?.about?.description || business.aboutContent || business.description || '').slice(0, 220)
        const todayKey = currentWeekday(business.timezone)
        const todayHours = business.openingHours[todayKey]
        const featuredFirst = theme.composition.startsWith('fitness') || theme.composition.startsWith('clinical') || theme.composition.startsWith('barber')
        const featuredTitle = theme.composition.startsWith('fitness') ? 'Programs & highlights' : theme.composition.startsWith('clinical') ? 'Treatments & care' : theme.composition.startsWith('spa') || theme.composition.startsWith('massage') ? 'Treatments & experiences' : theme.composition.startsWith('salon') || theme.composition.startsWith('barber') ? 'Signature services' : undefined

        return (
          <>
            <LegacyRouteScroller />
            <section id="home" style={{ scrollMarginTop: 72 }}>
            <TemplateHero business={business} theme={theme} labels={labels} lang={lang} open={open} todayHours={todayHours} copy={copy} />

            {/* About teaser */}
            {!featuredFirst && aboutSnippet && (
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ maxWidth: 620, margin: '0 auto', padding: '44px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, color: business.accentColor, textTransform: 'uppercase' }}>About Us</span>
                <p style={{ fontSize: 15, color: theme.textDim, lineHeight: 1.7, marginTop: 10 }}>{aboutSnippet}{business.aboutContent.length > 220 ? '…' : ''}</p>
                <a href="#about" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: business.accentColor, textDecoration: 'none' }}>
                  Learn more <ArrowRight size={14} />
                </a>
              </motion.div>
            )}

            <TemplateFeatured items={highlight} business={business} theme={theme} lang={lang} title={featuredTitle} copy={copy} />

            <QuickFacts business={business} theme={theme} todayHours={todayHours} />

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
              <AboutSection business={business} theme={theme} copy={copy} />
            </section>

            {business.galleryUrls.length > 0 && (
              <section id="gallery" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
                <GallerySection images={business.galleryUrls} businessName={business.name} theme={theme} accentColor={business.accentColor} />
              </section>
            )}

            <section id="contact" style={{ scrollMarginTop: 72, borderTop: `1px solid ${theme.border}` }}>
              <ContactSection business={business} lang={lang} theme={theme} copy={copy} />
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

function GallerySection({ images, businessName, theme, accentColor }: { images: string[]; businessName: string; theme: { textDim: string; headingFont: string; border: string; card: string }; accentColor: string }) {
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
                <img src={safeImageUrl(url) ?? undefined} alt={`${businessName} gallery image ${index + 1}`} width={640} height={index % 3 === 1 ? 440 : 320} loading="lazy" decoding="async" style={{ display: 'block', width: '100%', height: index % 3 === 1 ? 220 : 160, objectFit: 'cover' }} />
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
