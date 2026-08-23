import { useParams } from 'react-router-dom'
import { useStorefrontData, type StorefrontData } from '../lib/useStorefrontData'
import { themeFor, type StorefrontTheme } from '../lib/storefrontTheme'
import StorefrontLayout from './StorefrontLayout'
import { businessSlugFromHostname } from '../lib/storefrontUrl'

export default function StorefrontPageShell({
  pagePath, render,
}: {
  pagePath: string
  render: (data: StorefrontData & { theme: StorefrontTheme }) => React.ReactNode
}) {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const slug = routeSlug ?? businessSlugFromHostname() ?? undefined
  const data = useStorefrontData(slug, pagePath)

  if (data.business === undefined) return null

  if (!data.business || data.business.isBlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#111318', color: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        This page isn't available.
      </div>
    )
  }

  const theme = themeFor(data.business.templateSlug, data.templateConfig)

  return (
    <StorefrontLayout business={data.business} theme={theme} itemLabel={data.labels.itemLabel} lang={data.lang} setLang={data.setLang} entitlements={data.entitlements}>
      {render({ ...data, theme })}
    </StorefrontLayout>
  )
}
