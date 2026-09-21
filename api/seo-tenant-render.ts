/* eslint-disable @typescript-eslint/no-explicit-any */
import { canonical, descriptionFor, htmlEscape, imageFor, jsonForHtml, publicBusinessForRequest, schemaFor, send, tenantSlugOf, titleFor } from './_seo'

export default async function handler(req: any, res: any) {
  const slug = tenantSlugOf(req)
  if (!slug) return send(res, 404, 'text/html; charset=utf-8', '<!doctype html><title>Not found</title><h1>Not found</h1>', { 'X-Robots-Tag': 'noindex, nofollow' })

  try {
    const business = await publicBusinessForRequest(req)
    if (!business) return send(res, 404, 'text/html; charset=utf-8', '<!doctype html><title>Website not found</title><h1>Website not found</h1><p>This AbroBiz website is not currently public.</p>', { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, max-age=30' })

    const url = canonical(slug)
    const title = titleFor(business)
    const description = descriptionFor(business)
    const image = imageFor(business)
    const indexable = business.seoIndexingEnabled !== false
    const robots = indexable ? 'index,follow' : 'noindex,nofollow'
    const configuredSite = process.env.SITE_URL || ''
    const baseUrl = (configuredSite.startsWith('https://') ? configuredSite : `https://${process.env.PLATFORM_DOMAIN || 'abrobiz.com'}`).replace(/\/+$/, '')
    const shellResponse = await fetch(`${baseUrl}/index.html`, { headers: { Accept: 'text/html' } })
    if (!shellResponse.ok) throw new Error(`Could not load storefront shell: ${shellResponse.status}`)
    let html = await shellResponse.text()
    const tags = [
      `<title>${htmlEscape(title)}</title>`,
      `<meta name="description" content="${htmlEscape(description)}">`,
      `<meta name="robots" content="${robots}">`,
      `<link rel="canonical" href="${htmlEscape(url)}">`,
      `<meta property="og:site_name" content="AbroBiz">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${htmlEscape(title)}">`,
      `<meta property="og:description" content="${htmlEscape(description)}">`,
      `<meta property="og:url" content="${htmlEscape(url)}">`,
      ...(image ? [`<meta property="og:image" content="${htmlEscape(image)}">`, `<meta name="twitter:image" content="${htmlEscape(image)}">`] : []),
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${htmlEscape(title)}">`,
      `<meta name="twitter:description" content="${htmlEscape(description)}">`,
      `<script type="application/ld+json">${jsonForHtml(schemaFor(business, url, description, image))}</script>`,
    ].join('')
    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
      .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
      .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
      .replace('</head>', `${tags}</head>`)
    html = html.replace('<div id="root"></div>', `<div id="root"><main><h1>${htmlEscape(business.name)}</h1><p>${htmlEscape(description)}</p></main></div>`)
    return send(res, 200, 'text/html; charset=utf-8', html, {
      'X-Robots-Tag': robots,
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      Vary: 'Host',
    })
  } catch {
    return send(res, 503, 'text/html; charset=utf-8', '<!doctype html><title>Temporarily unavailable</title><h1>Temporarily unavailable</h1>', { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
  }
}
