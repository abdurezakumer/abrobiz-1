/* eslint-disable @typescript-eslint/no-explicit-any */
import { PLATFORM_DOMAIN, send, supabaseRpc, xmlEscape } from './_seo'

const CHUNK_SIZE = 1000

export default async function handler(_req: any, res: any) {
  try {
    const count = Number(await supabaseRpc('count_indexable_businesses', {})) || 0
    const chunks = Math.max(1, Math.ceil(count / CHUNK_SIZE))
    const body = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: chunks }, (_, index) => `<sitemap><loc>${xmlEscape(`https://${PLATFORM_DOMAIN}/sitemaps/tenants-${index + 1}.xml`)}</loc></sitemap>`).join('')}</sitemapindex>`
    return send(res, 200, 'application/xml; charset=utf-8', body, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' })
  } catch {
    return send(res, 503, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>', { 'Cache-Control': 'no-store' })
  }
}
