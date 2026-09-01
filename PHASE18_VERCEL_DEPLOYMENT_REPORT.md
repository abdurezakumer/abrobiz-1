# Phase 18 — Controlled Vercel deployment report

**PHASE 18 STATUS: PARTIAL**  
**VERCEL DEPLOYMENT: BLOCKED**  
**FINAL DECISION: NO-GO**  
Verification date: 2026-09-01  
Production target: `https://abrobiz.com`  
Canonical Supabase URL: `https://qgbvuvxxfogcsvqzncdx.supabase.co`

## Executive summary

The current repository is buildable and testable after repairing the local dependency/tooling issues. The production site is reachable through Vercel and wildcard tenant DNS resolves correctly, but the live deployment is older than the tested repository: it does not contain the Turnstile bundle reference, its HTML/CSS responses omit the repository CSP, and static responses include `Access-Control-Allow-Origin: *`.

Deployment was not performed because the Vercel project could not be positively identified or authenticated. There is no `.vercel/project.json`, no Vercel CLI executable is installed, and `npx vercel whoami` timed out. No deployment, migration, DNS change, secret rotation, or production-data change was performed.

## 1. Vercel project identity — BLOCKED

The repository has no `.vercel/project.json`. `vercel.json` defines SPA rewrites, cache rules, and headers but does not identify a Vercel project. The Vercel CLI executable was unavailable; an `npx vercel whoami` attempt timed out. The exact Vercel project associated with `abrobiz.com` and `www.abrobiz.com` is therefore not verified.

**Required:** open the Vercel Dashboard, verify the project owns all three domains, and record the project ID without placing it in public source. Do not deploy until that exact project is confirmed.

## 2. Domain configuration — PASS partial / MANUAL

Read-only DNS checks returned:

- `abrobiz.com`: apex resolved to Vercel IP addresses.
- `www.abrobiz.com`: CNAME to `16281c77b2ae7cf3.vercel-dns-017.com`.
- `business.abrobiz.com`: same Vercel CNAME.
- `random-test.abrobiz.com`: same Vercel CNAME.
- Authoritative nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.

No per-tenant DNS records were created. DNS resolution does not prove Vercel domain attachment, wildcard certificate coverage, or tenant data isolation; those remain manual.

## 3. Production environment variables — MANUAL / NOT VERIFIED

Local source expects the canonical public Supabase URL and public Turnstile site key. Vercel Production variables were not accessible. Verify status only, without values:

- `VITE_SUPABASE_URL`: expected canonical Supabase URL; hosted status NOT VERIFIED.
- `VITE_SUPABASE_ANON_KEY`: hosted status NOT VERIFIED.
- `VITE_TURNSTILE_SITE_KEY`: hosted status NOT VERIFIED.
- `VITE_SUPABASE_AUTH_URL`: optional; do not use unless custom Auth domain is active.

No server secret was added to a `VITE_*` variable in the current repository. The current local `.env` has a placeholder public key, not a usable production credential.

## 4. Supabase configuration — BLOCKED

`supabase/config.toml` and active local URL settings use project `qgbvuvxxfogcsvqzncdx`. Supabase CLI 2.114.0 is installed, but read-only project/migration commands could not complete because project listing had a network transport error and linked migration inspection failed while initializing the login role. No migration or remote change was performed.

The canonical Supabase public endpoints returned `401` with the local placeholder key, and the expected public `functions/v1/health` endpoint returned `404`. Remote Function deployment state and valid production credentials are not established.

## 5. Turnstile — FAIL live / MANUAL hosted configuration

The current repository has Turnstile UI and server validation. The live bundle at `/assets/index-BldiQQlm.js` contains no Turnstile reference, while the current local build generates a `TurnstileWidget` asset. The tested repository is not live.

Verify in Vercel/Supabase without printing values:

- `VITE_TURNSTILE_SITE_KEY`: PRESENT and correct for production.
- `TURNSTILE_SECRET_KEY`: PRESENT in Edge Function secrets.
- `TURNSTILE_ENFORCE=true`.
- Hostnames/actions match AbroBiz and tenant requirements.
- Missing, invalid, expired, wrong-host, and wrong-action tokens are denied.

## 6. CSP — FAIL live / PASS source

`vercel.json` defines a narrow CSP with explicit Turnstile script/frame/connect sources, `object-src 'none'`, `base-uri 'self'`, `form-action`, and `frame-ancestors`. Live `www`, sample tenant, and CSS responses did not include `Content-Security-Policy`. This is deployment/configuration drift and a release blocker. Do not weaken the source policy to hide the issue.

## 7. CORS — FAIL live static header / PASS source

Current source uses `CORS_ALLOWED_ORIGINS`, strict exact root/www origins, and one-label HTTPS tenant origins. It rejects wildcard, external, malformed, nested, and HTTP tenant origins.

Live Vercel HTML and CSS responses included `Access-Control-Allow-Origin: *`. The header is not present in the repository’s `vercel.json` or current frontend source and was observed on public static responses, so it appears to be hosting/platform behavior or deployed configuration drift; its exact Vercel source was not accessible for confirmation. This is not evidence that authenticated Edge Function CORS is wildcarded, but it must be verified and removed/limited if it affects API routes. Never use wildcard CORS for authenticated/private APIs.

## 8. Security headers — FAIL live / PASS source

Live responses showed:

- HSTS: present; `www` included `includeSubDomains`.
- `X-Content-Type-Options`: present.
- `X-Frame-Options: DENY`: present.
- `Referrer-Policy`: present.
- `Permissions-Policy`: present.
- CSP: missing.

The current source configuration is stronger than the deployed response. Recheck after deploying the tested repository.

## 9. Deployment commit/version — BLOCKED

No Vercel project identity or authenticated deployment session was available. No commit/version was deployed by this phase. The live bundle remains the older deployment with `/assets/index-BldiQQlm.js`; the current local build produces different asset hashes and includes Turnstile code.

## 10. Live bundle verification — FAIL

The deployed JavaScript was inspected without printing its contents. It contains no Turnstile or Cloudflare challenge reference, no old or canonical Supabase project string, and no privileged secret variable names. The absence of privileged names is good, but the absence of Turnstile proves the live bundle is not the current tested repository.

## 11. Authentication — NOT TESTED

Signup, Terms/Privacy, password policy, Turnstile, OTP, verification, login, wrong password, logout, and rate limits were not executed with controlled production accounts. Supabase Auth settings and hosted public variables remain manual.

## 12. Password reset — NOT TESTED

No controlled reset email, expiry, replay, invalid-token, generic-error, or login-after-reset test was executed.

## 13. RLS and tenant isolation — NOT TESTED

No live/staging Tenant A/B test was executed across businesses, profiles, products, orders, bookings, reviews, messages, payments, subscriptions, analytics, or Storage. Static policy review from previous phases is not runtime evidence.

## 14. Storage — NOT TESTED

No authorized/unauthorized upload, signed URL ownership, expiry, invalid MIME, oversized file, executable, renamed executable, or traversal test was executed.

## 15. DNS/wildcard — PASS partial

The requested tenant DNS behavior is visible through the resolver and points to Vercel. No per-tenant records were created. Application routing, certificate coverage, unknown-tenant behavior, and tenant isolation remain unverified.

## 16. Health endpoint — FAIL/NOT DEPLOYED

The repository contains `supabase/functions/health/index.ts`, configured with `verify_jwt=false`, supporting liveness/readiness checks. The canonical public URL returned `404`, so this function is not deployed at that project/path or is not available through the tested endpoint. No fake endpoint was created. Deploy and verify the actual function only after canonical project access is confirmed.

## 17. Edge Functions — NOT TESTED

No production Edge Function deployment was attempted. Deno remains unavailable for local Edge Function tests. Supabase CLI remote operations are blocked by network/login-role errors.

## 18. Telegram and cron — MANUAL

The local Telegram duplicate-import fix remains in source. Live bot token, webhook secret, endpoint, sender validation, replay rejection, rate limiting, file validation, cron secret, scheduler, and bounded processing were not tested.

## 19. Monitoring and backups — NOT VERIFIED

Vercel logs, Supabase/Edge Function/Auth logs, Turnstile events, alerts, retention, backup, PITR, and restore drill were not accessed. Do not claim these controls are active.

## 20. Build/test/dependency status

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test -- --run` | PASS; 9 files, 52 tests |
| `npm.cmd run build` | PASS; production build completed |
| `npm.cmd audit --audit-level=moderate --json` | PASS; 0 vulnerabilities |
| `git diff --check` | PASS; line-ending warning only |
| Deno tests | NOT RUN — Deno unavailable |
| Vercel CLI authentication | BLOCKED — CLI unavailable; `npx vercel whoami` timed out |
| Supabase CLI remote project/migration state | BLOCKED — network/login-role transport errors |
| Production load test | NOT TESTED — correctly not run |

Dependency changes validated by all local frontend checks: `react-router-dom`/`react-router` 7.18.3 and patched `nanoid` 3.3.18. Node 22.17.1 emitted engine warnings for installed `jsdom`/`undici`; use the supported Node version in CI.

## 21. Exact manual Vercel deployment procedure

1. In Vercel Dashboard, identify the project that currently owns `abrobiz.com` and `www.abrobiz.com`; record its project ID privately.
2. Confirm `*.abrobiz.com` is attached to that same project and wildcard TLS is valid.
3. Confirm Production environment variables by name/status only. Set the canonical public Supabase URL and production Turnstile site key. Keep all server secrets out of `VITE_*`.
4. Confirm the Supabase Edge Function secrets and migrations independently; do not use Vercel to hide missing backend configuration.
5. Ensure the project’s build uses the current tested branch/commit and `npm run build` succeeds.
6. Deploy from the verified Vercel project only. Do not deploy to an unknown project and do not use a different project name as a substitute for identity.
7. Immediately recheck the four domains, bundle hash/Turnstile asset, CSP, CORS behavior, HSTS, frame, MIME, referrer, and permissions headers.
8. Run the controlled smoke plan and two-tenant isolation tests. Do not load-test production.

## Final decision

**NO-GO.** The current tested repository is not deployed, Vercel project identity is unknown, live Turnstile is absent, live CSP is missing, live CORS behavior requires classification, and Supabase/Auth/RLS/Storage/provider settings remain unverified. No deployment was performed.
