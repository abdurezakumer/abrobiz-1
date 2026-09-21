# AbroBiz SEO rendering strategy

## Chosen approach

AbroBiz remains a Vite SPA for authenticated dashboards and storefront interaction. Public platform routes and tenant entry routes are additionally handled by small Vercel serverless endpoints:

```text
platform legal/about/contact request or tenant request
  -> Vercel host-aware rewrite
  -> /api/seo-platform-render or /api/seo-tenant-render
  -> (tenant) validated host slug + public get_public_business_seo RPC
  -> public metadata + JSON-LD
  -> deployed index.html shell with crawlable H1/description
  -> existing React storefront loads and replaces the root content
```

The response is generated from the request host, never a browser-supplied business ID. The canonical remains the tenant root URL even when `/menu`, `/about`, `/contact`, or `/book` is requested because the existing storefront presents those sections as one scrollable public page.

## Crawler endpoints

- `https://<tenant>.abrobiz.com/` and supported public paths: server-generated metadata and primary content shell.
- `https://<tenant>.abrobiz.com/robots.txt`: tenant-specific allow/disallow behavior.
- `https://<tenant>.abrobiz.com/sitemap.xml`: one canonical URL for the current one-page storefront.
- `https://abrobiz.com/sitemap-index.xml`: scalable tenant sitemap index.
- `https://abrobiz.com/sitemaps/tenants-N.xml`: bounded, paginated sitemap chunks.

The platform `public/sitemap.xml` remains a small sitemap for legitimate AbroBiz public pages. It does not contain private application routes.

## Cache safety

Tenant HTML, robots, and sitemap responses use short shared-cache lifetimes and `Vary: Host`. The cache key is therefore tenant-specific at the edge. Authenticated/private responses are not routed through these endpoints.

## Current limitations

- `/r/:slug` local/development routes use the client-side metadata path because the server rewrite is intentionally limited to production subdomains.
- The Vercel function must be deployed alongside the built SPA for crawler-visible HTML to be available. The local Vite dev server does not emulate Vercel rewrites.
- Google indexing, Search Console processing, DNS wildcard coverage, and real production cache behavior require manual verification after deployment.
