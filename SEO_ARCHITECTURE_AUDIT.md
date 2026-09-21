# AbroBiz SEO architecture audit

Audit date: 2026-09-21  
Scope: production SEO implementation review and local implementation. No deployment, Git push, production secret change, or database migration execution was performed.

## Existing architecture

- AbroBiz is a React 19 + TypeScript + Vite single-page application deployed through Vercel.
- Supabase Auth, PostgreSQL/RLS, Storage, and Edge Functions remain the application authorities.
- A tenant is resolved from one validated subdomain label such as `luna-cafe.abrobiz.com`; local development also supports `/r/:slug`.
- Storefront content is loaded through the existing public/RLS-scoped queries and the existing `get_business_entitlements` function.
- Before this implementation, tenant title, canonical, Open Graph, Twitter, and JSON-LD were created only in a client `useEffect`, which is unreliable for source-level crawler inspection.

## Findings and decisions

1. Platform metadata remains in the existing static shell and is now updated centrally for public routes with `PlatformSeoHead`.
2. Tenant SEO is deterministic and derives only from public business data, category labels, publication state, and authoritative entitlement state.
3. Owner SEO settings are additive fields on `businesses`; facts remain in the existing business row and are not duplicated into a second content model.
4. Activation and business-edit database triggers refresh only automatic fields. They do not alter payment/subscription state and do not overwrite owner, AI, or admin sources.
5. Vercel rewrites provide crawler-facing tenant HTML, tenant robots, tenant sitemap, a scalable tenant sitemap index, and chunked tenant sitemaps. The HTML endpoint uses an anonymous, allowlisted Supabase RPC that returns storefront fields only.
6. Invalid or inactive tenant HTML/sitemaps are not treated as indexable. Authenticated, dashboard, admin, billing, payment, and preview routes remain outside public sitemap output.

## Risks and operational requirements

- Migration `0055_business_seo_system.sql` must be reviewed and applied to the production Supabase project before owner fields or Vercel SEO endpoints can use the new RPCs.
- Vercel must have `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`), `SITE_URL=https://abrobiz.com`, and `PLATFORM_DOMAIN=abrobiz.com` available to the serverless functions. No service-role key is required by these public endpoints.
- A Vercel deployment is required before inspecting rendered HTML from a tenant host. The repository can verify deterministic helpers and the frontend build, but cannot prove external DNS, cache, Google Search Console, or production function configuration.
- HTML is cached with a short tenant-safe cache lifetime and `Vary: Host`. Cache invalidation should be rechecked after changing a business slug or publication state.

## Security notes

- Public RPCs return only display fields and require active, published, unblocked businesses for crawl data.
- JSON-LD, attributes, canonical URLs, and XML values are escaped/serialized; raw user HTML is never inserted into the head.
- Tenant host validation accepts exactly one valid label under the configured platform domain and rejects reserved subdomains.
- No owner IDs, payment proofs, sales/commission data, admin notes, credentials, or provider secrets are placed in SEO.

