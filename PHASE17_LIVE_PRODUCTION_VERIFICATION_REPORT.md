# Phase 17 — Live production verification report

**PHASE 17 STATUS: PARTIAL**  
**FINAL DECISION: NO-GO**  
Verification date: 2026-09-01  
Production domain: `https://abrobiz.com`  
Canonical Supabase project: `qgbvuvxxfogcsvqzncdx`  
Hosting: Vercel  
Expected wildcard: `*.abrobiz.com`

## Executive summary

Read-only live checks reached Vercel and confirmed apex redirect behavior, `www`, sample tenant, and random tenant DNS/application shell responses. The current production deployment is not the current repository: its JavaScript bundle contains no Turnstile reference, and its HTML response omits the CSP defined in `vercel.json`. The live response also exposes `Access-Control-Allow-Origin: *` on the HTML shell. Current source now builds and tests successfully, but it has not been deployed in this phase because Vercel authentication/project ownership and hosted environment variables were not verified.

The release remains **NO-GO**. No Supabase migration, Edge Function deployment, Vercel deployment, DNS change, secret rotation, database reset, production data mutation, or production load test was performed.

## Status matrix

| Component | Status | Evidence |
|---|---|---|
| Supabase | BLOCKED | Local config is canonical; CLI project/network operations failed; remote state not inspected |
| Migration state | MANUAL | 30 migrations reviewed; none applied; remote history unknown |
| RLS | NOT TESTED | Static policies reviewed; no authenticated cross-tenant runtime test |
| Storage | NOT TESTED | Static validation reviewed; no staging/live object test |
| Auth | NOT TESTED | Live signup/login/session flow not executed |
| OTP | NOT TESTED | No controlled email delivery test |
| Password reset | NOT TESTED | No controlled reset delivery/replay test |
| Google OAuth | MANUAL | Callback source reviewed; provider/dashboard allowlist not verified |
| Resend | MANUAL | Domain, sender, key, and delivery not verified |
| Turnstile | FAIL | Current production bundle has no Turnstile reference; hosted configuration not verified |
| DNS | PASS partial | Apex, www, sample tenant, and random tenant resolved through Vercel |
| Wildcard | PASS partial | Multiple tenant-like names resolve to the same Vercel CNAME; tenant data isolation untested |
| Vercel | MANUAL / FAIL drift | Live Vercel response exists, but hosted project/variables are unverified and deployment is stale |
| Edge Functions | NOT TESTED | Canonical health function returned 404; deployment list unavailable |
| Telegram | MANUAL | Local import fixed; live webhook/token/replay test not performed |
| Cron | MANUAL | Secret and scheduler unavailable |
| CORS | FAIL live / PASS source | Source uses strict `CORS_ALLOWED_ORIGINS`; live HTML sends `Access-Control-Allow-Origin: *` |
| Security headers | FAIL live / PASS source | HSTS/MIME/referrer/permissions/frame headers present; live CSP missing |
| Monitoring | MANUAL | No dashboards/log sinks accessed |
| Backup/PITR | NOT VERIFIED | No Supabase backup/PITR evidence |
| Staging load test | NOT TESTED | No load test run |

## 1. Supabase project identity

**Status: BLOCKED.**

Local `supabase/config.toml`, `.env.example`, and local non-secret URL settings identify `qgbvuvxxfogcsvqzncdx`. The old project reference was removed from active local URL configuration; remaining repository references are historical audit/checklist text or a static assertion that prevents its return.

The local public anon key is a placeholder, so local authenticated calls are not usable. Read-only requests to the canonical Supabase Auth/REST endpoints returned `401`, and the expected `functions/v1/health` endpoint returned `404`. These results do not prove the project is misconfigured; they prove live function deployment and usable credentials were not established here.

Supabase CLI 2.114.0 is installed. With telemetry disabled, `projects list` failed with a network transport error and `migration list --linked` failed while initializing the login role. No CLI command changed remote state.

## 2. Migration state

**Status: MANUAL.**

All 30 migrations remain in the repository and were reviewed in order. No migration was applied. The existing [PRODUCTION_MIGRATION_CHECKLIST.md](PRODUCTION_MIGRATION_CHECKLIST.md) records dependencies, RLS, policies, `SECURITY DEFINER`, grants, indexes, constraints, triggers, Storage policies, cleanup behavior, and verification methods.

Migration 0025 intentionally deletes legacy password-reset tokens and drops the old token column. Migrations 0028/0030 contain bounded cleanup functions. These operations require backup and remote preflight. Do not run `db reset`, blind migration push, or production migration commands until project identity, remote history, backup/PITR, duplicate preflight, and rollback ownership are confirmed.

## 3. RLS and tenant isolation

**Status: NOT TESTED.**

Static source and migrations contain owner/admin checks, tenant-preserving policies, public published-tenant rules, and Storage path checks. No live/staging test was executed for Tenant A/B across businesses, profiles, products, orders, bookings, reviews, messages, payments, subscriptions, analytics, or Storage. No RLS PASS claim is made.

## 4. Storage

**Status: NOT TESTED.**

Static code validates JPEG/PNG/WebP/PDF magic bytes, size, generated paths, private payment proofs, ownership, and signed URL expiry. Live/staging tests for executable files, renamed executables, oversized files, invalid MIME, traversal names, cross-tenant access, private buckets, and expiration remain manual.

## 5. Authentication, OTP, password reset

**Status: NOT TESTED.**

The repository contains custom bounded signup/login/OTP/reset handlers, legal acceptance, generic errors, and replay/expiry controls. No controlled production test account was used. Signup delivery, verification, weak/wrong password handling, OTP expiry/reuse/resend rate limits, reset token behavior, session logout, and email enumeration protections remain unverified at runtime.

## 6. Google OAuth

**Status: MANUAL.**

The local callback configuration now targets the canonical Supabase Auth endpoint. Google Cloud OAuth client settings, Supabase provider enablement, exact redirect allowlist, production Site URL, and any `auth.abrobiz.com` custom domain were not accessed. Do not use the custom Auth domain unless its activation is independently confirmed.

## 7. Resend/email

**Status: MANUAL.**

No provider dashboard or disposable mailbox was accessed. `abrobiz.com`, `AbroBiz <noreply@abrobiz.com>`, SPF/DKIM/DMARC, API key, signup OTP, resend, password reset, expiry, replay, bounce handling, and log redaction remain unverified.

## 8. Turnstile

**Status: FAIL live / MANUAL hosted configuration.**

Current source includes `TurnstileWidget`, the server Siteverify call, action/hostname checks, bounded token handling, and enforcement configuration. However, the live `www.abrobiz.com` HTML references the older `/assets/index-BldiQQlm.js`; downloading that bundle showed no `turnstile`, Cloudflare challenge, or Turnstile widget reference. The current local build produces a separate `TurnstileWidget` asset. Therefore the live deployment does not contain the current Turnstile integration, or it is not reachable from the deployed bundle.

Verify Vercel `VITE_TURNSTILE_SITE_KEY`, Supabase `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENFORCE=true`, actions, and hostnames manually after deployment. Test valid, missing, invalid, expired, wrong-host, and wrong-action tokens without logging token values.

## 9. DNS and wildcard

**Status: PASS partial.**

Read-only resolver checks returned:

- `abrobiz.com`: apex resolved through `nslookup` to two Vercel IP addresses.
- `www.abrobiz.com`: CNAME to `16281c77b2ae7cf3.vercel-dns-017.com`.
- `business.abrobiz.com`: same Vercel CNAME.
- `random-test.abrobiz.com`: same Vercel CNAME.
- Authoritative nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.

No per-tenant records were created. DNS resolution is not equivalent to verified TLS, Vercel domain attachment, or tenant RLS isolation.

## 10. Live Vercel and HTTP evidence

**Status: MANUAL / FAIL drift.**

Live requests returned:

- Apex: HTTP `308` redirect to `https://www.abrobiz.com/`.
- `www`, `business`, and `random-test` tenant: HTTP `200`, `Server: Vercel`.
- Live HTML asset: `/assets/index-BldiQQlm.js`.
- Live CSS asset: `/assets/index-Bft_qSFH.css`.
- Live HTML `Cache-Control`: `public, max-age=0, must-revalidate`.
- Live HTML includes HSTS, MIME, referrer, permissions, and `X-Frame-Options` headers.
- Live HTML omits `Content-Security-Policy`, despite the repository `vercel.json` defining one.
- Live HTML includes `Access-Control-Allow-Origin: *`.

The live deployment is materially behind the repository. Vercel CLI was not authenticated/available for a safe project inspection, and the `npx vercel whoami` check timed out. No deployment was triggered.

Unknown tenant HTML returns the same SPA shell as the sample tenant. This is not by itself a data leak because tenant data is client-resolved, but it cannot establish that the application rejects unknown tenants or prevents cross-tenant data access.

## 11. Cloudflare architecture

**Status: MANUAL.**

Current DNS evidence shows Vercel authoritative nameservers. The verified path is therefore Vercel DNS/hosting plus any separately configured Cloudflare services. Cloudflare WAF protection must not be claimed because request-path proxying was not established. Do not migrate nameservers or change DNS as part of this report.

## 12. Edge Functions, Telegram, and cron

**Status: NOT TESTED / MANUAL.**

The repository has function JWT configuration, generic errors, rate limits, idempotency, file validation, webhook replay protection, and cron secret checks. The canonical public health function returned 404, and remote function deployment/authentication could not be inspected. Telegram controlled update/replay tests and cron missing/wrong/correct secret tests were not run.

## 13. CORS

**Status: FAIL live / PASS source.**

The active source utility reads only `CORS_ALLOWED_ORIGINS`, rejects `*`, allows exact root/www origins and strict one-label HTTPS tenant origins, and rejects external/malformed/nested/HTTP tenant origins. The production HTML response currently exposes `Access-Control-Allow-Origin: *`; this header is not produced by the current source `vercel.json` and indicates deployment/platform configuration drift. Verify whether it is a platform-level header and remove the wildcard before release.

## 14. Security headers

**Status: FAIL live / PASS source.**

Repository configuration defines CSP with Turnstile sources, HSTS, MIME, frame, referrer, and permissions controls. Live responses showed HSTS, MIME, frame, referrer, and permissions headers, but no CSP. The live CSP failure is a release blocker.

## 15. Monitoring

**Status: MANUAL.**

Safe structured logging helpers exist in the repository. Vercel logs, Supabase logs, Edge Function logs, Auth events, Cloudflare Turnstile events, alerts, retention, and incident ownership were not inspected. No claim is made that secrets/tokens/passwords are absent from hosted logs.

## 16. Backup/PITR

**Status: NOT VERIFIED.**

Backup schedule, retention, PITR, restore capability, latest backup, and staging restore drill were not accessed. No production restore test was attempted. Use [PRODUCTION_BACKUP_RESTORE_CHECKLIST.md](PRODUCTION_BACKUP_RESTORE_CHECKLIST.md).

## 17. Build, tests, and dependencies

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS; Vite production build completed; chunk-size warning remains for the main bundle |
| `npm.cmd test -- --run` | PASS; 9 files, 52 tests |
| `npm.cmd audit --audit-level=moderate --json` | PASS; 0 vulnerabilities |
| `git diff --check` | PASS; line-ending warning only |
| Deno tests | NOT RUN — Deno unavailable |
| Supabase CLI project/migration commands | BLOCKED — network/login-role transport failure after telemetry was disabled |
| Vercel CLI project verification | BLOCKED — CLI unavailable; `npx vercel whoami` timed out |

Dependency remediation updated `react-router-dom`/`react-router` to `7.18.3` and `nanoid` to `3.3.18`; all local frontend checks passed afterward. Node 22.17.1 emitted engine warnings for installed `jsdom`/`undici`; use the package-supported Node version in CI.

## 18. Production smoke tests

**Status: NOT TESTED.**

Only safe HTTP/DNS checks were performed. No signup, OTP, login, logout, reset, Google OAuth, storefront data, Storage, order, booking, review, contact, payment, or Turnstile test used production accounts or data. Execute [PRODUCTION_SMOKE_TEST_PLAN.md](PRODUCTION_SMOKE_TEST_PLAN.md) only after the deployment/configuration gate is closed.

## 19. Load testing

**Status: NOT TESTED.**

No load test was run against production. Use [LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md) against isolated staging only. No 1,000,000-user capacity claim is made.

## 20. Remaining risks and exact release blockers

1. Deploy the current tested repository through the verified Vercel project; confirm the deployed bundle includes Turnstile and current asset hashes.
2. Ensure live CSP is present and live `Access-Control-Allow-Origin: *` is removed or proven to be safe/intentional for the required routes.
3. Verify Vercel production variables and domains, with no server secrets under `VITE_*`.
4. Rotate previously exposed credentials and confirm hosted replacements.
5. Authenticate against the canonical Supabase project and inspect remote migration history, RLS, Storage, function privileges, triggers, indexes, constraints, and secrets.
6. Confirm backup/PITR/retention and complete a staging restore drill before migrations.
7. Verify Resend, Auth/Google, Turnstile, Telegram, cron, and monitoring.
8. Run two-tenant RLS/Storage tests and the full smoke plan.
9. Run progressive load testing in staging only.

## Final decision

**NO-GO.** Critical production controls remain unverified, and live deployment drift is demonstrated by the missing CSP and Turnstile bundle. Re-evaluate only after the current build is deployed through a verified Vercel project and all listed security, tenant, provider, migration, backup, and smoke-test evidence passes.
