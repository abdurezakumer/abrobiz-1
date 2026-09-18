# AbroBiz Google OAuth Branding & Homepage Verification Readiness

Audit date: 2026-09-18  
Production URL: https://abrobiz.com  
Scope: read-only production-readiness audit plus limited local public-branding improvements.  

## Executive summary

**READY WITH MANUAL GOOGLE CLOUD CHECKS**

The repository contains a coherent public AbroBiz identity, public Terms and Privacy pages, an optional Google Sign-In flow, a verified-domain homepage target, branded favicon assets, and production security controls. Local typecheck, tests, lint, build, dependency audit, and secret scanning completed successfully.

This cannot be classified as fully ready from repository evidence alone because Google Cloud OAuth consent-screen/client configuration is external to the repository, and clean-browser visual/mobile/console verification was unavailable in this audit. The final Google Cloud settings and the deployed version of the local public-page additions must be checked manually before submission.

No production deployment, Git push, database change, authentication change, secret change, or production-data mutation was performed.

## 1. Homepage and public identity

### Evidence

- `src/pages/Landing.tsx` identifies AbroBiz and explains the core service: businesses create digital storefronts, add business information/catalog content, choose templates, publish, and use QR-ready/shareable public links.
- The homepage describes supported examples including restaurants, cafés, salons, shops, and other businesses.
- The homepage contains feature, workflow, pricing, FAQ, live-business showcase, and data-use sections.
- The data-use section explains the roles of business owners, storefront visitors, and optional Google sign-in users, with a direct Privacy Policy link.
- Local public routes added or wired for this audit are `/about` and `/contact`.
- `src/pages/About.tsx` explains account creation, business configuration, templates, storefront publishing, subdomains, and customer-facing features.
- `src/pages/Contact.tsx` gives a public support address and safe guidance about what users should not send.

### Public URL checks

| URL | Live result | Content type | Note |
|---|---:|---|---|
| `https://abrobiz.com/` | 200 | `text/html` | Live SPA shell returned |
| `https://abrobiz.com/privacy` | 200 | `text/html` | Client route; live shell returned |
| `https://abrobiz.com/terms` | 200 | `text/html` | Client route; live shell returned |
| `https://abrobiz.com/about` | 200 | `text/html` | Local route added; not deployed in this audit |
| `https://abrobiz.com/contact` | 200 | `text/html` | Local route added; not deployed in this audit |
| `https://abrobiz.com/robots.txt` | 200 | `text/plain` | Live robots file reachable |
| `https://abrobiz.com/sitemap.xml` | 200 | `application/xml` | Live sitemap reachable |

The live responses are the Vercel SPA shell because this is a client-rendered Vite application. The local changes add the public route content, but they are not live until separately deployed by the owner.

## 2. Privacy Policy

### Evidence

- Public route: `https://abrobiz.com/privacy`.
- Source: `src/pages/Privacy.tsx`.
- The page describes account, verification, business, catalog, payment-submission, support, Telegram, and storefront-visitor information.
- It explains use for authentication, email verification, storefront/dashboard features, plan/payment workflows, notifications, support, abuse prevention, and reliability.
- It identifies intentionally public business information and explains service-provider processing.
- It describes security controls, retention, browser storage, rights, privacy requests, and a public support contact.
- The local page now explicitly explains that Google Sign-In is optional, identifies the basic account information used, states that AbroBiz does not request unrelated Google services, and states that AbroBiz does not ask for or store a Google password.

The policy is publicly reachable without login. The owner should ensure the deployed build includes the latest local wording before using the URL in Google Cloud.

## 3. Terms of Service

### Evidence

- Public route: `https://abrobiz.com/terms`.
- Source: `src/pages/Terms.tsx`.
- The page describes the AbroBiz service, account responsibilities, storefront content, plans/trials/payment workflows, optional integrations, acceptable use, suspension/termination, intellectual property, disclaimers, changes, and support.
- It is publicly reachable without login.

## 4. Google Sign-In implementation

### Repository findings

- Source: `src/lib/authActions.ts`, `src/components/GoogleSignInButton.tsx`, `src/pages/Login.tsx`, and `src/pages/Register.tsx`.
- Google Sign-In is optional and is displayed below the direct email/password form.
- The primary implementation loads Google Identity Services and exchanges a Google identity token through Supabase Auth using `signInWithIdToken`.
- A cryptographically random nonce is generated and supplied to the Google flow.
- A controlled OAuth fallback exists for applicable errors.
- No Google Drive, contacts, calendar, file, or unrelated API scopes were found in the inspected source.
- No Google client secret or other server secret is exposed in client source. The client ID is represented by the public `VITE_GOOGLE_CLIENT_ID` configuration variable.
- The application uses branded site/auth configuration through `src/lib/supabaseClient.ts`; the Supabase project identifier is not intended to be shown as the product name in the UI.

### Not verifiable from this repository

The following must be checked in Google Cloud and the production authentication provider: OAuth client type, authorized JavaScript origins, consent-screen app name/logo/support email, authorized domain, exact redirect URI if the fallback OAuth flow is used, publishing/testing status, and enabled provider configuration. Repository inspection cannot prove those external values.

## 5. Branding consistency

- Product name used in public UI, title, logo component, legal pages, and metadata: AbroBiz.
- Production domain used in public links: `abrobiz.com`.
- Support contact used in public pages: `abdurezak4525@gmail.com`.
- Favicon and touch-icon assets are present under `public/favicon_io/`.
- `index.html` links the favicon, Apple touch icon, and web manifest.
- The manifest is branded AbroBiz and uses the favicon assets.
- `src/components/AbroBizLogo.tsx` uses the AbroBiz logo mark asset while preserving the existing component API.
- Local `index.html` includes description, Open Graph identity, canonical homepage URL, Twitter summary metadata, and theme color.

## 6. Security controls preserved

This audit did not change security behavior. Static review found the following existing controls:

- Route guards for guest, authenticated, owner, admin, permission, setup, and super-admin areas in `src/components/Guards.tsx` and `src/App.tsx`.
- Supabase Row Level Security policies across profiles, businesses, catalog, forms, payments, notifications, admin records, templates, and storage in the migration history, including the latest hardening migration.
- Server-only use of service-role/API secrets in Edge Functions; client static security tests reject server-secret names in the frontend bundle.
- Shared validation, rate-limit, and Turnstile enforcement in protected/public Edge Functions.
- Safe URL/image/mail/telephone/Telegram URL helpers and strict tenant-host validation.
- No application `dangerouslySetInnerHTML`, raw `innerHTML`, `eval`, or `new Function` usage found in the inspected application source.
- Vercel headers include HSTS, CSP, frame denial, MIME sniffing protection, Referrer-Policy, Permissions-Policy, COOP/CORP, and cross-domain policy restrictions.
- HTTPS redirects from the production domain were observed with HTTP status 308.

No confirmed critical or high-severity security defect was demonstrated by this scoped audit. This is not a substitute for authenticated penetration testing or Google Cloud configuration review.

## 7. Architecture and deployment audit

- Frontend: React 19 + TypeScript, built with Vite; `src/main.tsx` mounts the SPA with React StrictMode and an error boundary.
- Routing: React Router routes public, auth, owner, admin, tenant, legal, and demo areas in `src/App.tsx`.
- Deployment: Vercel SPA rewrite and security headers are configured in `vercel.json`.
- Backend: Supabase Auth, PostgreSQL/RLS, Storage, and Edge Functions under `supabase/`.
- Edge Function gateway settings are in `supabase/config.toml`; public pre-auth/form functions and JWT-protected functions are distinguished there.
- Client/server boundary: public Vite variables are used only for public configuration; privileged keys are referenced in server-side Edge Function code and are not permitted in frontend source.
- Public tenant resolution validates the platform domain and subdomain structure in `src/lib/tenantHostname.ts` and `src/lib/storefrontUrl.ts`.

### Requested architecture coverage

1. Frontend/build: React, TypeScript, Vite, and the scripts in `package.json`.
2. Vercel: SPA rewrite, immutable asset caching, and security headers in `vercel.json`.
3. Supabase: Auth, PostgreSQL, Storage, Edge Functions, and `supabase/config.toml`.
4. Authentication: email/password, OTP, password reset, and optional Google identity-token sign-in.
5. Database schema: migration history under `supabase/migrations/`.
6. RLS: owner, tenant, public-form, admin, and storage policies in the migration history.
7. Edge Functions/API: auth, form, payment, storage, notification, admin, Telegram, AI, health, and scheduled functions.
8. Storage: public storefront assets and protected payment-proof paths with upload/signed-URL functions.
9. Email: signup/verification, OTP, password-reset, payment, notification, and announcement function areas use server-side provider configuration; no provider secret is in frontend code.
10. Google OAuth: GSI token + nonce flow, optional fallback OAuth, and provider configuration outside the repository.
11. Environment: `.env.example` documents public client settings and server-only provider secrets; actual `.env` values were not printed or included.
12. Boundaries: privileged Supabase, email, Telegram, Turnstile, Cloudflare, and Gemini keys are referenced only from server-side functions/configuration.
13. Admin: admin routes/pages include overview, users, businesses, payments, announcements, Telegram, marketing, management, audit, and settings.
14. Roles/permissions: route guards and permission-based admin routes are combined with database/RLS authorization.
15. Routing: public, tenant, auth, owner, admin, legal, and demo routes are defined in `src/App.tsx`.
16. API calls: frontend API modules and Supabase/Edge Function calls are used for plans, showcase, account, storefront, forms, billing, and admin workflows.
17. Database queries: direct client reads are RLS-scoped; public showcase/plan reads are browser-fetched and should remain bounded and measured.
18. Caching: Vercel immutable assets and Vite chunking are present; server-side public-data caching requires production measurement.
19. Error handling: `src/main.tsx` includes an error boundary; routes use loading fallbacks and user-facing toast/error states.
20. Logging: server/provider logs are external operational surfaces; no centralized browser logging/alerting was established by this repository audit.
21. Security controls: headers, safe URL handling, validation, RLS, guards, MFA/admin controls, and secret scanning were inspected.
22. Rate limiting: shared Edge Function rate limiting is used on authentication, forms, notifications, AI, and other abuse-sensitive endpoints.
23. Validation: shared request validation, Turnstile verification, safe URL checks, upload controls, and output validation are present.
24. Tests: Vitest suite, security tests, typecheck, lint, build, and secret scan were run; results are recorded below.
25. Performance: lazy routes, vendor chunks, immutable assets, safe images, and existing performance test examples are present; no production load test was run.

### Email and Resend-specific note

Email delivery is implemented in server-side Edge Functions and is not a browser-direct SMTP operation. The repository references server-side email/provider configuration and email templates/functions, while the frontend invokes protected/public workflows. Delivery success, sender-domain authentication, provider suppression, and production secrets cannot be proven from source alone and must be checked in the provider dashboard and function logs without exposing credentials.

## 8. Data, database, RLS, and storage review

- Database schema and policy history are in `supabase/migrations/`.
- RLS is enabled and policies cover owner/admin scoping, public storefront reads, public form inserts, and protected dashboard operations.
- The latest hardening migration includes additional scoped policies and protected-field controls.
- Storage policies distinguish public storefront assets from private payment proofs; upload and signed-URL operations are mediated by protected functions.
- No database schema or RLS policy was modified in this audit.
- Cross-tenant isolation and security behavior are covered by repository tests and static policy checks, but no new production tenant attack test was run because the request is audit-only.

## 9. API and Edge Function review

Inspected function areas include signup/login, OTP verification/resend, password reset, public contact/booking/review/order forms, payment submission, storage upload/signed URLs, announcements, notifications, Telegram, template import, AI copy generation, health, and scheduled subscription work.

Observed controls include JWT gateway settings where appropriate, function-level authorization, input validation, rate limiting, Turnstile for abuse-sensitive flows, generic password-reset responses, provider-secret isolation, and safe URL validation. A full production abuse test was not run because it could create external state or consume provider quotas.

## 10. Performance, scalability, and reliability

### Positive findings

- Route-level lazy loading is used for authenticated/admin/storefront pages.
- Vite manual vendor chunks and immutable asset caching are configured.
- The production build completed successfully with code-split template/admin/auth chunks.
- Asset URLs and storefront images are passed through safe image handling.
- Existing performance and load-test examples are present under `performance/`.

### Bottlenecks or follow-up items

| Location | Finding | Impact | Recommended fix | Priority |
|---|---|---|---|---|
| `dist` build output / Vite chunking | The shared initial bundle and vendor chunks are substantial; the build reported roughly 57 kB gzip for Supabase vendor, 83 kB for React vendor, and 39 kB for motion vendor. | Mobile startup cost can increase as traffic and feature count grow. | Measure Lighthouse/Core Web Vitals on production; defer nonessential motion and client integrations; keep route/template lazy boundaries under review. | Medium |
| `src/pages/Landing.tsx`, public data APIs | The live showcase and plan data are client-fetched from the browser. | Traffic spikes can multiply public API requests and make first render dependent on backend latency. | Add bounded/cached public reads at the API/CDN layer and verify pagination/limits for showcase data. | Medium |
| SPA public routes and `index.html` | Route-specific metadata is primarily client-rendered while the static shell has homepage metadata. | Search/social crawlers or verification systems that do not execute JavaScript may see generic homepage metadata for legal/about/contact routes. | After deployment, verify rendered HTML in Google Search Console/URL inspection and consider a route-aware pre-render/SSR strategy if needed. | Medium/manual |
| Database and Edge Functions | Million-user capacity, hot-query behavior, queue depth, provider quotas, and concurrent Edge Function limits cannot be proven by unit tests. | Capacity risk during spikes. | Run approved staging load tests, inspect query plans/index usage, add caching/queues where measurements justify them, and configure provider alerts. | Medium |

No production load test was run in this audit.

## 11. Validation completed

| Check | Result |
|---|---|
| TypeScript typecheck | Passed |
| Vitest suite | 13 files passed; 138 tests passed |
| ESLint | Passed with 0 errors and 9 warnings |
| Production build | Passed |
| `npm audit --audit-level=moderate` | 0 vulnerabilities reported |
| Secret scan | Passed for 313 tracked files; secret values were not printed |
| `git diff --check` | Passed; only normal line-ending notices were emitted |
| Live HTTPS redirect | HTTP redirects to HTTPS with 308 |
| Live security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy present |

The nine lint warnings are existing React Fast Refresh or hook-dependency warnings in unrelated files; there are no lint errors.

## A. CRITICAL issues

None confirmed by this scoped repository/static/live-header audit.

## B. HIGH issues

None confirmed in application source. The Google Cloud consent screen, OAuth client, and production provider configuration remain externally unverified and are a manual P0 check before submission.

## C. MEDIUM issues

1. Route-specific public metadata and content depend on client-side rendering. See `index.html`, `src/App.tsx`, and the performance table above. Verify rendered routes after deployment.
2. Public client-fetched showcase/plan reads and vendor bundle size should be measured under realistic traffic. See the performance table above.
3. No authenticated cross-tenant/browser matrix or production load test was run in this audit because the task explicitly requested audit-only work.

## D. LOW issues

1. ESLint reports nine warnings; none is an error and none is in the local public branding additions.
2. The production sitemap currently reflects the deployed version. The local sitemap adds `/about` and `/contact`; deploy and re-fetch the sitemap before relying on those entries.

## E. Performance bottlenecks

- The shared initial and vendor bundles are larger than ideal for slower mobile devices; the measured build sizes and mitigation are listed in Section 10.
- Motion, Supabase, and React vendor code should remain deferred where route boundaries allow it.
- Public plan/showcase data is fetched in the browser, so cache headers, bounded responses, and request volume should be measured under load.

## F. Scalability bottlenecks

- One-million-user capacity is not demonstrated by repository tests. The highest-risk areas are database hot paths, public reads, Edge Function concurrency, email/Telegram/Gemini provider quotas, and traffic spikes.
- Run the existing staging performance scenarios with production-like indexes, data volume, concurrency, and provider mocks before making capacity claims.
- Add metrics and alerts for latency, error rate, database saturation, function duration, queue depth, storage bandwidth, and provider throttling.

## G. Authentication weaknesses and checks

- No confirmed authentication vulnerability was found in the inspected source. Email/password, OTP, reset, guest/auth guards, Google nonce handling, generic reset responses, Turnstile, and rate limits are present.
- External Google client/consent/provider settings remain unverified and are the main authentication-related manual blocker for verification.
- Authenticated browser tests, session-expiry behavior, account-linking behavior, and MFA recovery were not executed in production during this audit.

## H. Database and RLS weaknesses and checks

- No confirmed RLS bypass was demonstrated by static review. Policies and hardening migrations provide owner, tenant, public-form, admin, and storage scoping.
- No production cross-tenant attack matrix or query-plan/load audit was run. That remains necessary before claiming million-user readiness.
- Keep all template rendering presentation-only and continue resolving tenant identity server-side/RLS-side rather than trusting browser-provided ownership fields.

## I. API and Edge Function weaknesses and checks

- No confirmed API authorization or secret-exposure defect was demonstrated in this audit.
- Public functions are intentionally reachable without JWT and rely on validation, generic responses, Turnstile where configured, and rate limiting; their production abuse limits and provider quotas still need monitored load testing.
- Do not use service-role clients from browser code. Existing static checks passed this boundary review.

## J. Infrastructure weaknesses and checks

- Vercel security headers and HTTPS redirect are present and were observed live.
- Google Cloud OAuth consent/client settings, production auth-provider settings, DNS/domain verification, provider email authentication, and deployed-version parity are outside repository evidence.
- Clean-browser rendering, mobile layout, browser console, and post-deployment route verification remain manual because the automated browser check was unavailable.

## K. Recommended implementation phases

1. **Before Google submission:** complete the manual Google Cloud checklist, confirm the exact production OAuth redirect/origin settings, and deploy/recheck the local public-page changes.
2. **Public verification:** open homepage, About, Contact, Privacy, and Terms logged out on desktop and mobile; verify visible brand, links, logo, support address, and no console errors.
3. **Operational verification:** confirm email sender authentication/delivery, auth-provider configuration, Vercel environment names, DNS, and Edge Function logs without exposing secrets.
4. **Security verification:** run approved authenticated tenant/RBAC/RLS tests in staging, including session expiry, Google account linking, upload authorization, and admin permission boundaries.
5. **Scale verification:** run staged concurrency tests, inspect PostgreSQL query plans/index usage, measure public-read/cache hit rates, and set provider/database/function alerts.
6. **Ongoing maintenance:** keep the dependency audit, secret scan, typecheck, tests, and build in CI; review CSP and OAuth origins whenever a domain or third-party integration changes.

## 16. Manual Google Cloud checklist

Complete these checks in Google Cloud Console and the production auth provider:

- Set application name to `AbroBiz`.
- Use the verified domain `abrobiz.com` as the authorized domain.
- Set the public homepage to `https://abrobiz.com/`.
- Set the privacy policy URL to `https://abrobiz.com/privacy`.
- Set the terms URL to `https://abrobiz.com/terms` if the consent configuration provides a terms field.
- Set the support email to `abdurezak4525@gmail.com` and verify that address in Google Cloud if required.
- Upload the AbroBiz logo/favicon asset where Google requests an app logo.
- Confirm the production JavaScript origin is `https://abrobiz.com` and add `https://www.abrobiz.com` only if that hostname is actually used and configured.
- Confirm the exact production redirect URI required by the configured Supabase/Auth OAuth flow. Do not use localhost in production.
- Confirm Google is enabled in the production auth provider and that the client ID matches the production public configuration.
- Keep consent scopes limited to identity/sign-in. Do not request Drive, contacts, calendar, files, or unrelated APIs.
- Confirm the consent screen is published or that all intended test users are explicitly configured.
- Open the homepage, privacy policy, and terms in a logged-out clean browser and verify that the visible brand, links, logo, and support contact match the consent screen.
- After deployment, validate `/about`, `/contact`, `/privacy`, `/terms`, robots, and sitemap again and submit the final public URLs to Google if requested.

## 17. Audit limitations

- Google Cloud Console settings and Supabase dashboard settings were not accessible through repository inspection.
- Clean-browser visual, responsive, and JavaScript-console verification could not be completed in this environment; manual browser verification remains required.
- No production login, signup, Google consent, OTP, payment, upload, tenant-isolation attack, or admin action was executed.
- No production data, users, secrets, schema, RLS policy, or deployment was changed.

## Final decision

**READY WITH MANUAL GOOGLE CLOUD CHECKS**

The application has the repository-level public branding and policy foundation needed for review. Submit only after the manual Google Cloud checklist is complete and the local public-page changes have been deployed and rechecked in a logged-out browser.
