# Phase 16 — Production blocker closure report

**PHASE 16 STATUS: PARTIAL**  
**FINAL DECISION: NO-GO**  
Audit date: 2026-09-01  
Production domain: `https://abrobiz.com`  
Canonical Supabase project: `qgbvuvxxfogcsvqzncdx`

## Executive summary

Local project identity, environment-template safety, CORS naming, tenant-origin validation, and the Telegram duplicate import are closed at repository level. Read-only DNS checks confirm apex, www, and wildcard tenant resolution through Vercel. Production remains NO-GO because credentials have not been manually rotated/verified, remote Supabase state and backups are unavailable, hosted Vercel/provider settings are not accessible, HTTPS application checks are blocked by the local proxy, and Deno/Vite/Vitest execution is unavailable or blocked.

No production deployment, migration, DNS mutation, secret rotation, database reset, data deletion, or production load test was performed.

## 1. Secret status — NOT VERIFIED

The previous `.env.example` exposure was remediated locally, but the former Resend, Supabase service-role, and Turnstile values must still be treated as compromised and rotated manually. Hosted secret stores were not accessed. See [PHASE16_SECRET_STATUS.md](PHASE16_SECRET_STATUS.md).

## 2. Supabase status — BLOCKED

Static local configuration points to the canonical project. Supabase CLI telemetry was successfully disabled for the process, but `supabase projects list` failed with a network transport error and `supabase migration list --linked` failed while initializing the login role. CLI authentication, linked project, remote migration history, and project status are not verified.

The non-canonical project reference in the Phase 16 brief was not used for any command.

## 3. Migration status — MANUAL

All 30 migration files were inspected and remain unapplied. The migration checklist documents ordering, dependencies, destructive operations, RLS, `SECURITY DEFINER`, grants, indexes, constraints, triggers, and Storage policy checks. Migration 0025 contains the intentional destructive reset-token transition; 0028/0030 contain bounded cleanup functions. No unexpected destructive operation was removed or silently changed.

Do not apply pending migrations until canonical project, migration history, backup/PITR, duplicate preflight, and rollback ownership are confirmed.

## 4. Backup/PITR status — NOT TESTED

Supabase dashboard/tooling was not accessible. Backup schedule, PITR, retention, restore capability, and last backup are not verified. No production restore test was attempted. The safe staging restore procedure is documented in [PRODUCTION_BACKUP_RESTORE_CHECKLIST.md](PRODUCTION_BACKUP_RESTORE_CHECKLIST.md).

## 5. Vercel status — MANUAL

Local Vite configuration expects the canonical public Supabase URL and AbroBiz site/domain settings. Vercel dashboard/project environment variables and domain attachments were not accessed. No claim is made about production variables, wildcard domain attachment, TLS, or deployment state.

## 6. DNS status — PASS partial

Read-only resolver evidence:

- `abrobiz.com` resolved to two apex IP addresses.
- `www.abrobiz.com` resolved to the Vercel DNS CNAME target.
- `business.abrobiz.com` resolved to the same Vercel target.
- `unknown-test-tenant.abrobiz.com` resolved to the same Vercel target.
- Authoritative nameservers observed: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

No per-tenant DNS records were created. This confirms resolver behavior only; TLS, Vercel domain ownership, and application routing remain unverified.

## 7. Wildcard status — PASS partial

Two tenant-like hostnames, including a random test hostname, resolve through the same Vercel target. Tenant-to-business resolution and RLS isolation were not tested because HTTPS/application access was unavailable.

## 8. Auth status — NOT TESTED

Production email signup, OTP, password policy, password reset, email verification, Terms/Privacy acceptance, session behavior, and redirect URLs were not live-tested. Local source and guards were reviewed in prior phases.

## 9. Google OAuth status — MANUAL

The local non-secret callback points to the canonical Supabase Auth endpoint. Supabase Auth provider enablement, Google Cloud redirect allowlist, production Site URL, and any branded `auth.abrobiz.com` domain were not verified. The custom Auth hostname must not be used unless its activation is confirmed.

## 10. Resend status — MANUAL

`abrobiz.com`, the AbroBiz sender, DNS authentication, API key, delivery, OTP, resend, reset, expiration, replay prevention, and log redaction were not verified through Resend or a disposable mailbox.

## 11. Turnstile status — MANUAL

The code-level verifier and tests exist, but production Vercel site key, Supabase secret, `TURNSTILE_ENFORCE=true`, actions, hostnames, and valid/invalid/expired/wrong-host/wrong-action outcomes were not verified. Local server Turnstile values are missing, which is expected for this workspace but not sufficient for production.

## 12. Cloudflare status — MANUAL

Cloudflare dashboard/WAF/rate-limit/TLS/Turnstile state was not accessed. Current authoritative DNS evidence points to Vercel nameservers, so Cloudflare WAF protection of the application traffic must not be claimed. The recommended current architecture is Vercel DNS plus Cloudflare services only where explicitly configured, unless the owner later approves a controlled nameserver migration.

## 13. Telegram status — MANUAL

The duplicate import was removed locally and security controls remain in source. Bot token, webhook secret, endpoint, controlled update, sender validation, replay rejection, rate limiting, and upload validation were not live-tested.

## 14. Cron status — MANUAL

`CRON_SECRET` is absent from local `.env`; production secret and scheduler configuration were not accessed. Missing, wrong, and valid secret behavior and bounded processing require a controlled staging test.

## 15. RLS status — NOT TESTED

Static policy and migration review shows broad tenant/RLS hardening. No remote policy introspection or two-owner cross-tenant runtime test was executed across profiles, businesses, products, orders, bookings, reviews, messages, payments, subscriptions, analytics, and Storage.

## 16. Storage status — NOT TESTED

Static function and policy checks cover JPEG/PNG/WebP/PDF magic bytes, size limits, UUID paths, private payment proofs, ownership, and short-lived signed URLs. No staging upload, traversal, renamed-executable, oversized-file, cross-tenant, or expiration test was executed.

## 17. Security headers — NOT TESTED

`vercel.json` defines HSTS, CSP, MIME, referrer, permissions, and clickjacking protections and includes Turnstile sources. Live response headers could not be checked because the local HTTPS requests failed through the configured proxy.

## 18. Build/test environment — PARTIAL

- `npm.cmd run typecheck`: PASS.
- `npm.cmd audit --audit-level=moderate --json`: PASS; 0 vulnerabilities.
- `git diff --check`: PASS; line-ending warning only.
- `npm.cmd test -- --run`: BLOCKED — Windows `esbuild spawn EPERM` before discovery.
- `npm.cmd run build`: BLOCKED — Windows `esbuild spawn EPERM` during Vite config loading; TypeScript stage passed.
- Deno: NOT RUN — unavailable.
- Supabase CLI version: available when telemetry is disabled; network/auth operations BLOCKED.

Security was not weakened to bypass build failures.

## 19. Smoke tests — NOT TESTED

The production smoke plan was not executed. HTTPS HEAD requests for apex, www, sample tenant, and random tenant could not connect through the local proxy. Signup, OTP, login, reset, OAuth, storefront, Storage, booking, review, order, payment, contact, and Turnstile remain unverified.

## 20. Load tests — NOT TESTED

No load test was run against production. Staged 10/100/1,000/10,000/100,000-user load testing remains required in an isolated environment using [LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md). No million-user capacity claim is made.

## 21. Remaining risks

- Credential rotation and hosted secret verification.
- Remote Supabase migration, RLS, Storage, privileges, index, and backup evidence.
- Vercel environment/domain/TLS verification.
- Resend, Auth/Google, Turnstile, Telegram, cron, and Cloudflare configuration.
- Live security headers and application smoke tests.
- Deno Edge Function compile/tests and local Vite/Vitest environment.
- Staging recovery, abuse, tenant-isolation, and load evidence.

## Exact next steps

1. Rotate previously exposed credentials without printing them.
2. Verify Vercel variables and domains manually.
3. Use a network-enabled authenticated Supabase CLI/dashboard session to inspect, not reset, the canonical project.
4. Confirm backup/PITR before any migration; preflight and apply only missing migrations manually.
5. Verify RLS/Storage/function privileges with two controlled tenants.
6. Configure and test Resend, Auth/Google, Turnstile, Telegram, cron, and CORS.
7. Run Deno checks and frontend build/tests in a clean supported environment.
8. Execute the production smoke plan, then staging load tests.

**Final decision: NO-GO.** Any unverified critical control remains a release blocker.
