# AbroBiz Phase 8 — Performance, Scalability & Reliability Report

Date: 2026-08-30  
Scope: React/Vite frontend, Supabase client/API usage, Edge Function call patterns, database access patterns, public storefront loading, storage/image rendering, Vercel configuration, and reliability controls. Phases 0–7 were preserved. No deployment, Git push, production-data mutation, Supabase reset, or speculative infrastructure was introduced.

## Status and optimization register

The architecture is prepared for large-scale growth, but this report does not claim support for 1,000,000 concurrent users. No production performance numbers were invented. The safest measurable changes were route-level splitting, bounded public-read retries, public configuration caching, hidden-tab refresh suspension, refresh de-duplication, lazy images, an application error boundary, static asset caching, and a guarded staging load scaffold.

| Optimization | Problem / evidence | Change | Expected benefit | Security impact | Verification |
|---|---|---|---|---|---|
| Route splitting | `App.tsx` eagerly imported all admin/dashboard/payment pages | Converted non-critical routes to `React.lazy` with `Suspense` | Smaller public startup bundle; dashboard code loads on demand | No auth/route boundary removed | Typecheck; bundle size not measured because build blocked |
| Public read resilience | Storefront refresh used overlapping 30-second intervals and retried only on the next interval | Added two-attempt transient retry with jitter and in-flight guard | Better transient-read recovery without infinite retries | Mutations are explicitly excluded | Typecheck/source inspection |
| Public configuration cache | Template/category config was queried on every storefront refresh | Added five-minute in-memory cache for public config only | Fewer low-volatility Supabase reads | No private/payment/auth data cached | Typecheck/source inspection |
| Visibility-aware refresh | Storefront polling continued while hidden | Pauses hidden-tab refresh and refreshes once on return | Less background traffic/battery use | No security state cached or paused | Source inspection |
| Image loading | Gallery/catalog/demo images lacked lazy/decode hints | Added lazy loading, dimensions, and async decoding where below fold | Lower initial network and layout-shift cost | Phase 4 upload checks unchanged | Source scan/typecheck |
| Failure isolation | No root React error boundary | Added safe fallback boundary with no stack logging | A render fault does not leave a blank uncontrolled shell | No diagnostic data exposed | Typecheck/source inspection |
| Static assets | No explicit Vercel cache rule for hashed assets | Added immutable one-year cache for `/assets/*` | Better repeat-load and CDN hit performance | Dynamic/sensitive responses unchanged | Vercel JSON parse |

## A. Baseline

Initial page load, Core Web Vitals, JavaScript/CSS byte sizes, image transfer sizes, API request counts, Supabase latency, Edge execution time, database plans, and concurrent capacity were **NOT MEASURED**. The repository contains a pre-existing `dist` directory, but it is not a fresh Phase 8 build artifact. No production telemetry or row/request counts were queried.

Static baseline observations: Vite/React SPA, Framer Motion animations, Google Fonts CSS import, one shared browser Supabase client, one storefront refresh loop, multiple bounded dashboard lists, and no existing route-level lazy loading or root error boundary.

## B. Bundle analysis

`package.json` has a modest application dependency set: React, React Router, Supabase JS, Framer Motion, Lucide, QRCode, Sonner, Tailwind/Vite, TypeScript, Vitest, and Testing Library. The largest likely application contributors are Framer Motion and Supabase JS, but actual chunk sizes were not measured. `npm audit` previously reports no vulnerabilities; dependency size is not a vulnerability finding.

## C. Code splitting

`src/App.tsx` now lazy-loads setup, auth forms, storefront, dashboard, admin, billing, catalog, and payment pages while keeping the landing/terms/privacy shell eager. This keeps the public entry path from eagerly importing every authenticated/admin screen. The lazy boundaries use a safe loading fallback and do not alter route guards. Build-time chunk sizes remain unverified because Vite cannot start in this environment.

## D. Image optimization

Below-fold gallery, catalog, demo, payment-proof, and settings images now use `loading="lazy"`, `decoding="async"`, and dimensions where practical. Above-fold storefront branding remains available immediately. Phase 4 MIME/size validation remains in the upload API and Edge Function. No client optimization was allowed to bypass server validation. Image byte sizes and actual LCP were not measured.

## E. Storage/CDN strategy

Public business/item images are served from Supabase Storage public URLs and remain public by product design. Payment proofs use the private bucket and signed URLs; their access checks and URL lifetime were not weakened. Vercel provides CDN delivery for frontend assets; Supabase provides storage delivery for images. Do not make private proofs public for caching. Consider image resizing/variants only after measuring storage bandwidth and LCP.

## F. Rendering performance

The app uses Framer Motion animations and maps bounded arrays. Storefront data is derived from bounded categories/items and does not perform large client-side sorting. A root `ErrorBoundary` now isolates render failures. No broad memoization was added without profiling. Large dashboard lists still need cursor pagination/virtualization when product limits grow; Phase 6 server caps remain active.

## G. Large-list optimization

Orders, payments, bookings, messages, reviews, items, announcements, and subscriptions have server-side limits from Phase 6. The frontend does not intentionally render thousands from one response. Admin business/payment views remain capped but are not cursor-paginated. The next measured improvement is keyset pagination and, for unusually large screens, virtualization. No pagination contract was changed in Phase 8.

## H. API request optimization

The storefront originally loaded business, categories, items, entitlements, template config, and category labels. Categories/items/entitlements/template are fetched concurrently; template and category configuration are now cached for five minutes. The public refresh is de-duplicated and suspended in hidden tabs. Dashboard layout uses explicit notification columns. No sensitive API response was made publicly cacheable.

## I. Client caching

Only low-volatility public template configuration and business-category labels use a module-local five-minute cache in `useStorefrontData.ts`. Payments, orders, bookings, reviews, messages, admin data, and auth state are not cached by this mechanism. Cache invalidation is time-based; it does not affect RLS or authorization. A broader query cache should be added only with ownership and invalidation tests.

## J. HTTP caching

`vercel.json` now marks hashed `/assets/*` files `public, max-age=31536000, immutable`. The SPA HTML and dynamic paths remain governed by Vercel defaults and are not given a long public cache. Sensitive Supabase/Edge responses are not controlled by this Vercel static header and must remain private/no-store where applicable. Public Supabase Storage cache behavior should be measured/configured at the storage/CDN layer, not by exposing private objects.

## K. Vercel/CDN analysis

Vercel already supplies edge delivery for static Vite assets and supports the SPA rewrite. No second CDN was introduced. The wildcard subdomain/public storefront architecture still requires domain routing and Supabase reads at runtime; Vercel static caching does not automatically cache tenant data. Verify wildcard-domain routing, cache headers, and cold-start behavior after a deployment in a controlled environment.

## L. Font optimization

`src/index.css` imports Inter, Outfit, and Playfair Display from Google Fonts with `display=swap`. This avoids invisible-text blocking but remains a third-party request with multiple weights. Actual font transfer and render timing were not measured. Reduce weights or self-host only if performance telemetry shows font requests are material; CSP already allowlists the required Google Fonts origins.

## M. Third-party resource audit

External resources are Google Fonts and fixed HTTPS Unsplash demo images. OAuth is a Supabase/Google top-level flow, not an embedded script. There is no analytics SDK, tag manager, map embed, social embed, payment SDK, or arbitrary script. User/admin images are URL-guarded. Third-party image requests can affect privacy/performance; a future approved image proxy/CDN should be justified by measurements.

## N. Supabase request optimization

Phase 6 explicit projections and limits remain intact. Public template/category configuration is cached, storefront reads run concurrently, and refreshes cannot overlap. The shared browser client is reused. `getMyBusiness` and single-row business reads still use broad projections because the mapper consumes many business settings; they are bounded single-row queries. No RLS or server-side authorization was bypassed.

## O. Edge Function performance

Phase 5 Edge Functions already bound body sizes, batch sizes, external calls, and authorization. External mail/Telegram/GitHub calls use bounded timeout helpers where applicable. Subscription and announcement fan-out remain sequential/side-effect loops and are bounded; they are the clearest future queue candidates. No security checks were removed for speed. Edge execution/CPU/latency was not measured.

## P. Database performance

Phase 6 migration `0030_phase6_database_scalability.sql` remains the database performance baseline: tenant/time/status indexes, explicit query projections, bounded maintenance, and retention indexes. No duplicate database work was repeated. Live `EXPLAIN`, table statistics, bloat, vacuum, lock, connection, and cache-hit measurements were unavailable.

## Q. N+1 analysis

No obvious frontend list-detail N+1 was found. Orders use nested `order_items`; storefront catalog loads categories/items in parallel; dashboard catalog loads categories/items in parallel. Subscription cron and announcement delivery perform per-recipient/per-row side effects intentionally, but should become queued/batched workflows when observed volume justifies it.

## R. Public page performance

Public storefront loading is resilient and non-blocking for analytics. Business/catalog/entitlement reads execute concurrently after the business lookup. Images are guarded and below-fold images lazy-load. `trackPageView` is fire-and-forget and failures do not prevent rendering. The storefront still depends on runtime API calls and has no SSR/HTML pre-render; no SSR infrastructure was added speculatively.

## S. Analytics performance

Page-view tracking is invoked without awaiting it, so visitors do not wait for analytics. The database has Phase 6 time indexing and bounded purge functions. Tracking errors are ignored by design because analytics is non-critical. Raw page-view retention and aggregation remain operational work; do not let analytics traffic consume the same capacity as transactional writes without monitoring.

## T. Authentication performance

Auth uses Supabase session state and bounded form interactions. Verification cooldown and storefront refresh timers are cleaned up. No auth polling loop was added. Login/signup/OTP/password reset mutations are not retried automatically, preserving provider and token semantics. Measure provider latency and rate-limit responses in staging before tuning.

## U. Retry strategy

`src/lib/retry.ts` provides a maximum-two-attempt retry only for idempotent storefront reads, and only for network/timeout/temporary-service/502–504-like errors. It uses bounded jittered backoff. Orders, payments, bookings, reviews, contact, email, Telegram, auth, and storage mutations are not passed through it. Phase 3 idempotency remains authoritative for order/payment side effects.

## V. Timeout strategy

Edge external calls already use bounded timeout helpers from Phase 5. Browser Supabase calls use the Supabase client transport and were not wrapped globally because changing the shared fetch could affect auth refresh and mutation semantics. Browser read retries are bounded, but a future measured timeout policy should be introduced at a carefully tested transport boundary.

## W. Graceful failure

Analytics failure does not block a storefront. Storefront polling keeps the last successful view on transient failure. Optional Telegram notification failures are non-fatal in existing API flows. Safe error messages and a root error boundary prevent raw traces. Core auth, business data, order, payment, and booking errors remain visible as retryable user-facing failures rather than being silently treated as success.

## X. Error boundaries

Added `src/components/ErrorBoundary.tsx` around the browser router. It renders a safe refresh fallback and does not print stack traces, tokens, or user data. This is a coarse application boundary; future complex admin/editor regions may add narrower boundaries if telemetry demonstrates value. No external monitoring SDK was introduced.

## Y. Core Web Vitals readiness

Measured: **not measured**.  
Not measured: LCP, INP, CLS, TTFB, total blocking time, transfer sizes, and mobile CPU.  
Targets: measure representative mobile/desktop public storefront, login, dashboard, and admin flows; keep LCP/INP/CLS within current web-vitals “good” thresholds before claiming release performance. Image dimensions, lazy loading, code splitting, font swap, and reduced background work prepare the app but do not establish scores.

## Z. Network concurrency

Storefront independent reads use `Promise.all`. Refresh requests now have an in-flight guard. Admin payment proof URL resolution still runs per pending payment and should be capped/paginated or resolved in a server batch if pending volume grows. Announcement email delivery remains bounded sequential work to avoid provider spikes. No unbounded `Promise.all` over user-controlled arrays was introduced.

## AA. Polling

Storefront refresh remains 30 seconds to preserve the existing auto-refresh behavior, but now uses a timeout schedule, stops while the tab is hidden, refreshes on return, cleans up on unmount, and avoids overlap. Landing animation and OTP cooldown intervals are local UI timers and are cleaned up. No realtime subscription was added.

## AB. Realtime

No Supabase Realtime channel or subscription was found. No Realtime architecture was added speculatively. If introduced later, scope channels by tenant, clean them up on unmount, and test duplicate subscriptions and RLS authorization.

## AC. Database pressure

Main pressure points are public page-view writes, rate-limit row locks, notification trigger writes, sequential subscription cron updates, announcement fan-out, and dashboard count/list reads. Phase 6 indexes/limits and Phase 3 rate limits remain. Monitor connection count, query latency, lock wait, Edge invocation duration, and provider response time before introducing queues or replicas.

## AD. Response size

High-growth list responses remain explicitly projected and bounded by Phase 6. Dashboard notifications now select only required fields. Single-row business settings and small admin catalogs may still use broad projections, but they are bounded. Compression is delegated to Vercel/Supabase transport. Cursor pagination remains the next response-size improvement for large tenants.

## AE. Payment reliability

Payment proof uploads remain private and server-validated. Submission retains Phase 3 idempotency, exact request handling, duplicate prevention, and server-side amount/plan integrity. Phase 8 adds no automatic payment retry. Signed URL ownership/security remains unchanged. A payment request must never be retried blindly from the browser.

## AF. Order reliability

Order creation retains the atomic server-side repricing RPC, tenant/publication/entitlement checks, request idempotency, bounded item count, and client submit control. Read retries are not applied to order mutations. Status updates remain server/RLS authorized. Concurrent order load and lock behavior require staging load tests.

## AG. Booking reliability

Booking submission retains Phase 3 rate limiting, server validation, entitlement/publication checks, tenant RLS, and notification behavior. No speculative locking or duplicate-booking mechanism was added because the repository does not establish a business-specific capacity rule. If bookings represent scarce slots, add an explicit server-side availability/unique constraint design after requirements and race testing.

## AH. Email reliability

Email provider calls remain server-side and bounded by existing Edge Function protections. Frontend does not retry verification, reset, announcement, or notification mutations automatically. Announcement fan-out is bounded but sequential; a durable queue/retry/dead-letter workflow is the future scale path. Provider failure is mapped to safe UI text and does not expose credentials.

## AI. Telegram reliability

Telegram webhook replay protection, rate limits, and Phase 5 external-call bounds remain. Browser Telegram links are validated. Optional notification failures remain non-fatal. Automatic Telegram mutation retries were not added, avoiding duplicate messages. Queueing/circuit breaking should be considered only after provider latency/error metrics show need.

## AJ. Storage performance

Images use lazy loading in browser views and private proof URLs remain signed. Upload MIME/size/ownership restrictions from Phase 4 remain unchanged. No longer-lived signed URLs or public payment-proof paths were introduced. Future improvements should use image variants/resizing and CDN cache measurement rather than weakening bucket policies.

## AK. SEO/public performance

The SPA has public routes and basic title metadata; no SSR was introduced. Public business content is rendered as escaped React text. Dynamic per-business metadata/canonical URLs are a future SEO improvement that must account for subdomains and not leak private data. Runtime API loading and external fonts/images remain the primary public-page performance variables.

## AL. Static asset optimization

Vite hashed assets receive immutable Vercel caching. Route-level lazy loading reduces the initial module graph. No unsafe dependency replacement or large asset deletion was performed. Google font variants and Unsplash image dimensions remain candidates for measured optimization. Fresh chunk/CSS sizes were not available because the build was blocked.

## AM. Vercel configuration

`vercel.json` retains the SPA rewrite and Phase 7 security headers/CSP/HSTS/clickjacking controls. It now adds an `/assets/(.*)` immutable cache rule. The rule does not cache private Supabase data. Verify response-header precedence and wildcard subdomain behavior on a staging deployment before production use.

## AN. Failure isolation

Critical: authentication, authorization, business data, orders, payments, and bookings. These failures remain surfaced and are not replaced with optimistic success. Non-critical: analytics, optional Telegram notifications, and optional template/config reads. Storefront analytics failure is ignored; optional template/category failures fall back to defaults. The root error boundary protects the render shell without exposing diagnostics.

## AO. Scale model

| Scale | Frontend/API pattern | Likely bottleneck | Required evidence/next step |
|---|---|---|---|
| 10,000 accounts | Vercel CDN serves split static assets; tenant reads remain runtime Supabase calls | Public read latency, page-view writes, basic connection/Edge quotas | Run representative staging load and enable slow-query/Edge metrics |
| 100,000 accounts | More tenant catalogs, dashboard history, public traffic, and auth events; hard limits become visible | Cursor pagination, raw analytics retention, notification/email fan-out, connection pressure | Add keyset pagination, scheduled cleanup, queue delivery, and measured cache strategy |
| 1,000,000 accounts | Large public read/write workload and substantial storage/analytics volume | Database/connection capacity, analytics storage, provider quotas, hot tenants, operational fan-out | Load-test and capacity-plan managed database scaling, read paths, analytics aggregation, and queueing |

These are architecture scenarios, not capacity guarantees. No concurrent-user claim is made.

## AP. Future scale triggers

| Trigger | Observed problem required | Technology | Why / expected benefit |
|---|---|---|---|
| Sustained hot rate-limit row lock or cross-region limiter latency | Database limiter contention or inaccurate distributed limits | Distributed/edge rate limiter, possibly Redis | Moves hot counters closer to ingress; preserves server authorization fallback |
| Repeated public read latency with high cacheable hit ratio | Supabase reads dominate storefront latency | Public-data cache/CDN | Reduces database reads; never include private/admin data |
| Announcement/cron backlog or provider timeouts | Sequential work exceeds schedule/provider window | Background queue + workers/dead letters | Backpressure, retries, observability, and isolation |
| Read CPU/latency saturation with healthy write workload | Read queries materially consume database capacity | Read replica/managed scaling | Separates read load after plans and RLS behavior are validated |
| Page-view table bloat or retention jobs cannot keep up | Raw analytics dominates storage/write vacuum work | Partitioning/aggregate tables/dedicated analytics store | Keeps transactional database focused on core records |
| Catalog/full-text search latency at measured scale | PostgreSQL search plans become inadequate | Search infrastructure | Specialized indexing/querying only when product search requires it |
| Supabase/Vercel delivery metrics show image bandwidth bottleneck | Images dominate transfer/LCP/storage egress | Image transformation service/CDN | Responsive variants and edge delivery without exposing private proofs |

No Redis, extra CDN, queue, replica, partitioning, or search system was added speculatively.

## AQ. Performance tests

Added `supabase/tests/phase8_performance_integration_test.ts`. It requires `PHASE8_TEST_BASE_URL` and `PHASE8_TEST_BUSINESS_SLUG`, refuses AbroBiz production/Supabase hosts, performs a staging public-page timing smoke request, and logs the actual measured duration. It does not invent thresholds or run against production. It was not executed because Deno is unavailable.

## AR. Load-test scaffold

Added `performance/load-test.staging.example.mjs`. It requires `PHASE8_LOAD_TEST_ALLOW=staging`, an HTTPS non-production target, refuses `abrobiz.com`, wildcard AbroBiz, and Supabase project hosts, caps users/requests conservatively, uses GET-only public browsing by default, and leaves mutation scenarios disabled. Order, booking, review, authentication, and dashboard scenarios are listed for a future isolated-fixture harness; they must not be enabled without staging credentials/data and separate review.

## AS. Security regression

Phase 8 did not weaken RLS, tenant isolation, authentication, authorization, rate limits, idempotency, storage policies, Edge Function security, or Phase 7 browser security. The new retry utility is read-only by contract. The new cache contains only public configuration. The new asset cache applies only to hashed static assets. Phase 7 safe URL handling and CSP remain in place. Phase 6 query projections/limits remain in place.

## AT. Tests passed

- `npm.cmd run typecheck`: passed after Phase 8 changes.
- `npm.cmd audit --audit-level=moderate --json`: zero vulnerabilities.
- `vercel.json` JSON parse: passed.
- `git diff --check`: passed.
- Static scans confirmed lazy image attributes on browser image tags, no new Realtime usage, no unsafe mutation retry, and no new server-secret frontend references.

## AU. Tests not executed

- `npm.cmd test -- --run`: blocked before test execution by Vite/esbuild `Error: spawn EPERM` while loading `vite.config.ts`.
- `npm.cmd run build`: TypeScript passed, then Vite failed with the same `spawn EPERM`; it was not bypassed.
- Deno static/performance tests: Deno is not installed.
- Fresh bundle/chunk-size analysis: unavailable because the build failed.
- Browser Lighthouse/Core Web Vitals, staging Supabase plans, RLS, Edge latency, storage bandwidth, Vercel cache headers, and load tests: not executed.
- No deployment, Git push, production data mutation, or Supabase reset was performed.

## AV. Files changed

Phase 8 files added or modified in this turn:

- `src/App.tsx`
- `src/main.tsx`
- `src/components/DashboardLayout.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/lib/useStorefrontData.ts`
- `src/lib/retry.ts`
- `vercel.json`
- `performance/load-test.staging.example.mjs`
- `supabase/tests/phase8_performance_integration_test.ts`
- `PHASE8_PERFORMANCE_SCALABILITY_REPORT.md`

Earlier Phase 0–7 worktree changes were preserved.

## AW. Remaining HIGH/CRITICAL risks

No Critical performance/reliability issue was proven by static inspection. Remaining High risks are:

1. **No real performance baseline or load evidence.** Production/staging latency, query plans, connection pressure, storage bandwidth, Edge duration, and Core Web Vitals are not measured. Resolve with isolated staging tests before capacity claims.
2. **Build/test execution is blocked locally.** Vite/esbuild `spawn EPERM` prevents fresh bundle and Vitest validation. Resolve in CI/normal workstation; do not bypass it.
3. **High-volume fan-out remains synchronous.** Subscription cron and announcement email work are bounded but can become backlog/provider bottlenecks. Add a durable queue when backlog or execution-time triggers are observed.
4. **Large-tenant pagination is bounded but not cursor-based.** Add keyset pagination before tenants routinely exceed dashboard caps.
5. **Retention/analytics operations require scheduling and monitoring.** Page views, notifications, replay state, and other append-heavy data require an approved retention/aggregation policy and observed cleanup jobs.

The current conclusion is: **the architecture is prepared for large-scale growth with measured next steps; it is not a claim of 1,000,000-concurrent-user capacity and is not fully production-ready until staging/build/load verification is complete.**
