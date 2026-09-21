/* eslint-disable @typescript-eslint/no-explicit-any */
import { PLATFORM_DOMAIN, SITE_URL, htmlEscape, send } from './_seo'

const pages: Record<string, { title: string; description: string }> = {
  '/about': { title: 'About AbroBiz — Bring your business online', description: 'Learn how AbroBiz helps businesses create, customize, and publish digital storefronts.' },
  '/contact': { title: 'Contact AbroBiz — Support for your storefront', description: 'Contact the AbroBiz support team for help with your account, website, and digital storefront.' },
  '/privacy': { title: 'Privacy Policy — AbroBiz', description: 'Read how AbroBiz handles account, business, storefront, and support information.' },
  '/terms': { title: 'Terms of Service — AbroBiz', description: 'Read the terms that apply to AbroBiz accounts, websites, plans, and storefronts.' },
}

export default async function handler(req: any, res: any) {
  const host = String(req.headers?.host || '').toLowerCase().split(':')[0]
  if (host !== PLATFORM_DOMAIN && host !== `www.${PLATFORM_DOMAIN}`) return send(res, 404, 'text/html; charset=utf-8', '<!doctype html><title>Not found</title><h1>Not found</h1>', { 'X-Robots-Tag': 'noindex, nofollow' })
  const path = new URL(req.url || '/', `https://${PLATFORM_DOMAIN}`).searchParams.get('path') || '/'
  const page = pages[path]
  if (!page) return send(res, 404, 'text/html; charset=utf-8', '<!doctype html><title>Not found</title><h1>Not found</h1>', { 'X-Robots-Tag': 'noindex, nofollow' })
  try {
    const baseUrl = SITE_URL.startsWith('https://') ? SITE_URL : `https://${PLATFORM_DOMAIN}`
    const shellResponse = await fetch(`${baseUrl}/index.html`, { headers: { Accept: 'text/html' } })
    if (!shellResponse.ok) throw new Error('platform shell unavailable')
    let html = await shellResponse.text()
    const canonical = `${baseUrl}${path}`
    const tags = `<title>${htmlEscape(page.title)}</title><meta name="description" content="${htmlEscape(page.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${htmlEscape(canonical)}"><meta property="og:site_name" content="AbroBiz"><meta property="og:type" content="website"><meta property="og:title" content="${htmlEscape(page.title)}"><meta property="og:description" content="${htmlEscape(page.description)}"><meta property="og:url" content="${htmlEscape(canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${htmlEscape(page.title)}"><meta name="twitter:description" content="${htmlEscape(page.description)}">`
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '').replace(/<link\s+rel="canonical"[^>]*>/gi, '').replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').replace('</head>', `${tags}</head>`)
    html = html.replace('<div id="root"></div>', `<div id="root"><main><h1>${htmlEscape(page.title.replace(' — AbroBiz', ''))}</h1><p>${htmlEscape(page.description)}</p></main></div>`)
    return send(res, 200, 'text/html; charset=utf-8', html, { 'X-Robots-Tag': 'index, follow', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900', Vary: 'Host' })
  } catch {
    return send(res, 503, 'text/html; charset=utf-8', '<!doctype html><title>Temporarily unavailable</title><h1>Temporarily unavailable</h1>', { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
  }
}
