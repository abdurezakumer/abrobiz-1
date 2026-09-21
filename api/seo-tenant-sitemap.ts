/* eslint-disable @typescript-eslint/no-explicit-any */
import { canonical, publicBusinessForRequest, send, tenantSlugOf, xmlEscape } from './_seo'

export default async function handler(req: any, res: any) {
  const slug = tenantSlugOf(req)
  if (!slug) return send(res, 404, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { 'X-Robots-Tag': 'noindex, nofollow' })
  try {
    const business = await publicBusinessForRequest(req)
    if (!business || business.seoIndexingEnabled === false) return send(res, 404, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, max-age=30' })
    const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xmlEscape(canonical(slug))}</loc></url></urlset>`
    return send(res, 200, 'application/xml; charset=utf-8', body, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900', Vary: 'Host' })
  } catch {
    return send(res, 503, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { 'Cache-Control': 'no-store' })
  }
}
