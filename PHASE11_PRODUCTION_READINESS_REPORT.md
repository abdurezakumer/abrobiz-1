# Phase 11 - Production Infrastructure Verification and Hardening

Date: 2026-08-31

## Executive summary

Status: **PARTIAL / NO-GO**.

Local hostname, secret-boundary, and configuration hardening is implemented and statically verified. Production DNS, Vercel domain registration, Supabase dashboard settings, Cloudflare state, email delivery, storage behavior, and cross-tenant live tests were not independently verified. No deployment, DNS mutation, secret rotation, Supabase reset, production-data change, or Git push was performed.

The expected scalable model remains one wildcard record, `*.abrobiz.com`, plus a unique database business slug, validated hostname resolution, application lookup, and RLS. Cloudflare/DNS must not be treated as tenant authorization.

## Production status key

- **PASS**: verified by a local check or source inspection.
- **FAIL**: a local/security defect was found and corrected, or a required condition is absent.
- **BLOCKED**: the check could not run because the environment/tooling prevented it.
- **MANUAL**: requires provider/dashboard action or authorized operator evidence.
- **NOT TESTED**: no safe local proof exists and no provider test was authorized.

## 1. Production architecture

| Component | Status | Evidence/next action |
|---|---|---|
| Root `https://abrobiz.com` | MANUAL | Verify Vercel domain, HTTPS, SPA rewrite, and canonical behavior |
| `www.abrobiz.com` | MANUAL | Verify intended redirect/canonical behavior and no loop |
| `*.abrobiz.com` | FAIL/MANUAL | Brief reports `CNAME cname.vercel-dns.com`, but read-only `nslookup test123.abrobiz.com` returned NXDOMAIN from the available resolver; verify the actual wildcard record and propagation |
| Vercel hosting | PASS/MANUAL | `vercel.json` is present and parses; production deployment settings are not visible locally |
| Supabase project | PASS/MANUAL | `supabase/config.toml` pins the canonical project ref; dashboard settings are not queried |
| Cloudflare | MANUAL | Phase 10 scaffolding exists; production Cloudflare state is not configured/verified here |
| Auth/PostgreSQL/RLS/Storage | PASS/MANUAL | Local migrations and code preserve prior boundaries; live policy verification is required |

## A. Wildcard tenant routing

The local resolver in `src/lib/tenantHostname.ts` lowercases hosts, safely removes a valid port and trailing dot, rejects paths/userinfo/control characters/invalid labels, limits tenant resolution to the configured platform domain or explicit localhost development, rejects nested untrusted hostnames, rejects reserved names, and enforces the existing slug length/character rules. `src/lib/storefrontUrl.ts` now applies HTTPS for production hosts while preserving localhost HTTP development.

The resolver does not accept tenant IDs from query parameters. Database lookup remains separate and RLS remains authoritative. Live DNS resolution, Vercel wildcard registration, and tenant lookup on the deployed domain are **NOT TESTED**.

## B. Tenant isolation

The existing Phase 2-8 application and RLS protections remain unchanged. Business slug uniqueness is defined by existing database constraints/indexes. Public storefront reads are limited to published/unblocked records by existing policies. Direct Tenant A -> Tenant B, storage, orders, bookings, reviews, messages, payments, analytics, and admin tests require two staging accounts and were not run.

## C. Vercel configuration

`vercel.json` contains SPA rewrites, security headers, immutable hashed-asset caching, and no Cloudflare-specific bypass. No production domain registration is represented in the file. The exact Vercel target must be verified from the Vercel Domains page; no target is invented in source. Secret separation is documented and locally scanned.

## D. Supabase configuration

`supabase/config.toml` identifies the canonical project ref and function JWT modes. The migration chain is ordered in the repository through the existing Phase 6 revision, and no migration was deleted or reset. Live migration history, Auth settings, grants, RLS, storage policies, function versions, and project URL must be checked in the canonical Supabase dashboard/CLI before release. No project switch was made.

## E. Authentication

Source inspection confirms the existing Phase 1 flows for email/password signup, six-digit OTP, login, password policy, reset, rate limits, email verification, legal acceptance, and Google OAuth. Phase 0 reset tokens are hashed, expiring, single-use, atomically claimed, and service-role protected in the migration architecture. Live Auth provider enablement, Site URL, redirect allowlist, Google callback, email confirmation mode, and concurrent replay tests are **MANUAL/NOT TESTED**.

## F. Email

Server-side sender selection and branded templates remain in the Edge Functions. Required production values are `RESEND_API_KEY`, `EMAIL_DOMAIN=abrobiz.com`, `EMAIL_FROM=AbroBiz <noreply@abrobiz.com>`, `APP_NAME=AbroBiz`, and `SITE_URL=https://abrobiz.com`; actual values must never be printed. Resend/SMTP domain verification, delivery, bounces, quotas, and deployed function secrets are **MANUAL/NOT TESTED**.

## G. Storage

Phase 4 protections remain: magic-byte/MIME checks, size limits, bounded UUID-based paths, traversal protection, private payment proofs, ownership checks, and signed URLs. Source audit records image limits at 5 MiB, payment-proof limits at 10 MiB, and signed URL behavior around 600 seconds. Direct browser bypass, live bucket policies, and object access tests are **NOT TESTED**.

## H. Security headers

`vercel.json` includes CSP, HSTS, `nosniff`, clickjacking protection, Referrer-Policy, Permissions-Policy, and cross-domain policy headers. CSP does not include `unsafe-eval`; `style-src 'unsafe-inline'` remains because the application uses inline React styles and is documented as an exception. Actual response headers through Vercel/Cloudflare are **MANUAL/NOT TESTED**.

## I. Cloudflare boundary

`supabase/functions/_shared/cloudflareDns.ts` is server-only, fixed to the `abrobiz.com` zone, validates zone/record IDs and record names/types/content, uses bounded timeouts and read-only retry, and does not expose a public DNS-management endpoint. Normal tenant creation does not call it and returns a deterministic wildcard result. No Turnstile was implemented in Phase 11.

## J. Cloudflare security preparation

Cloudflare WAF, edge rate limiting, bot protection, TLS, DNSSEC, proxy mode, and traffic visibility remain manual. Cloudflare should be outer protection; Phase 3 application limits and all Edge Function auth/authorization/validation remain required. No duplicate application limits or Cloudflare JavaScript was added.

## K. Cache security

Phase 8 public-config/browser caching and Vercel immutable asset caching remain. Edge/cloud caching must be restricted to public tenant-safe assets/data. Authenticated dashboard data, private tenant/customer data, payments, orders, messages, admin responses, signed URLs, and security responses must remain `no-store`; live cache behavior is **NOT TESTED**.

## L. SSRF and URL security

Existing external requests use HTTPS/allow-lists where applicable, bounded timeouts, bounded response sizes, and safe URL validation. GitHub template import is allow-listed to GitHub HTTPS URLs. Cloudflare DNS content is bounded and type-validated. No arbitrary Cloudflare endpoint or browser DNS API exists. Provider redirect behavior and live SSRF tests are **NOT TESTED**.

## M. Observability

Phase 9 structured logs and safe request IDs remain. Cloudflare and Vercel event collection, alert routing, provider dashboards, and log retention require manual configuration. No secrets, full auth headers, cookies, payment credentials, or raw customer bodies are included by the new Cloudflare scaffolding.

## N. Error handling

Existing clients receive generic errors; server-side provider/database details are not returned. The Phase 9 structured logger records only allow-listed safe metadata. Live error responses through Vercel/Supabase/Cloudflare are **NOT TESTED**.

## O. Production environment matrix

| Variable | Boundary | Required | Production configured? | Secret? | Purpose |
|---|---|---:|---|---:|---|
| `VITE_SUPABASE_URL` | Frontend | Yes | MANUAL | No | Public Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Yes | MANUAL | No, public client key | Public client authentication/API access |
| `VITE_SUPABASE_AUTH_URL` | Frontend | Optional | MANUAL | No | Branded Supabase custom auth/API URL |
| `VITE_SITE_URL` | Frontend | Yes | MANUAL | No | Public production link/OAuth origin |
| `VITE_PLATFORM_DOMAIN` | Frontend | Yes | MANUAL | No | Validated tenant domain |
| `SUPABASE_URL` | Edge Function | Platform-provided | MANUAL | No | Function backend URL |
| `SUPABASE_ANON_KEY` | Edge Function | Function-dependent | MANUAL | No | User-scoped client operations |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Privileged functions | MANUAL | Yes | Server-only privileged DB/storage operations |
| `RESEND_API_KEY` | Edge Function | If Resend | MANUAL | Yes | Server-side email delivery |
| `EMAIL_DOMAIN` | Edge Function | Branded email | MANUAL | No | Verified sender domain |
| `EMAIL_FROM` | Edge Function | Branded email | MANUAL | No | Visible sender header |
| `APP_NAME` | Edge Function | Yes | MANUAL | No | Email/application branding |
| `SITE_URL` | Edge Function | Yes | MANUAL | No | Verification/reset links |
| `CLOUDFLARE_API_TOKEN` | Edge Function only | Optional | MANUAL | Yes | Exceptional DNS API operations |
| `CLOUDFLARE_ZONE_ID` | Edge Function only | Optional | MANUAL | Sensitive configuration | Fixed AbroBiz zone |
| `CLOUDFLARE_ACCOUNT_ID` | Server only | Feature-dependent | MANUAL | Sensitive configuration | Only if a future API requires it |
| `TELEGRAM_BOT_TOKEN` | Edge Function | Telegram enabled | MANUAL | Yes | Telegram API |
| `TELEGRAM_WEBHOOK_SECRET` | Edge Function | Webhook enabled | MANUAL | Yes | Webhook authentication |
| `CRON_SECRET` | Edge Function | Cron enabled | MANUAL | Yes | Scheduled function authentication |

The repository contains only placeholders/names in `.env.example`; no secret values were printed or added. `VITE_*` values are build-public and must not contain privileged secrets.

## P. Domain/DNS audit

The supplied Phase 11 context reports a wildcard CNAME with value `cname.vercel-dns.com`. A read-only check on 2026-08-31 observed `abrobiz.com` resolving and `www.abrobiz.com` resolving to a Vercel-managed CNAME, while `test123.abrobiz.com` returned NXDOMAIN from the available resolver. This is a **FAIL/MANUAL** wildcard gate until authoritative DNS/Vercel configuration and propagation are corrected and rechecked. No DNS change was made. Verify with approved tools:

```text
nslookup abrobiz.com
nslookup test123.abrobiz.com
```

Expected: root resolves to the verified Vercel configuration; an unused tenant hostname follows the wildcard to Vercel; application lookup then returns tenant-not-found rather than another tenant. Exact IPs/aliases and propagation are not asserted. Public HTTP HEAD checks from this environment failed with a generic `WebException`, so response headers and deployed routing remain NOT TESTED.

## Q. Security test coverage

Added/retained local coverage for hostname normalization, reserved subdomains, HTTPS production behavior, ports, trailing dots, schemes, nested/untrusted hosts, valid slugs, and deterministic no-per-tenant DNS provisioning. Existing prior-phase tests cover RLS, storage, authentication, rate limiting, idempotency, and Edge Function security in environment-gated form. Full live cross-tenant, storage, cache, OAuth, provider, and header tests remain required.

## R. Performance readiness

The architecture retains bounded queries/payloads, Phase 6 indexes and cleanup, Phase 8 caching/lazy loading/retries, rate limiting, idempotency, and tenant isolation. No claim of 1,000,000 concurrent users is made. Real load, DNS propagation, CDN hit ratio, database connection pressure, function duration, and provider quotas require measured staging/production testing.

## S. Go/no-go checklist

Current decision: **NO-GO until all MANUAL/BLOCKED/NOT TESTED release gates below have evidence.**

- [ ] Vercel root/www/wildcard domains verified.
- [ ] Wildcard DNS and exact Vercel target verified.
- [ ] Supabase project, migrations, Auth, RLS, storage policies, grants, and functions verified.
- [ ] Email sender/domain, OTP, reset, and delivery events verified.
- [ ] Google OAuth production callback and redirect allowlist verified.
- [ ] Two-tenant isolation tests pass, including direct API/storage attempts.
- [ ] HTTPS/security headers/CSP/cache behavior verified through production edge.
- [ ] Cloudflare WAF/rate-limit/TLS/DNSSEC/proxy choices reviewed and monitored.
- [ ] Backup/restore and rollback evidence current.
- [ ] CI TypeScript, tests, build, audit, secret scan, and security tests pass.
- [ ] Production smoke tests and monitoring/on-call alerts pass.

## Required staging tests

Run using disposable staging data only: root/www/tenant/unknown/auth hostname routing; uppercase/ports/trailing dot/nested/forwarded-host cases; Tenant A/B reads and writes across every protected resource; storage object ownership and signed URL expiry; auth/OTP/reset replay and abuse; cache isolation; SSRF/URL fixtures; Cloudflare API mocks; Vercel header checks; email/Telegram/provider timeout behavior; migration/RLS restore rehearsal.

## Required production smoke tests

After an approved deployment: root and www, two known tenant subdomains, unknown tenant safe 404, HTTPS redirects, security headers, login/signup/OTP/reset/Google OAuth, one public storefront, owner dashboard isolation, storage upload/signed read, order/booking/review/payment idempotency, verification/reset email delivery, Telegram best-effort behavior, health liveness/readiness, logs, and alerts.

## Exact manual steps before production

1. In Vercel, verify root, www, and wildcard domains and obtain the exact DNS target.
2. In Vercel DNS/registrar, verify the wildcard CNAME and root/www records; do not create per-tenant records.
3. In Supabase, confirm the canonical project, migration history, Auth settings, Google provider, redirect allowlist, RLS, storage policies, grants, deployed functions, and server secrets.
4. Configure `EMAIL_DOMAIN`, `EMAIL_FROM`, `APP_NAME`, `SITE_URL`, Resend/SMTP, and delivery events; send test OTP/reset/announcement mail.
5. Verify storage buckets, private payment proofs, size/MIME/magic-byte behavior, and signed URL expiration.
6. Configure Cloudflare only if/when authorized: zone, wildcard web record, conservative WAF/rate limits, Full (strict), DNSSEC evaluation, and monitoring.
7. Create a minimum-scope Cloudflare API token only if exceptional DNS automation is required; store it server-side only.
8. Run staging cross-tenant, authentication, storage, failure, routing, and restore tests.
9. Resolve the local Vite/esbuild test/build limitation in CI or an approved environment.
10. Run production smoke tests, verify alerts/log access, and record evidence before go-live.

## Phase 12 recommendation

Phase 12 should implement Turnstile only after the production boundary is verified. Add server-side token validation to selected abuse-prone public endpoints, keep application rate limits, fail safely, avoid logging tokens, gate tests to staging, and verify accessibility/mobile behavior. Do not put Turnstile secrets in VITE variables or rely on the browser-only widget.

## Files changed in Phase 11

- `src/lib/tenantHostname.ts` - protocol-aware production HTTPS resolution.
- `src/lib/storefrontUrl.ts` - use protocol-aware resolver.
- `src/lib/__tests__/tenantHostname.test.ts` - HTTPS/host security regression coverage.
- `.env.example` - existing server-only Cloudflare variable placeholders retained/documented.
- `PHASE11_PRODUCTION_READINESS_REPORT.md` - this report.

## Validation results

PASS:

- `npm.cmd run typecheck`
- `npm.cmd audit --audit-level=moderate --json` (zero vulnerabilities reported)
- `git diff --check`
- `vercel.json` parse/configuration validation
- frontend secret-name scan for Cloudflare/server credentials
- required Phase 11 report and prior Phase 10 scaffolds present
- read-only DNS check: root and www resolved; `test123.abrobiz.com` returned NXDOMAIN

BLOCKED / NOT RUN:

- `npm.cmd test -- --run`: Vite/esbuild fails before test execution with `spawn EPERM`.
- `npm.cmd run build`: TypeScript stage passes; Vite fails with `spawn EPERM`.
- Deno tests: **DENO TESTS: NOT EXECUTED** - Deno unavailable.
- Live DNS/Vercel/Supabase/Cloudflare/Auth/email/storage/provider tests: **NOT TESTED** - no production mutation or deployment authorized.

## Final security findings

- No Cloudflare secret values were added to source or frontend code.
- No arbitrary DNS endpoint or client-controlled zone/record operation was introduced.
- No per-tenant DNS provisioning was introduced.
- Hostname validation rejects untrusted domains, malformed/nested hosts, reserved names, and production HTTP tenant requests.
- Cloudflare remains supplementary; application security and RLS remain authoritative.
- Production readiness cannot be claimed until the manual gates and blocked CI tests are completed.
