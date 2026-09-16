# AbroBiz Security Remediation & Production Safety Report

Date: 2026-09-16
Scope: repository, local build/test configuration, Supabase migration state, and read-only production checks for `https://abrobiz.com`
Status: **NOT READY FOR PRODUCTION PROMOTION**

This report records the remediation work completed locally and the controls that still require an authorized production operator. No production database, deployment, secret, or Git history was changed by this work. No secret values are printed here.

## Executive summary

The application has a substantially stronger local security baseline:

- tracked credential-like documentation values were replaced with placeholders;
- signup responses no longer disclose user identifiers or OTP metadata;
- Google Identity Services now uses a per-request nonce;
- stale auth-context updates are generation-guarded;
- privileged browser routes and database permission helpers require Supabase MFA assurance level `aal2`;
- storage upload and signed-URL paths use business ownership or explicit permissions;
- private payment-proof browser persistence was removed;
- broad client writes to notifications, commission, attribution, and reminder event tables are revoked in the pending migration;
- production CORS and trusted-client-IP configuration are separated from development settings;
- a tracked-file secret scan, security workflow, security headers, metadata, robots, sitemap, and bundle chunking were added;
- all local tests, type checking, build, and dependency audit pass.

Production remains blocked until the migration and application changes are deployed and the manual verification items below are completed. The migration is intentionally not applied because the request forbids deployment and production writes.

## A. Critical issues

| Location | Problem | Impact | Remediation/status | Priority |
|---|---|---|---|---|
| `SETUP.md`, `vercel-1.md`, Git history | Historical documentation contained credential-shaped values. Current files now contain placeholders, but old Git objects may still contain the former values. | Anyone with repository/history access may use those credentials; documentation secrets can also be copied into deployment settings. | Current tracked files cleaned. Rotate the affected provider credentials and remove or quarantine sensitive history through an authorized repository-maintenance process. Do not rely on history rewriting as a substitute for rotation. | **CRITICAL / BLOCKER until rotation** |
| `supabase/migrations/0050_full_security_remediation.sql` | The final authorization, profile, storage, notification, and integrity controls are local only. Remote migration state reports `0050` unapplied. | Production continues to use the prior active policies/functions. The source fix does not protect the live database until applied. | Apply after review with `supabase db push --linked --skip-vault`, then run authenticated RLS/storage regression tests. | **CRITICAL / BLOCKER** |
| Vercel deployment and Supabase Edge Functions | Local frontend/function changes are not deployed. | Nonce binding, signup response minimization, CORS/rate-limit changes, storage authorization, MFA guards, headers, robots, and sitemap are not live. | Deploy only after the migration and manual checks pass; then verify the exact production commit. | **CRITICAL / BLOCKER** |

## B. High issues

| Location | Problem | Impact | Recommended fix/status | Priority |
|---|---|---|---|---|
| `supabase/functions/storage-upload/index.ts:49`, `storage-signed-url/index.ts:40`, migration `0050` | Previous storage access depended on broad admin checks and broad private-object policies. | Cross-tenant upload/download or payment-proof exposure was possible if a caller obtained a valid business/path identifier. | Code now requires owner access or the specific `businesses.manage`, `payments.review`, or `payments.read` permission; migration narrows the private bucket policy. Verify owner/admin/foreign-tenant matrices after applying. | **HIGH / pending production verification** |
| Historical admin policies; final replacements in migration `0050` | Several policies previously used broad `is_admin()` checks. | A role with unrelated administrative duties could access or change data outside its job. | `has_admin_permission()` now has an explicit permission matrix and privileged MFA requirement. Historical migrations remain immutable; the final migration replaces active policies. | **HIGH / pending migration** |
| `public.profiles` policies and `protect_profile_security_fields()` in migration `0050` | Profile identity, role, platform ID, verification, legal, and marketing-policy fields required stronger protection. | Self-service updates could otherwise escalate privileges, alter identity metadata, or bypass legal/security workflows. | Final migration adds scoped reads, self/super-admin updates, and a protected-field trigger. Verify service-role workflows and owner profile editing after migration. | **HIGH / pending migration** |
| `src/lib/supabaseClient.ts:38` | Supabase auth still persists bearer tokens in browser storage. The key is branded as `abrobiz-auth-token`, but it is not HttpOnly. | An XSS compromise could read/abuse the session. Client storage cannot be made equivalent to an HttpOnly server session in this SPA architecture. | Keep the XSS controls, short-lived/auto-refreshed sessions, inactivity timeout, MFA, and server authorization. Consider a BFF/HttpOnly-cookie architecture for a future high-assurance migration. | **HIGH / residual** |
| `src/components/Guards.tsx`, `src/pages/MfaSetup.tsx`, migration `0050` | Privileged access now requires MFA `aal2`, but existing production admins must enroll and runtime enforcement is not yet verified. | Applying the migration before enrollment can lock existing admins out; failing to verify AAL2 leaves a false sense of security. | Enroll every admin/super-admin, test AAL1 denial and AAL2 success, and document account recovery before enabling in production. | **HIGH / operational blocker** |
| `supabase/functions/_shared/rateLimit.ts:17` | Rate limiting must identify the real client IP. Arbitrary `X-Forwarded-For` is no longer trusted, but the configured ingress header is an operational dependency. | Misconfiguration can collapse users into one bucket or allow abuse through spoofed headers. | Configure `TRUSTED_CLIENT_IP_HEADER` only for an ingress that overwrites the value, currently intended as Cloudflare `cf-connecting-ip`; test direct and proxied requests. | **HIGH / manual verification** |

## C. Medium issues

| Location | Problem | Impact | Remediation/status | Priority |
|---|---|---|---|---|
| `src/lib/authActions.ts:39`, `src/components/GoogleSignInButton.tsx`, `src/vite-env.d.ts` | Google GIS credential exchange previously lacked nonce binding. | Token replay/substitution risk was higher than necessary. | A cryptographically random per-render nonce is generated and passed through GIS and `signInWithIdToken`. Test with the production OAuth client and callback configuration. | **MEDIUM / local fixed** |
| `supabase/functions/signup/index.ts`, `src/pages/Register.tsx` | Signup previously returned user/OTP metadata. | Account enumeration and unnecessary identity disclosure. | Signup now returns only a generic success/session shape and routes to verification without exposing user records or OTP length. | **MEDIUM / local fixed** |
| `supabase/functions/_shared/cors.ts`, `.env.example` | Development origins were mixed into the production CORS example. | A production misconfiguration could permit local-origin requests. | Production origins are separate from `CORS_ALLOWED_DEV_ORIGINS`, and development origins are ignored when `APP_ENV=production`. | **MEDIUM / local fixed; deploy/config verification pending** |
| `src/lib/authContext.tsx` | Async profile/subscription loads could race across logout/login transitions. | Data from one account could briefly appear in another account's context. | Session generation and mounted checks now gate all async state writes. | **MEDIUM / local fixed** |
| `src/lib/authContext.tsx` | Inactivity timeout is client-side only. | A stolen token may remain usable until its normal expiry or server-side revocation. | Added 30-minute inactivity sign-out for privileged browser sessions. Configure and verify provider session lifetime, refresh-token behavior, and reauthentication for high-risk actions. | **MEDIUM / partial** |
| Signup/OTP Edge Functions and `_shared/rateLimit.ts` | OTP protections exist, but live abuse behavior was not exercised in this audit. | OTP spam, enumeration, or provider-cost abuse could remain possible if deployed configuration differs. | Keep generic responses, per-IP/user limits, expiry/attempt limits, Turnstile policy, and provider logs. Perform a production-like burst test without sending real spam. | **MEDIUM / manual verification** |
| `supabase/functions/_shared/cors.ts` and Edge Function deployments | CORS behavior is source-hardened but not verified against every deployed function and origin. | Incorrect function-level CORS can cause availability issues or unauthorized browser access. | Verify preflight and credentialed requests for platform, tenant, and disallowed origins after deployment. | **MEDIUM / manual verification** |

## D. Low issues

| Location | Problem | Impact | Remediation/status | Priority |
|---|---|---|---|---|
| `vercel.json` | CSP still permits `style-src 'unsafe-inline'` and broad HTTPS image/media sources to support the current UI and external assets. | CSP is weaker than a nonce/hash-based policy and broad sources increase content-injection blast radius. | Added COOP, CORP, and DNS-prefetch headers. Plan a nonce/hash CSP migration after inventorying third-party assets; do not remove required OAuth/Turnstile/Supabase origins without testing. | **LOW / residual** |
| `public/robots.txt`, `public/sitemap.xml` | These files were previously caught by the SPA fallback. | Search crawlers received HTML instead of crawler directives/URLs. | Canonical static files added. They are not live until the next Vercel deployment. | **LOW / pending deployment** |
| `index.html` | Root metadata was minimal. | Weaker link previews and baseline SEO. | Added description, theme color, and Open Graph metadata. Dynamic storefront SEO remains a separate runtime concern. | **LOW / local fixed** |
| Multiple API query files | Some client queries use fixed limits and are not uniformly cursor-paginated. | Large tenants or high traffic can create latency/payload pressure. | Retain bounded limits; introduce indexed cursor pagination and server aggregation for high-volume admin views in a later scalability phase. | **LOW / backlog** |
| `package.json`, `package-lock.json` | Dependency audit must remain part of CI. | A future dependency update can reintroduce known vulnerabilities. | Vitest was updated to `4.1.11`; current full audit reports zero vulnerabilities and CI now runs the secret scan. | **LOW / monitored** |

## E. Performance bottlenecks

- Admin dashboards still make multiple client-side database requests and should be profiled with realistic tenant/admin data before a million-user launch.
- Some list endpoints use fixed row limits rather than cursor pagination. Add indexes and server-side aggregation for customer, payment, commission, activity, booking, order, and notification views.
- Storage images should be resized/optimized at upload or delivery time and served with appropriate cache headers. The security changes do not introduce an image transformation service.
- `vite.config.ts` now isolates Supabase, React, motion, and UI dependencies into cacheable chunks. The final build has no chunk-size warning; this does not replace browser Core Web Vitals measurement.
- Edge Functions still perform auth and database calls per request. Monitor invocation duration, database connection/query latency, and provider quotas.

## F. Scalability bottlenecks

- One-million-user readiness is not proven by local tests. Required load testing is still outstanding.
- Per-request permission checks and service-role lookups in storage functions are safe but add database latency; cache only non-sensitive, tenant-scoped metadata after measuring.
- Rate-limit state must use a shared durable store in a multi-region/high-concurrency design; verify the current implementation's backing store and eviction behavior under load.
- Admin analytics should use pre-aggregated daily/hourly facts or materialized views rather than repeatedly scanning event tables.
- Add and verify indexes for all tenant foreign keys, owner IDs, status/date filters, referral codes, payment state, and activity timestamps using `EXPLAIN (ANALYZE, BUFFERS)` in a staging copy.

## G. Authentication weaknesses

- Browser sessions remain bearer tokens in local storage; this is a documented residual limitation of the SPA architecture.
- MFA enforcement is implemented in source and the pending migration, but no production admin enrollment or AAL1/AAL2 runtime test has been performed.
- Google nonce protection is implemented locally but requires a real production OAuth test after deployment.
- Password reset and verification flows should be checked for generic responses, expiration, one-time use, replay rejection, and rate limiting in the deployed environment.
- Account recovery for MFA-enforced admin accounts must be documented before migration application.

## H. Database/RLS weaknesses

- `0050_full_security_remediation.sql` is not applied remotely; this is the principal production blocker.
- Historical broad policies remain in the repository because applied migrations are immutable. The final migration drops/replaces active policy names and must be applied successfully.
- Permission checks in RLS depend on the caller's JWT `aal` claim. Verify that the Supabase MFA challenge produces a refreshed AAL2 session before testing privileged queries.
- The migration revokes direct browser writes to commission, attribution, and reminder event tables, but every trusted RPC/Edge Function that writes these tables must be integration-tested after application.
- Tenant isolation, foreign-business IDs, private payment proofs, owner/admin scope, and anonymous public storefront access require authenticated staging tests; source inspection alone is not proof.

## I. API/Edge Function weaknesses

- The functions now use generic errors, body limits, magic-byte checks, explicit authorization, and rate limits in the changed paths.
- Deployed function versions, environment variables, CORS settings, rate-limit backing state, and observability configuration were not changed or verified by this task.
- Test cross-tenant IDs, malformed paths, oversized/malformed files, replayed auth tokens, unauthenticated access, and disallowed origins after deployment.
- Confirm that only server-side functions can use service-role credentials and that no `VITE_` variable contains a server secret.

## J. Infrastructure weaknesses

- The current production deployment predates the local header/robots/sitemap changes. Live checks showed homepage security headers from the old deployment, while `/robots.txt` and `/sitemap.xml` returned `text/html` SPA fallback content.
- Vercel headers include a strong baseline (CSP, HSTS, frame denial, nosniff, referrer policy, permissions policy). The newly added COOP/CORP/DNS-prefetch headers are not live yet.
- Production secret rotation, Vercel environment verification, Supabase function secret verification, Cloudflare header overwrite, and Google OAuth allow-list verification remain manual.
- No production deploy, Supabase push, GitHub push, secret rotation, or history rewrite was performed.

## K. Recommended implementation phases

### Phase 0 — Credential containment (before any release)

1. Rotate the categories that appeared in tracked documentation/history: Telegram bot token, Telegram webhook secret, cron secret, Resend API key, and SMTP/Gmail app password. If provider history confirms additional real credentials, rotate those too.
2. Update only the secret stores used by production, never `.env` in Git.
3. Review GitHub secret-scanning alerts and repository access. Do not print or paste replacement values into tickets.

### Phase 1 — Database and authorization cutover

1. Review `0050_full_security_remediation.sql` against the production schema.
2. Apply it once using the Supabase migration workflow.
3. Enroll every privileged account in TOTP MFA and verify recovery.
4. Run tenant/RLS/storage/permission regression tests with owner, anonymous, sales, marketing, operations, finance, support, content, super-admin, and foreign-tenant identities.

### Phase 2 — Application and function deployment

1. Deploy the exact tested frontend and Edge Function source.
2. Set `APP_ENV=production`, exact production CORS origins, and the trusted ingress header only where the proxy overwrites it.
3. Verify Google OAuth client/redirect settings, email providers, Turnstile hostnames, storage buckets, and function secrets.

### Phase 3 — Abuse and payment verification

1. Test OTP, password reset, login, signup, booking, order, review, payment-proof, reminder, referral, and commission flows with bounded test traffic.
2. Verify idempotency and status transitions for payment/referral/commission workflows.
3. Confirm no browser path can mark a payment successful or write commission ledger events directly.

### Phase 4 — Production observability and scale

1. Alert on auth failures, rate-limit spikes, Edge Function 5xx/latency, storage failures, payment state anomalies, and RLS denials.
2. Load test at expected peak concurrency and analyze slow queries/index use.
3. Add cursor pagination and analytics aggregation where measurements require it.
4. Verify Core Web Vitals on mobile and tenant storefronts.

## Verification results

### Passed locally

- `npm.cmd test -- --run`: **13 test files, 138 tests passed**.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run lint`: **0 errors, 9 warnings**. Warnings are existing Fast Refresh and React Hook dependency warnings in `AbroBizLogo.tsx`, `authContext.tsx`, `Billing.tsx`, and admin pages.
- `npm.cmd run build`: **passed** with Vite 6.4.3; no chunk-size warning after manual chunking.
- `npm.cmd audit`: **0 vulnerabilities**.
- `npm.cmd run security:secrets`: **passed for 296 tracked files**; values are never printed by the scanner.
- `git diff --check`: **passed**; Git only reported normal Windows line-ending conversion warnings.
- Static source checks: no production source matches for dangerous HTML/eval sinks in the reviewed paths.

### Read-only remote checks

- `supabase migration list --linked`: remote history is applied through `0049`; `0050_full_security_remediation.sql` is local only.
- `supabase db push --linked --dry-run --skip-vault`: would push only `0050_full_security_remediation.sql`; no database write occurred.
- `https://abrobiz.com/`: live homepage returned HTTP 200 and the existing CSP/HSTS/frame/nosniff/referrer/permissions headers.
- `https://abrobiz.com/robots.txt`: live response was `text/html` SPA fallback, not the new `text/plain` robots file.
- `https://abrobiz.com/sitemap.xml`: live response was `text/html` SPA fallback, not the new XML sitemap.

### Not verified and required before go-live

- Applying and executing migration `0050` on the production schema.
- Supabase RLS/policy behavior with real role identities and AAL1/AAL2 sessions.
- Private payment-proof cross-tenant access and upload authorization.
- Deployed Edge Function code, CORS, rate limits, OTP, reset, payment, referral, and commission workflows.
- Production MFA enrollment/recovery and Google nonce flow.
- Production secret rotation and provider-side secret validity.
- Cloudflare trusted-IP header overwrite and direct-origin bypass behavior.
- Load testing, slow-query analysis, Core Web Vitals, and alert delivery.

## Go/no-go gate

**NO-GO at this time.** The local source changes and tests are ready for controlled release, but the production gate is not satisfied because credentials require rotation, migration `0050` is unapplied, the deployed application is unchanged, and live crawler endpoints still show the old fallback behavior. Re-run the checks in this report after the authorized operator completes the manual phases; only then should the status change to GO.
