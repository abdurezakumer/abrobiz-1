import { motion } from 'framer-motion'
import StorefrontPageShell from '../../components/StorefrontPageShell'
import TiltCard from '../../components/TiltCard'
import type { Business } from '../../types'
import type { StorefrontTheme } from '../../lib/storefrontTheme'
import { safeImageUrl } from '../../lib/safeUrl'
import type { GeneratedCopy } from '../../lib/aiCopy'

export default function StorefrontAbout() {
  return (
    <StorefrontPageShell
      pagePath="/about"
      render={({ business, theme, approvedCopy, lang }) => {
        if (!business) return null
        return <AboutSection business={business} theme={theme} copy={approvedCopy[lang] ?? approvedCopy.en} />
      }}
    />
  )
}

export function AboutSection({ business, theme, copy }: { business: Business; theme: StorefrontTheme; copy?: GeneratedCopy }) {
  const about = copy?.about
  const paragraphs = (about?.description || business.aboutContent || business.description || 'More about us coming soon.')
    .split('\n')
    .map((p: string) => p.trim())
    .filter(Boolean)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px 64px' }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 36 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, color: business.accentColor, textTransform: 'uppercase' }}>About</span>
              <h1 style={{ fontFamily: theme.headingFont, fontSize: 30, fontWeight: 700, marginTop: 8 }}>{about?.title || business.name}</h1>
            </motion.div>

            {paragraphs.map((p: string, i: number) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                style={{ fontSize: 15, lineHeight: 1.8, color: theme.textDim, marginBottom: 16 }}
              >
                {p}
              </motion.p>
            ))}

            {(about?.mission || about?.vision || about?.values?.length) && (
              <div style={{ marginTop: 30, display: 'grid', gap: 14 }}>
                {about.mission && <div><strong style={{ fontSize: 13 }}>Our mission</strong><p style={{ fontSize: 14, lineHeight: 1.7, color: theme.textDim, marginTop: 5 }}>{about.mission}</p></div>}
                {about.vision && <div><strong style={{ fontSize: 13 }}>Our vision</strong><p style={{ fontSize: 14, lineHeight: 1.7, color: theme.textDim, marginTop: 5 }}>{about.vision}</p></div>}
                {about.values?.length ? <div><strong style={{ fontSize: 13 }}>What guides us</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{about.values.map(value => <span key={value} style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: '7px 10px', fontSize: 12, color: theme.textDim }}>{value}</span>)}</div></div> : null}
              </div>
            )}

            {business.galleryUrls.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 32 }}>
                {business.galleryUrls.map((url: string, i: number) => (
                  <motion.div
                    key={url}
                    initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  >
                    <TiltCard style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                    <img src={safeImageUrl(url) ?? undefined} alt={`${business.name} gallery image ${i + 1}`} width={140} height={140} loading="lazy" decoding="async" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    </TiltCard>
                  </motion.div>
                ))}
              </div>
            )}
    </div>
  )
}
