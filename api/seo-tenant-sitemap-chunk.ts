/* eslint-disable @typescript-eslint/no-explicit-any */
import { PLATFORM_DOMAIN, send, supabaseRpc, xmlEscape } from './_seo'

const CHUNK_SIZE = 1000

export default async function handler(req: any, res: any) {
  const page = Math.max(1, Number(new URL(req.url || '/', `https://${PLATFORM_DOMAIN}`).searchParams.get('page') || 1) || 1)
  try {
    const rows = await supabaseRpc('list_indexable_businesses', { p_limit: CHUNK_SIZE, p_offset: (page - 1) * CHUNK_SIZE })
    const businesses = Array.isArray(rows) ? rows : []
    const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${businesses.map(row => `<url><loc>${xmlEscape(`https://${row.slug}.${PLATFORM_DOMAIN}/`)}</loc>${row.updated_at ? `<lastmod>${xmlEscape(row.updated_at)}</lastmod>` : ''}</url>`).join('')}</urlset>`
    return send(res, 200, 'application/xml; charset=utf-8', body, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' })
  } catch {
    return send(res, 503, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { 'Cache-Control': 'no-store' })
  }
}
