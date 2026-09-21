# AbroBiz SEO implementation report

Date: 2026-09-21

## SEO Status

**READY WITH MANUAL SEO/GOOGLE CHECKS**

The repository implementation and local automated checks are complete after the new migration is reviewed. External deployment, Supabase migration execution, DNS, browser source inspection, and Google Search Console checks remain manual.

## Platform SEO

- Central route-aware metadata is provided by `PlatformSeoHead` and `platformSeoForPath`; Vercel's platform renderer also provides source-visible HTML for the main public secondary routes.
- Homepage, About, Contact, Privacy, and Terms have deterministic titles, descriptions, canonical URLs, robots directives, and social metadata.
- The homepage emits Organization, WebSite, and SoftwareApplication JSON-LD using AbroBiz facts.
- Unknown platform routes use a 404 view and `noindex,nofollow` metadata.

## Business/Tenant SEO

- Tenant metadata is generated from the real business name, description/about content, category, public contact details, hours, logo/cover/social links, and owner-approved SEO fields.
- Canonical URLs are normalized to `https://<slug>.abrobiz.com/`.
- Structured data selects a justified business type and never fabricates ratings, reviews, awards, certifications, services, or prices.
- Storefront image alt text and stable dimensions were improved for gallery/logo images.

## Automatic New Business SEO

- Migration `0055_business_seo_system.sql` adds idempotent automatic field initialization and subscription/business-change triggers.
- Registration does not make a business indexable. Publication, block status, indexing preference, and the existing active/trial entitlement must all allow access.
- SEO generation is deterministic and does not call Gemini or block payment/subscription activation.

## Existing Business Backfill

- The migration performs an idempotent database-side backfill for existing rows and preserves fields whose source is customized, AI-generated, or admin-managed.
- It does not change publication, subscription, or owner state.

## Owner SEO Settings

- Business Settings now includes Website SEO with search visibility, title, description, social image URL, Google-style preview, and Reset to automatic.
- Owner edits are tracked as `owner_customized`; clearing a field returns it to `automatic`.

## AI SEO

No AI dependency was added. Existing AI copy remains optional and separate from deterministic SEO. AI failures cannot block activation or storefront SEO.

## Sitemap and robots

- Platform sitemap remains a small static sitemap for real public AbroBiz pages.
- Tenant sitemap, robots, sitemap index, and bounded tenant sitemap chunks are served through Vercel endpoints.
- Only eligible tenant roots are included; one-page storefront sections are not duplicated as fake SEO pages.

## Rendering strategy

See `SEO_RENDERING_STRATEGY.md`. Production tenant hosts use host-aware Vercel rewrites to return crawlable metadata/content before the SPA loads. Local `/r/:slug` remains client-rendered by design.

## Security

- Existing authentication, RLS, subscriptions, storage, payment, Telegram, and admin workflows were not redesigned.
- Public SEO RPCs expose only public storefront fields and apply the existing active/published/unblocked subscription predicate.
- Host, URL, HTML attribute, XML, and JSON-LD escaping is applied. No server secret is sent to the browser.

## Performance

- No SEO client library was added.
- Tenant sitemap requests are paginated and cacheable; the browser never loads the full tenant catalog.
- Tenant HTML/robots/sitemap cache keys vary by host and use short stale-while-revalidate windows.

## Files changed

- `src/lib/seo.ts`
- `src/components/SeoHead.tsx`
- `src/components/StorefrontPageShell.tsx`
- `src/lib/useStorefrontData.ts`
- `src/lib/api/businesses.ts`
- `src/types/index.ts`
- `src/pages/BusinessSettings.tsx`
- storefront image components/pages
- `api/_seo.ts` and public SEO endpoint handlers
- `vercel.json`, `public/robots.txt`
- `supabase/migrations/0055_business_seo_system.sql`
- SEO documentation files

## Database changes

Migration `0055_business_seo_system.sql` is additive and idempotent. It adds SEO fields, indexes, initialization/refresh triggers, public filtered RPCs, and an existing-business backfill. It has **not** been applied by this local task.

## Tests

- TypeScript: passed (`npm.cmd run typecheck`)
- Production build: passed (`npm.cmd run build`)
- ESLint: passed with 0 errors and 9 existing warnings
- Existing + SEO tests: 15 files passed, 144 tests passed (`npm.cmd test -- --run`)
- SEO tests: included in the passing suite (`src/lib/__tests__/seo.test.ts`)
- Tenant isolation: host validation and public-RPC boundaries statically reviewed; no live cross-tenant production test was run
- Security tests: repository test suite passed; secret scan passed for 332 tracked files
- Dependency audit: 0 vulnerabilities at the moderate threshold
- Diff check: passed; only normal line-ending notices were emitted

Database/RLS integration, Vercel endpoint execution, and production browser checks require configured staging/production environments and are not claimed from local source tests.

## Manual checks remaining

- Review and apply migration 0055 in the intended Supabase project.
- Deploy to Vercel with the documented server-side variables.
- Verify tenant HTML source, response status, robots, both sitemap types, cache headers, and cross-tenant isolation on two controlled test tenants.
- Run Search Console URL inspection and submit the platform/tenant sitemap index.

## Known limitations

- Search engines may take time to crawl/index pages; no ranking or traffic result is guaranteed.
- Google Search Console and external DNS/Vercel configuration cannot be verified from this repository alone.
- Local `/r/:slug` has client-only metadata because Vercel host rewrites do not run in Vite dev mode.
