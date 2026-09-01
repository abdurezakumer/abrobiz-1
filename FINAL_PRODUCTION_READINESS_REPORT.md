# AbroBiz final production security, scalability, and go/no-go audit

**PHASE 13 STATUS: COMPLETE**  
**FINAL DECISION: NO-GO pending critical production verification and remediation**  
Audit date: 2026-09-01  
Production URL supplied for the audit: `https://abrobiz.com`  
Canonical Supabase project supplied by repository configuration: `qgbvuvxxfogcsvqzncdx`

## Executive decision

The repository shows substantial security hardening across authentication, RLS, tenant ownership, public forms, storage, idempotency, Turnstile, and bounded external requests. The release cannot be cleared as production-ready because the local environment identity conflicts with the canonical project, a template file contains non-placeholder credentials, live Supabase/Vercel/provider state was not verified, migration state is unknown, and Deno Edge Function compilation was unavailable. These are release gates, not cosmetic findings.

## Evidence and limitations

- Repository and migration review completed without changing application code, schema, DNS, deployment, or production data.
- `.env` was inspected only for variable names/host identity; secret values are intentionally omitted from this report.
- `supabase/config.toml` points to the canonical project. Local `.env` points to the old project. Vercel environment values were not queried.
- `npm audit --audit-level=moderate --json` completed with zero reported vulnerabilities.
- TypeScript typecheck passed.
- Vite build and Vitest were blocked before normal execution by Windows `esbuild` `spawn EPERM`; test discovery did not complete.
- Deno and `psql` were unavailable; Edge Function checks and live RLS/database introspection were not run.
- No live DNS, TLS, browser, email, Google, Turnstile, Storage, Vercel, or Supabase dashboard verification was performed.

## 1. Project identity and environment matrix

| Variable/configuration | Expected production role | Evidence/status |
|---|---|---|
| `VITE_SUPABASE_URL` | Canonical Supabase API project | FAIL locally: old project host is present in `.env`; Vercel unknown |
| `VITE_SUPABASE_AUTH_URL` | Optional branded Supabase Auth hostname | Configured as an option in source; live custom domain unknown |
| `VITE_SUPABASE_ANON_KEY` | Public browser key only | Present in env files; production project alignment unknown |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge/server only | Source uses it server-side; exposure audit found non-placeholder values in `.env.example`, CRITICAL |
| `VITE_SITE_URL` / `SITE_URL` | Canonical HTTPS AbroBiz URL | Expected `https://abrobiz.com`; live Vercel value unknown |
| `VITE_PLATFORM_DOMAIN` | `abrobiz.com` tenant suffix | Source default and example agree |
| `CORS_ALLOWED_ORIGINS` | Name requested in audit brief | NOT USED by current code; configuration mismatch |
| `CORS_ORIGINS` / `CORS_ORIGIN` | Names actually read by Edge CORS helper | Present in source; deployment value unknown |
| `RESEND_API_KEY`, `EMAIL_DOMAIN`, `EMAIL_FROM` | Branded email delivery | Source supports Resend; provider/domain verification and secret rotation unknown |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENFORCE`, allowlist | Abuse protection | Source supports it; example is fail-open and live enforcement unknown |
| `TELEGRAM_BOT_TOKEN`, webhook secret, `CRON_SECRET` | Optional integrations/jobs | Server-only usage found; live configuration unknown |
| Cloudflare variables | DNS automation support | Source helper exists; no live API/DNS state verified |

Never put server variables under `VITE_*`. The example file must contain placeholders only; rotate any real values found there before release.

## 2. Architecture inventory

1. Frontend: React 19, TypeScript, Vite 6, React Router 6, Framer Motion, Supabase JS.
2. Build: `tsc --noEmit && vite build`; tests use Vitest/jsdom; no lint script.
3. Hosting: Vercel SPA rewrite, immutable asset caching, security headers in `vercel.json`.
4. Backend: Supabase Postgres, Auth, Storage, and Deno Edge Functions.
5. Authentication: custom signup/login Edge Functions, Supabase session persistence, email/OTP verification, password reset, and Supabase Google OAuth.
6. Database: 30 ordered migrations covering profiles, businesses, catalog, billing, forms, orders, reviews, templates, Telegram, security, and scale indexes.
7. RLS: base and feature tables are enabled/policy-hardened in migrations; runtime state is unverified.
8. Functions/API: health, auth, forms, orders/payments, storage, announcements, templates, email, Telegram, cron, and page-view endpoints.
9. Storage: public logo/cover/catalog-style assets and private payment proofs; function-side magic-byte and size checks.
10. Admin: guarded React routes, role checks, admin payment actions, announcements, business blocking, Telegram settings.
11. Roles: owner and admin are enforced in client guards, Edge Functions, RPCs, triggers, and RLS; runtime cross-tenant tests remain required.
12. Routing: public root/tenant and `/r/:slug` routes, auth/setup, owner dashboard, admin routes, and SPA fallback.
13. API calls: Supabase REST/RPC and Edge Function invocation; reads have bounded retry, mutations do not retry automatically.
14. Database queries: tenant-scoped owner reads, public published reads, bounded admin/payment lists, server-side order/payment RPCs.
15. Caching: in-memory five-minute template/category cache and 30-second storefront refresh; immutable Vercel assets; no proven shared public data cache.
16. Error handling: generic user errors, ErrorBoundary, bounded external response parsing, structured safe server logs.
17. Logging: `logEvent`/`logFailure` abstractions exist; centralized sink, alerting, retention, and correlation are not evidenced.
18. Security controls: CSP/HSTS/frame/MIME/referrer/permissions headers, RLS, rate limits, idempotency, safe URLs, file validation, Turnstile, and secret separation intent.
19. Rate limiting: DB-backed service-role consume RPC plus form triggers and Edge request limits; capacity under global spikes is unverified.
20. Validation: password policy, UUID/slug/URL/length checks, action/hostname Turnstile checks, magic-byte file validation, server-side repricing.
21. Tests: frontend unit tests and Deno/static test files exist; typecheck and audit passed; Vitest/Deno execution blocked/not available.
22. Performance: lazy routes, bounded lists, retries only for idempotent reads, in-memory public config cache, immutable assets, and polling pause on hidden tabs.

## A. Critical issues

See full register in `FINAL_SECURITY_RISK_REGISTER.md`.

- **R-01 — credential exposure:** `.env.example` contains values that are not placeholders. Treat server/provider values as exposed; rotate and redact before any release.
- **R-02 — project identity split:** local `.env` uses the old Supabase project while `supabase/config.toml` uses the canonical project. This can send users and data to the wrong backend.
- **R-03 — production evidence gap:** no proof exists here that the deployed site, Vercel variables, Auth, database, functions, and providers are one consistent production system.

## B. High issues

- Duplicate import in `telegram-webhook` may block Deno compilation.
- Turnstile example enforcement is false; production fail-open is possible if copied incorrectly.
- `CORS_ALLOWED_ORIGINS` requested by the operational brief does not match the source’s `CORS_ORIGINS`/`CORS_ORIGIN` contract.
- Migrations 0024, 0025, 0028, and 0029 require manual preflight, backup, and staged verification.
- Google redirect, custom Auth hostname, branded email sender, and provider delivery are dashboard configuration, not source guarantees.
- RLS and storage policy runtime state are unknown until queried on the canonical project.

## C. Medium issues

- Fixed admin/payment limits do not provide scalable history pagination.
- Thirty-second storefront refresh plus several reads can amplify hot-tenant traffic.
- Database rate-limit counters may become a write hotspot.
- CSP allows broad HTTPS media/image sources and inline styles.
- HTML caching and SPA fallback need live header/error verification.
- Public operations use business IDs in addition to frontend hostname logic; keep server-side tenant checks authoritative.
- External provider quotas, latency, and failure behavior need dashboards and budgets.
- Observability has safe logging primitives but no proven sink/alerts/correlation.

## D. Low issues

- Tracked `.env.test` leaks a test project identifier/public key and should remain non-production.
- No `public/robots.txt`, sitemap, Open Graph metadata, or dedicated custom 404 asset was found.
- No lint script or dependency update policy is defined; use locked CI installs and scheduled audits.

## E. Performance bottlenecks

- Repeated public Supabase calls during storefront refresh.
- Admin and payment list queries with high fixed limits.
- Public image/storage delivery without proven CDN transformation/cache policy.
- Auth/email/Turnstile/Telegram/GitHub calls on independent provider latency paths.
- Potential DB contention on rate-limit/idempotency/maintenance rows.
- Vite build/test tooling is locally blocked by `esbuild` process permissions; CI must prove reproducible builds.

## F. Scalability bottlenecks

For one million users, the critical unknowns are database connection/CPU ceilings, RLS query plans, index selectivity, hot tenant traffic, auth/provider quotas, Storage egress, and maintenance retention. The fixed list limits and lack of proven public cache should be addressed before a large marketing launch. Use `LOAD_TEST_PLAN.md` and require zero authorization failures under concurrency.

## G. Authentication weaknesses and controls

The code has custom bounded auth endpoints, password policy, generic credential/reset responses, OTP replay/expiry handling, session persistence, legal acceptance, and Google OAuth redirect construction. Remaining weaknesses are operational: project split, unverified Auth settings, unknown email delivery, unknown redirect allowlist, unavailable Deno tests, and no independent live email/OAuth proof. Email enumeration and abuse tests are mandatory in the smoke plan.

## H. Database/RLS weaknesses

Static migrations show broad RLS coverage and tenant-preserving policies. The audit cannot prove the remote database has all migrations, no old permissive policies, validated constraints, correct indexes, or correct function privileges. Migration 0024 can fail on duplicate data; 0028 constraints are `NOT VALID`; 0025 intentionally invalidates legacy reset tokens. Query-plan, policy, and cross-tenant tests are release gates.

## I. API/Edge Function weaknesses

Endpoints have bounded bodies, generic errors, rate limiting, idempotency for sensitive mutations, safe external fetch helpers, file validation, and manual role checks. Deno was unavailable and the Telegram duplicate import is a compile risk. Live CORS, JWT gateway settings, timeout behavior, dependency quotas, request metrics, and function deployment state remain unverified. GitHub template import should remain metadata-only and must never execute repository code.

## J. Infrastructure weaknesses

Vercel headers are strong in source, including CSP, HSTS, frame and MIME protections, but live headers/TLS/wildcard certificates/cache behavior were not tested. HSTS with `includeSubDomains` is safe only when every served subdomain is HTTPS-ready. Cloudflare wildcard DNS and Vercel domain configuration must be verified together. Backup/restore, alerts, provider secrets, and scheduled cron state need operational evidence.

## OWASP/API security assessment

| Area | Static assessment | Required verification |
|---|---|---|
| Broken access control / BOLA | Mitigated in source by owner filters, RLS, RPC checks, and path-scoped storage policies | Cross-tenant live test and policy introspection |
| Authentication/session | Stronger custom flow, generic errors, session auto-refresh, Google OAuth integration | Live redirect, reset, OTP, revocation, enumeration and project-identity tests |
| Injection/SQLi | No raw SQL concatenation in reviewed client paths; Postgres RPCs/migrations are structured | Review all remote functions and run negative input tests |
| XSS/content injection | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` found in app scan | Test stored text, URLs, template metadata, and CSP in browser |
| CSRF | Bearer/session API model reduces classic cookie CSRF exposure; mutation origin/CORS still matters | Verify CORS/origin behavior and browser cross-site requests |
| SSRF | GitHub import is allowlisted/bounded; safe URL helpers exist | Fuzz redirects/URLs and inspect every external fetch allowlist |
| Security misconfiguration | Headers and function configs exist | Verify live headers, secrets, Auth, DNS, CORS, Turnstile, storage, migrations |
| Vulnerable components | npm audit passed with zero reported vulnerabilities | CI lockfile audit and scheduled updates |
| Logging/monitoring | Redacted structured log helpers exist | Prove sink, alerting, retention, and incident response |
| API resource abuse | Limits, rate limits, idempotency, bounded uploads/body parsing | Load/abuse tests at realistic burst volume |
| Excessive data exposure/mass assignment | Explicit client fields and select lists in key paths | Inspect every endpoint response and admin scope |

## K. Recommended implementation phases

1. **Release stop and credential containment:** rotate/redact `.env.example` values; inspect history and hosted environments; align canonical project identity.
2. **Build and function gate:** resolve duplicate import; run typecheck, Vite build, Vitest, Deno checks, and all static security tests in CI.
3. **Remote database gate:** verify migration history, backups, duplicate preflight, RLS/policy/function privileges, `NOT VALID` constraints, indexes, and storage state.
4. **Auth/provider gate:** verify Auth custom domain, Google redirect allowlist, AbroBiz email templates/sender/domain, Turnstile enforcement, CORS contract, and webhook/cron secrets.
5. **Tenant and abuse gate:** run cross-tenant, IDOR/BOLA, enumeration, replay, upload, rate-limit, and concurrent idempotency tests.
6. **Observability/recovery gate:** configure redacted logs, alerts, dashboards, RPO/RTO, backup restore drill, and incident ownership.
7. **Performance gate:** run staged load/soak/spike tests; add pagination/cache/index improvements based on measured results.
8. **Final live smoke and decision:** repeat `PRODUCTION_SMOKE_TEST_PLAN.md`; approve only when all critical/high release gates pass.

## Final go/no-go gate

**NO-GO today.** Change to **CONDITIONAL GO** only after R-01 through R-11 are closed or formally accepted by the production owner with evidence. A full **GO** requires successful live smoke tests, verified migration/RLS/storage state, reproducible build/function checks, and load-test results with capacity headroom.

## Deliverables created

- `PRODUCTION_MIGRATION_CHECKLIST.md`
- `PRODUCTION_SMOKE_TEST_PLAN.md`
- `LOAD_TEST_PLAN.md`
- `FINAL_SECURITY_RISK_REGISTER.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
