# Phase 10 - Cloudflare, Wildcard DNS, Vercel and Edge Security Report

Date: 2026-08-30

Scope: local configuration scaffolding, hostname security, tests, and documentation. No Cloudflare account/API token, Spaceship nameserver, Cloudflare DNS, Vercel production domain, Supabase data, or Git remote was changed.

## A. Architecture

Target architecture: Internet -> Cloudflare DNS -> Cloudflare Edge/WAF -> Vercel -> AbroBiz frontend -> Supabase Edge Functions -> Supabase Auth/PostgreSQL/RLS/Storage. Cloudflare is supplementary edge protection; it is never tenant authorization.

## B. DNS design

Use the existing root and www records after manual inventory. Use one wildcard record for tenant web traffic. Exact current records, targets, proxy mode, and TTL were not queried and are marked for manual verification in `CLOUDFLARE_DNS_INVENTORY.md`.

## C. Wildcard DNS

Preferred record: `*` / CNAME / exact Vercel target obtained from the Vercel Domains page. The target is intentionally not invented here. `business1.abrobiz.com`, `business2.abrobiz.com`, and other one-label tenants resolve through that record when no more-specific record exists. Specific records can override it. Never create `*.*` or one record per tenant.

## D. Vercel integration

The repository's `vercel.json` contains SPA rewrites, headers, and immutable asset caching; it does not register production domains. Vercel must manually verify `abrobiz.com`, `www.abrobiz.com`, and `*.abrobiz.com` as supported by the current project. Wildcard DNS alone does not prove Vercel wildcard-domain activation.

## E. Tenant hostname resolution

Added `src/lib/tenantHostname.ts` and routed `businessSlugFromHostname()` through it. It lowercases, strips one safe port/trailing dot, rejects paths/userinfo/control characters/invalid labels, accepts only the configured platform domain or explicit localhost development form, extracts one validated slug, rejects nested untrusted subdomains, and preserves the existing explicit `www.<tenant>` alias. A hostname lookup remains separate from database tenant lookup and RLS.

## F. Reserved subdomains

The shared client slug list now reserves `www`, `api`, `auth`, `admin`, `app`, `dashboard`, `mail`, `smtp`, `ftp`, `cdn`, `static`, `assets`, `support`, `status`, `billing`, `payments`, `storage`, `dev`, `staging`, `test`, `login`, `register`, and `setup`. The server-side DNS scaffold carries the same protection. The list is source-configured, not remotely configurable.

## G. DNS automation

Added server-only `supabase/functions/_shared/cloudflareDns.ts` with fixed `abrobiz.com` zone validation, allow-listed record types, bounded names/content, record-ID validation, timeout, safe read-only retry, and safe structured failure logging. Tenant creation is not connected to it. `tenantDnsProvisioning()` returns a deterministic wildcard result with `recordCreated: false`; normal tenant creation therefore performs no Cloudflare API call.

## H. Cloudflare API security

The abstraction uses the Cloudflare API only from server-side Deno code. It does not accept a client-supplied zone ID, token, arbitrary zone, or arbitrary record operation. Mutations are not automatically retried because a network timeout could otherwise duplicate a record. API error bodies are not logged.

## I. API token design

Required names are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID`; `CLOUDFLARE_ACCOUNT_ID` is optional only for a future feature that truly requires it. Use a scoped token limited to the `abrobiz.com` zone and minimum DNS permissions. Never use a Global API Key, VITE variable, frontend bundle, database field, or log. No real value was added.

## J. SSL/TLS

Use Cloudflare Full (strict) only after Vercel/origin certificate coverage and wildcard-domain verification are complete. Flexible is prohibited. The current certificate/Cloudflare account state was not verified.

## K. HTTPS

Preserve Vercel/application HTTPS and configure Cloudflare HTTP-to-HTTPS without competing redirects. Verify root, www, tenant, and auth/custom-domain behavior manually. No redirect rules were added locally.

## L. WAF

Recommended manual policy: conservative managed WAF and HTTP anomaly protection, tested in staging first. No default country/IP blocks; preserve legitimate Ethiopian, mobile, VPN, and partner traffic. Cloudflare rules must not replace application validation/RLS.

## M. Rate limiting

Cloudflare should be an outer layer for obvious abuse surfaces such as login, signup, reset/OTP, public writes, and payment/order/booking/review endpoints. Phase 3 database-backed application limits remain authoritative. Do not blindly duplicate application windows; tune outer limits from measured traffic.

## N. Caching

Safe candidates are public assets/images and carefully reviewed public storefront responses. Never cache authenticated, private tenant, payment, order, message, admin, or security-sensitive responses. Phase 8 browser/Vercel caching remains the local baseline. Cloudflare cache rules require manual review.

## O. Security headers

Phase 7 `vercel.json` headers remain the source-controlled baseline. Configure Cloudflare without conflicting duplicate CSP/HSTS/X-Frame-Options/Referrer-Policy headers. Verify final browser headers after proxying; no Cloudflare header policy was changed locally.

## P. Origin protection

Vercel's origin may remain directly reachable depending on project/provider configuration. Cloudflare does not automatically make it unreachable. Optional origin restriction must be evaluated with Vercel and tested without breaking deployments. Core security cannot depend on Cloudflare.

## Q. DNSSEC

Current DNSSEC state is **NOT VERIFIED**. After record and nameserver migration review, enable DNSSEC manually if supported and publish the Cloudflare DS values at Spaceship. Do not enable automatically.

## R. Spaceship migration

`CLOUDFLARE_DOMAIN_MIGRATION.md` documents add/import/verify records, exact Vercel target discovery, wildcard creation, nameserver change, propagation, HTTPS, Vercel, email, Supabase/Auth, and tenant verification. Nameservers and records are intentionally not included.

## S. DNS inventory

`CLOUDFLARE_DNS_INVENTORY.md` contains the required hostname/type/target/purpose/proxy/owner/criticality/manual notes table. Existing records are not claimed; unknown values are marked **REQUIRES MANUAL VERIFICATION**.

## T. Tenant routing tests

Added `performance/phase10-tenant-routing.staging.example.mjs`, which is HTTPS-only, staging-gated, refuses AbroBiz/Supabase/Cloudflare hosts, and performs read-only `/r/{slug}` smoke requests. It cannot prove DNS propagation from this environment and must not be run against production.

## U. Cross-tenant tests

Existing RLS/tenant security tests remain. Phase 10 adds hostname-level tests in `src/lib/__tests__/tenantHostname.test.ts`; a full Tenant A/Tenant B staging test must use two approved staging businesses and verify both hostname manipulation and direct database/RLS access.

## V. Host-header tests

Unit coverage includes uppercase hosts, ports, trailing dots, nested hosts, untrusted domains, invalid ports, reserved names, paths, and schemes. Forwarded headers are not trusted by the browser utility; any future server resolver must receive a validated deployment-provided host and must not infer tenant identity from arbitrary `X-Forwarded-Host`.

## W. API tests

The Cloudflare client validates fixed-zone names, safe record depth, allow-listed types, content bounds, IDs, token presence, and read-only retry behavior. An environment-gated provider integration test was not added because no production credentials may be used; provider fault tests belong in a mocked/disposable staging environment.

## X. DNS automation tests

Added Deno static tests for deterministic wildcard provisioning and reserved/malformed slug rejection. The architecture tests that tenant provisioning creates no per-tenant record. Deleted/suspended lifecycle policy remains application/database-owned and requires an explicit cooldown policy before implementing release automation.

## Y. Observability

Phase 9 structured logs remain active. Cloudflare API failures use safe fields and never log tokens, auth headers, cookies, Supabase keys, or provider bodies. Cloudflare WAF blocks, DNS failures, TLS failures, and origin errors require Cloudflare/Vercel dashboards and alerts configured manually.

## Z. Incident response

`INCIDENT_RESPONSE.md` now includes DNS misconfiguration, wildcard failure, Cloudflare outage, WAF false positives, TLS/redirect failures, token compromise, and domain-takeover response. `CLOUDFLARE_INCIDENT_RUNBOOK.md` provides focused procedures.

## AA. Token compromise response

Revoke the token, create a minimum-scope replacement, update only the server secret store, inspect Cloudflare audit activity, verify DNS/Vercel/TLS/application behavior, and record no token values. No token was created or stored.

## AB. Cloudflare outage response

Cloudflare DNS/edge/WAF/proxy traffic may fail or degrade. Direct Vercel origin reachability, if available, is not guaranteed and may have different TLS/security behavior. Supabase Auth/RLS, Edge Function validation, rate limits, and idempotency continue as application controls when reachable. Zero downtime is not claimed.

## AC. Scale architecture

The scalable model is one wildcard DNS record plus unique `businesses.slug`, validated application hostname resolution, tenant database lookup, and RLS. Normal business creation stores a slug only; it does not call Cloudflare and does not create a DNS record.

## AD. Performance

No Cloudflare JavaScript is added to pages. The resolver is local and bounded. Cloudflare should cache only safe public assets/responses, and tenant lookup should avoid running on static asset requests. Edge cache misses, origin latency, and database query costs require staging/production measurements.

## AE. Security boundary

The boundary is Cloudflare -> Vercel -> application -> Edge Functions -> Auth -> RLS -> database. A Cloudflare bypass must not bypass application authorization, validation, rate limits, idempotency, storage controls, or RLS.

## AF. Manual production configuration

Create/verify Cloudflare, import and verify all DNS, discover the exact Vercel target, register wildcard in Vercel, create one wildcard record, change Spaceship nameservers only after review, activate Full (strict), configure conservative WAF/rate limits, optionally create a minimum-scope server token, verify DNS/TLS/root/www/tenant/Auth/email/storage/payment/order, and monitor. Exact values must come from provider dashboards.

## AG. Remaining risks

1. Cloudflare zone, nameservers, DNS records, wildcard Vercel domain, proxy mode, TLS, WAF, DNSSEC, and alerts are not verified.
2. Existing Vercel target is unknown from repository files.
3. Provider integration/DNS propagation/cross-tenant staging tests were not executed.
4. Direct Vercel origin exposure may remain possible.
5. `www.<tenant>` compatibility alias is preserved; production canonical policy should be confirmed.
6. Tenant deleted/suspended/released lifecycle cooldown is not implemented.
7. Cloudflare API abstraction is intentionally not exposed through an endpoint; an approved exceptional automation use case would require a reviewed server endpoint and audit design.

## AH. Validation results

Passed locally:

- `npm.cmd run typecheck`
- Existing hostname tests are compatible with the resolver; new tests are present but Vitest execution is blocked by Vite/esbuild environment restrictions.
- `npm.cmd audit --audit-level=moderate --json` previously reported zero vulnerabilities.
- `git diff --check`
- `vercel.json` parse/configuration check
- secret-name scan: no Cloudflare secret values or server-only secret references added to frontend code
- required Phase 10 documents and test scaffolds exist

Not executed:

- `npm.cmd test -- --run`: Vite/esbuild `spawn EPERM` before test execution.
- `npm.cmd run build`: TypeScript stage passes; Vite build fails with `spawn EPERM`.
- Deno tests: **DENO TESTS: NOT EXECUTED** because Deno is unavailable.
- Cloudflare API/DNS, Vercel wildcard, Spaceship, TLS, WAF, DNSSEC, staging routing, and cross-tenant tests: not run; no provider changes were authorized.

## Files changed in Phase 10

- `src/lib/tenantHostname.ts`
- `src/lib/slugify.ts`
- `src/lib/storefrontUrl.ts`
- `src/lib/__tests__/tenantHostname.test.ts`
- `supabase/functions/_shared/cloudflareDns.ts`
- `supabase/functions/_shared/phase10_cloudflare_static_test.ts`
- `performance/phase10-tenant-routing.staging.example.mjs`
- `CLOUDFLARE_PRODUCTION_SETUP.md`
- `CLOUDFLARE_DOMAIN_MIGRATION.md`
- `CLOUDFLARE_DNS_INVENTORY.md`
- `CLOUDFLARE_INCIDENT_RUNBOOK.md`
- `PHASE10_CLOUDFLARE_REPORT.md`
- `INCIDENT_RESPONSE.md`
