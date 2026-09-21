import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStorefrontData, type StorefrontData } from '../lib/useStorefrontData'
import { themeFor, type StorefrontTheme } from '../lib/storefrontTheme'
import StorefrontLayout from './StorefrontLayout'
import { businessSlugFromHostname, publicStorefrontUrl } from '../lib/storefrontUrl'
import { applySeoDefinition } from '../lib/seoDom'
import { buildTenantSeo } from '../lib/seo'

export default function StorefrontPageShell({
  pagePath, render,
}: {
  pagePath: string
  render: (data: StorefrontData & { theme: StorefrontTheme }) => React.ReactNode
}) {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const slug = routeSlug ?? businessSlugFromHostname() ?? undefined
  const data = useStorefrontData(slug, pagePath)

  useEffect(() => {
    if (!data.business) {
      if (data.business === null) {
        document.title = 'Page not found — AbroBiz'
        const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta')
        robots.name = 'robots'
        robots.content = 'noindex,nofollow'
        if (!robots.parentElement) document.head.appendChild(robots)
      }
      return undefined
    }
    const seo = buildTenantSeo(data.business, {
      categoryLabel: data.labels.label,
      categorySlug: data.labels.slug,
      canonicalUrl: publicStorefrontUrl(data.business.slug),
      siteName: 'AbroBiz',
    }, data.entitlements.siteActive)
    return applySeoDefinition(seo)
  }, [data.business, data.entitlements.siteActive, data.labels.label, data.labels.slug])

  if (data.business === undefined) return null

  if (data.business === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#080A0E', color: '#F5F3EF', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <div><div style={{ color: '#D4A853', fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>ABROBIZ</div><h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 34, margin: '14px 0 10px' }}>Website not found</h1><p style={{ color: 'rgba(245,243,239,.62)', lineHeight: 1.7, margin: 0 }}>This public business website does not exist or is not currently available.</p></div>
      </div>
    )
  }

  if (data.business.isBlocked || !data.entitlements.siteActive) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #232832 0%, #111318 58%)', color: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: 'min(520px, 100%)', textAlign: 'center', padding: '42px 28px', borderRadius: 24, border: '1px solid rgba(212,168,83,0.28)', background: 'rgba(255,255,255,0.055)', boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>
          <div style={{ width: 54, height: 54, margin: '0 auto 18px', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,0.16)', color: '#D4A853', fontSize: 26 }}>A</div>
          <div style={{ color: '#D4A853', fontSize: 12, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 10 }}>AbroBiz website pause</div>
          <h1 style={{ margin: '0 0 12px', fontFamily: 'Outfit, Inter, sans-serif', fontSize: 28, lineHeight: 1.15 }}>This website is temporarily unavailable</h1>
          <p style={{ margin: 0, color: 'rgba(245,243,239,0.68)', lineHeight: 1.7, fontSize: 15 }}>The business owner is renewing the AbroBiz subscription. This website will be available again as soon as the renewal is approved.</p>
          <div style={{ marginTop: 24, color: 'rgba(245,243,239,0.42)', fontSize: 12 }}>Powered by AbroBiz</div>
        </div>
      </div>
    )
  }

  const theme = themeFor(data.business.templateSlug, data.templateConfig)

  return (
    <StorefrontLayout business={data.business} theme={theme} itemLabel={data.labels.itemLabel} categoryLabel={data.labels.label} lang={data.lang} setLang={data.setLang} entitlements={data.entitlements}>
      {render({ ...data, theme })}
    </StorefrontLayout>
  )
}
