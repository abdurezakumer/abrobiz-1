# AbroBiz Phase 7 — Frontend, Browser & Client-Side Security Report

Date: 2026-08-30  
Scope: React/Vite frontend, browser entry points, routes, client API modules, Supabase browser client, public storefront rendering, uploads/previews, Vercel headers, dependency manifest/lockfile, and generated `dist` output. Phases 0–6 were preserved. No deployment, Git push, Supabase reset, or production payload execution was performed.

## Overall result

Static inspection found no React raw-HTML sink, iframe, `postMessage` listener, `eval`, or `new Function` usage. Phase 7 adds browser URL guards, safe contact links, redirect-state validation, reset-token URL scrubbing, safer user-facing error mapping, CSP/security headers, and regression tests.

The result is not declared fully production-ready: the live browser/deployment headers, real production bundle, authenticated flows, and dynamic tests still require a normal build/staging environment. The local build and Vitest startup are blocked by the environment-level Vite/esbuild `spawn EPERM` error.

### Finding register

| ID / severity | Component | Attack scenario | Current protection | Change made | Verification | Remaining risk |
|---|---|---|---|---|---|---|
| F-01 Medium | `src/lib/supabaseClient.ts` | XSS/extension reads provider-persisted browser session | Supabase-managed session; no custom token store; React escaping | Preserved architecture and added CSP/raw-sink tests | Static source scan | Not HttpOnly; future SSR/BFF could reduce exposure |
| F-02 Medium | `vercel.json` | Missing/misconfigured CSP permits script injection or framing | Existing nosniff/frame/HSTS headers | Added CSP with `frame-ancestors 'none'`, no `unsafe-eval` | JSON parse/static header test | Must verify actual Vercel headers and CSP violations |
| F-03 Medium | Route state / `Login.tsx`, `LegalAcceptance.tsx` | Crafted return state sends a user to an external site | Internal navigation only after React routing | Added same-origin `safeInternalPath` validation | Unit tests/static scan | New redirect parameters require the same allowlist |
| F-04 Medium | Stored URLs/images/social/maps/templates | `javascript:`, `data:`, protocol-relative, or malformed values reach browser sinks | Server validation exists for uploads/templates | Added HTTPS/image/contact/Telegram guards | URL unit tests/static scan | HTTPS third-party content remains a supply/privacy risk |
| F-05 Medium | `ResetPassword.tsx` | Reset token remains in history/referrer longer than necessary | Server hashed-token one-time flow | Replaced visible URL immediately after reading token | Typecheck/source inspection | Incoming-link handling still necessarily uses a URL token |
| F-06 Medium | Error rendering | Provider/database error reveals schema, stack, or infrastructure detail | Some API errors are mapped; React escapes text | Centralized friendly error fallback and updated direct catches | Source scan/typecheck | New UI catches must use the safe mapper |
| F-07 High | Staging/production verification | RLS/route/CSP/OAuth regression is not detected before release | Phase 0–6 server controls and static tests | Added Phase 7 static/unit tests | Typecheck; dynamic runs unavailable | Must execute with a staging project/browser |
| F-08 High | Build environment / Vite | Unverified artifact could contain a regression or secret | Existing build config; current `dist` scan clean | No bypass or unsafe build change | Exact `spawn EPERM` recorded | CI/normal workstation build is a release gate |
| F-09 Medium | Large lists and public images | Huge tenant render or third-party image requests consume resources | Phase 6 server bounds; CSP image policy | Kept bounds and guarded image values | Source inventory | Cursor pagination/virtualization and narrower image allowlist remain |

## A. Frontend attack surface

| Surface | Location | Data/control | Assessment |
|---|---|---|---|
| SPA bootstrap | `src/main.tsx`, `index.html` | React, BrowserRouter | No dynamic HTML bootstrap; static module entry |
| Public storefront | `src/pages/storefront/*`, `StorefrontLayout.tsx` | Business/catalog/gallery/social data | React text escaping; URL values now guarded |
| Auth | `Login.tsx`, `Register.tsx`, `VerifyEmail.tsx`, `ResetPassword.tsx`, `authContext.tsx` | Supabase session, email, password, OTP | Supabase session persistence; tokens not logged; reset URL scrubbed |
| Owner dashboard | `src/pages/*`, `DashboardLayout.tsx` | Tenant data and uploads | Route guards are UX only; RLS/RPC remains authoritative |
| Admin dashboard | `src/pages/admin/*`, `AdminLayout.tsx` | Templates, plans, payments, announcements | UI guarded; server/RLS/RPC must remain authoritative |
| Browser API | `src/lib/api/*`, `supabaseClient.ts` | Public anon Supabase client | No service-role client in frontend |
| Uploads | Billing, settings, catalog | Images/payment proofs | Phase 4 server validation remains required; client size/type checks exist in API modules |
| External navigation | social, maps, Telegram, GitHub, storefront links | Stored/admin/user values | HTTPS/allowlist-style guards added where values are untrusted |

## B. XSS audit

No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, Markdown-to-HTML renderer, rich-text renderer, `eval`, or `new Function` was found in `src`. User-generated names, descriptions, reviews, messages, notes, profile values, and template text are rendered as React text nodes, which escape markup.

The static test `supabase/functions/_shared/phase7_frontend_static_test.ts` checks the high-risk storefront/forms for these sinks. No production payload was executed.

Finding: **Low — future raw HTML risk**. Component: future rich-text/template features. Attack scenario: a later feature adds HTML rendering for business content. Current protection: React text rendering and static regression check. Change made: documented explicit no-HTML boundary. Verification: repository scan. Remaining risk: any future HTML feature must use a reviewed sanitizer and server validation. Priority: before adding rich text.

## C. URL security

Added `src/lib/safeUrl.ts` with guards for HTTPS URLs, image sources, internal paths, `mailto:`, `tel:`, and Telegram usernames. It rejects `javascript:`, `data:`, `vbscript:`, protocol-relative URLs, malformed contact values, and invalid Telegram handles.

Applied to business maps/social links, Telegram links, template preview/repository links, payment-proof URLs, catalog/storefront images, gallery images, and CSS image backgrounds. Static demo images remain fixed HTTPS constants.

## D. Redirect security

Login/legal return state is now passed through `safeInternalPath`, which requires a same-origin absolute path and rejects external, protocol-relative, and backslash-based destinations. The app does not consume arbitrary `next=`, `redirect=`, `return=`, or `continue=` query parameters.

OAuth redirect construction remains based on the current local origin or configured `VITE_SITE_URL`; it does not accept a user-supplied redirect URL. Supabase/Google configuration remains the server/provider authority.

## E. Authentication state

Supabase Auth manages the session with `persistSession` and `autoRefreshToken`. The browser receives only the public anon key and session required by Supabase Auth. Passwords are held in controlled form state and are not stored or logged. OTP is entered in form state only. Reset tokens are required in the incoming link but `ResetPassword.tsx` immediately replaces the visible URL with `/reset-password` after reading the token.

Finding: **Medium — session storage is provider-managed browser persistence**. Component: `src/lib/supabaseClient.ts`. Attack scenario: an XSS or compromised browser extension can access browser session state. Current protection: no application secrets or custom token store; React has no raw HTML sink; CSP is added. Change made: no custom auth mechanism introduced. Verification: source audit. Remaining risk: browser storage is not equivalent to HttpOnly cookies; keep XSS prevention and account/device hygiene strong. Priority: monitor, with a possible future SSR/BFF architecture if threat model requires HttpOnly cookies.

## F. Secret exposure

No frontend reference to `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `GOOGLE_CLIENT_SECRET`, mail passwords, or other server credentials was found. `VITE_SUPABASE_URL`, `VITE_SUPABASE_AUTH_URL`, `VITE_SUPABASE_ANON_KEY`, site/domain values, and Telegram bot username are public-build inputs by design. The existing `.env` was not printed or modified.

The existing `dist` directory had no source maps and no forbidden server-secret names in the bundle scan. A fresh production bundle could not be generated locally because of `spawn EPERM`.

## G. Environment variables

`.env.example` documents public `VITE_*` values separately from server-only names. Vite exposes variables prefixed with `VITE_`; therefore no server credential may be given that prefix. Supabase Edge Function secrets remain server-side. This report does not reproduce values from `.env`, Vercel, or Supabase.

## H. CSP

`vercel.json` now sends a CSP with `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `frame-src 'none'`, `script-src 'self'`, Supabase/API `connect-src`, Google Fonts style/font sources, HTTPS image/media sources, and `upgrade-insecure-requests`.

`style-src 'unsafe-inline'` remains necessary for the current React inline-style design and component `<style>` blocks. `unsafe-eval` is not allowed. `img-src https:` is intentionally broad because owners can use validated HTTPS image/storage URLs; this permits third-party image requests and should be narrowed to known CDN/storage origins if product requirements allow it.

Finding: **Medium — CSP needs production observation**. Component: `vercel.json`. Attack scenario: a required third-party resource is blocked, or a newly added dependency needs a source not covered by the policy. Current protection: explicit compatible policy. Change made: CSP added without `unsafe-eval`. Verification: JSON parse and static header check. Remaining risk: Vercel response behavior and every production resource need browser testing; consider `Content-Security-Policy-Report-Only` monitoring before tightening. Priority: before/with the next deployment.

## I. Security headers

Vercel sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/microphone/geolocation, `X-Permitted-Cross-Domain-Policies: none`, and HSTS with `includeSubDomains`. The header JSON parses successfully.

## J. Clickjacking

AbroBiz has no identified legitimate embedding requirement. `frame-ancestors 'none'`, `frame-src 'none'`, and `X-Frame-Options: DENY` protect the application and dashboard from framing. Payment-proof display is a normal new-tab link, not an iframe.

## K. HTTPS

Production-generated storefront URLs use HTTPS. External user/admin URLs are accepted for browser navigation only through HTTPS guards. The only `http://` references in frontend-related files are local development examples and a unit-test rejection case. CSP upgrades insecure requests. Verify custom-domain redirects and wildcard subdomains at the deployment layer.

## L. Cookie security

No application-created cookies were found. Supabase Auth’s browser session persistence is used instead of inventing an application cookie. Cookie flags are therefore controlled by Supabase, not this SPA. If a future server cookie is introduced, require Secure, HttpOnly, SameSite, narrow Domain/Path, and explicit expiry review.

## M. CSRF assessment

The browser uses Supabase Auth bearer/session transport and Edge Functions/RLS, not an application-authenticated cookie endpoint in this repository. CSRF tokens are not blindly added. Public state-changing forms are protected by Phase 3 rate limiting, server validation, and RPC/Edge Function write paths; authenticated authorization remains bearer/RLS based.

Residual risk: if a future backend endpoint authenticates by cookie, it must receive CSRF protection and SameSite review. Priority: architectural gate for any new cookie-authenticated endpoint.

## N. Client authorization analysis

`RequireOwner`, `RequireAdmin`, `RequireGuest`, and `RequireSetup` protect navigation and UX. They inspect profile role/business state, but they are not the security boundary. Phase 2 RLS, restricted RPC grants, Edge Function auth, and server-side owner/admin checks remain authoritative. A user modifying JavaScript or directly calling PostgREST cannot gain the role solely by bypassing a hidden button.

## O. Route security

Public routes include landing, terms/privacy, demo, and storefront routes. Authenticated/legal/setup routes are guarded. Owner routes are wrapped by `RequireOwner`; platform admin routes by `RequireAdmin`. Dynamic `/r/:slug` and hostname/subdomain resolution load data through tenant-scoped server/RLS queries; route parameters do not grant owner access.

Finding: **Medium — live cross-tenant route verification remains required**. Component: `App.tsx`, storefront/dashboard API modules, Phase 2 migrations. Attack scenario: a future query forgets its business filter or a policy regresses. Current protection: explicit owner query, RLS, Phase 6 integration test, route guards. Change made: no client authorization substitution. Verification: static audit only locally. Remaining risk: run authenticated user-A/user-B staging tests for every dashboard resource. Priority: release gate.

## P. Sensitive-data exposure

High-growth API lists were already changed in Phase 6 to explicit projections and bounds. Payment proofs are resolved through private signed URLs. The browser does receive IDs needed for relational actions and UI state; this is not itself an authorization grant. The admin business list still has a broad projection and should be narrowed in a future low-risk cleanup.

## Q. Dependency audit

`npm.cmd audit --audit-level=moderate --json` reported zero info/low/moderate/high/critical vulnerabilities across the installed dependency graph. Existing packages are React, React Router, Supabase JS, Framer Motion, Lucide, QRCode, Tailwind/Vite, Vitest, Testing Library, TypeScript, and related tooling. No dependency was added for Phase 7.

This is a point-in-time audit; rerun it in CI and review lockfile changes. No package was blindly upgraded.

## R. Supply-chain audit

`package.json` contains only normal `dev`, `build`, `preview`, `typecheck`, and `test` scripts. No preinstall/postinstall/install/prepare hook was found. The lockfile is present and was not regenerated. No suspicious dependency or new install script was introduced.

## S. Source-map analysis

Vite has no `sourcemap: true` setting, and the current `dist` directory contained no `.map` files. This avoids publishing source maps by default, but does not replace secret scanning: secrets must never be placed in source or environment values prefixed `VITE_`. Confirm the Vercel build artifact policy after deployment.

## T. Third-party scripts

The only external frontend resource found is Google Fonts imported by `src/index.css`. Static demo/storefront images use HTTPS Unsplash URLs; owner/admin image URLs are guarded at render time. There is no Google Analytics, tag manager, chat widget, payment SDK, or arbitrary third-party script tag. Google OAuth is a top-level provider flow through Supabase Auth, not an embedded script.

## U. Iframe audit

No iframe usage was found. CSP explicitly sets `frame-src 'none'` and `frame-ancestors 'none'`. This prevents future arbitrary user-controlled embedding unless a reviewed product requirement changes the policy.

## V. postMessage audit

No `postMessage` calls or `message` event listeners were found. There is no cross-window message trust boundary in the current frontend.

## W. File-preview security

Images and payment proofs are rendered as `img` or links; no `FileReader`, `URL.createObjectURL`, iframe, or executable document preview was found. Phase 4 storage-upload and signed-URL restrictions remain in place. Browser guards reject non-HTTPS remote image URLs and protocol-relative URLs. Payment PDFs are not executed by the application; the current admin image preview may simply fail to display a PDF, which is safer than embedding it.

## X. OTP security

OTP input is six individual fields with numeric input mode, one-time-code autocomplete on the first field, max length one, and no URL/log persistence. Resend/verification are server-side and rate limited by existing Edge/database controls. No OTP value is printed by the frontend.

## Y. Password-reset security

The Phase 0 hashed-token/service-role architecture remains intact. Reset tokens are read from the incoming link only as required, then the visible URL is replaced immediately. The reset form uses `type="password"`, preserves Phase 1 strength validation, and uses safe user-facing errors instead of displaying raw provider/database messages. Token reuse/expiry enforcement remains server-side.

## Z. Form security

Forms use React-controlled values, browser input types, required fields, password limits, and user-facing error state. Server validation, RLS, Edge limits, and RPC integrity remain authoritative. Public contact/booking/review forms use Phase 3 rate limiting. File API modules enforce type/size limits before upload; server-side Phase 4 validation remains required.

## AA. Frontend DoS/resource risks

High-growth list APIs have Phase 6 bounds. Storefront catalog and dashboard lists still render arrays in memory, but server limits prevent unbounded payloads. Auto-refresh is limited to the storefront data hook’s 30-second interval and is cleaned up on unmount. Important mutations disable submit controls while active and use Phase 3 idempotency for orders/payments. Remaining risks are large tenant rendering, repeated admin refreshes, and synchronous announcement delivery; use pagination/virtualization/queueing as scale grows.

## AB. Static tests

Added:

- `src/lib/__tests__/safeUrl.test.ts` for dangerous protocols, same-origin redirects, contact links, and Telegram handles.
- `supabase/functions/_shared/phase7_frontend_static_test.ts` for raw HTML/dynamic-code sinks, CSP/security headers, forbidden client secret names, and unsafe external navigation patterns.

## AC. Dynamic tests

No browser automation or production payload testing was performed. Existing Vitest tests cover application behavior; Phase 7’s URL tests are ready for execution. Staging browser tests should cover anonymous protected-route access, admin/owner route bypass attempts, tenant slug/subdomain access, OAuth return behavior, reset URL scrubbing, CSP console violations, upload previews, and dangerous URL fixtures.

## AD. Tests passed

- `npm.cmd run typecheck`: passed.
- `npm.cmd audit --audit-level=moderate --json`: passed with zero vulnerabilities.
- `vercel.json` JSON parse: passed.
- `git diff --check`: passed.
- Repository scans found no frontend raw HTML sinks, iframes, postMessage listeners, dynamic code execution, or server-secret references.

## AE. Tests not executed

- `npm.cmd test -- --run`: blocked before test execution by Vite/esbuild `Error: spawn EPERM` while loading `vite.config.ts`.
- `npm.cmd run build`: TypeScript passed, then Vite failed with the same `spawn EPERM`; it was not bypassed.
- Deno static tests: Deno is not installed.
- Browser/CSP/OAuth/upload tests against staging or production: not run.
- Vercel response headers and fresh bundle scan: not available without a successful build/deployment artifact.

## AF. Files changed

Phase 7 files added or modified in this turn:

- `src/lib/safeUrl.ts`
- `src/lib/__tests__/safeUrl.test.ts`
- `src/lib/errors.ts`
- `src/lib/api/telegram.ts`
- `src/components/Guards.tsx`
- `src/components/SpotlightHero.tsx`
- `src/components/StorefrontLayout.tsx`
- `src/components/TelegramConnectCard.tsx`
- `src/components/DashboardLayout.tsx`
- `src/pages/Login.tsx`
- `src/pages/LegalAcceptance.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Messages.tsx`
- `src/pages/BusinessSettings.tsx`
- `src/pages/CatalogEditor.tsx`
- `src/pages/SetupWizard.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/storefront/StorefrontHome.tsx`
- `src/pages/storefront/StorefrontMenu.tsx`
- `src/pages/storefront/StorefrontAbout.tsx`
- `src/pages/storefront/StorefrontContact.tsx`
- `src/pages/admin/AdminBusinesses.tsx`
- `src/pages/admin/AdminPayments.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `vercel.json`
- `supabase/functions/_shared/phase7_frontend_static_test.ts`
- `PHASE7_FRONTEND_SECURITY_REPORT.md`

Earlier Phase 0–6 worktree changes were preserved and not reset.

## AG. Remaining HIGH/CRITICAL findings

No Critical issue was proven by static repository inspection. Remaining High items:

1. **Live production/staging verification is incomplete.** RLS, actual Vercel headers, OAuth behavior, CSP compatibility, dynamic bundle content, and tenant route isolation need staging execution before release sign-off.
2. **Build/test execution is blocked locally.** The exact environment error is Vite/esbuild `spawn EPERM`; it must be resolved in CI or a normal developer environment, not bypassed.
3. **Production error/observability review remains operational.** Confirm Vercel/Supabase logs do not include bearer tokens, reset/OTP values, payment secrets, or provider response bodies.

Medium follow-ups include cursor pagination/virtualized rendering for large tenant lists, narrowing the remaining admin wildcard projection, CSP report-only monitoring and later tightening, and replacing synchronous email fan-out with a queue. No deployment, Git push, or Supabase change was performed.
