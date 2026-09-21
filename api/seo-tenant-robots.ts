/* eslint-disable @typescript-eslint/no-explicit-any */
import { canonical, publicBusinessForRequest, send, tenantSlugOf } from './_seo'

export default async function handler(req: any, res: any) {
  if (!tenantSlugOf(req)) return send(res, 404, 'text/plain; charset=utf-8', 'User-agent: *\nDisallow: /\n')
  try {
    const business = await publicBusinessForRequest(req)
    const indexable = Boolean(business && business.seoIndexingEnabled !== false)
    const body = indexable
      ? `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /billing\nDisallow: /payments\nDisallow: /account\nDisallow: /api/\nSitemap: ${canonical(tenantSlugOf(req) as string)}sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n'
    return send(res, 200, 'text/plain; charset=utf-8', body, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', Vary: 'Host' })
  } catch {
    return send(res, 200, 'text/plain; charset=utf-8', 'User-agent: *\nDisallow: /\n', { 'Cache-Control': 'no-store' })
  }
}
