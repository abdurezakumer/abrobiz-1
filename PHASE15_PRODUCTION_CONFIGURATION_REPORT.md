# Phase 15 — Controlled production configuration report

**PHASE 15 STATUS: PARTIAL**  
**FINAL DECISION: NO-GO**  
Audit date: 2026-09-01  
Production target: `https://abrobiz.com`  
Canonical Supabase project: `qgbvuvxxfogcsvqzncdx`

## Executive summary

Local configuration consistency and code-level remediation were verified. The wildcard tenant DNS records resolve to a Vercel DNS target, and no per-tenant DNS records were created. Production cannot be approved because hosted secrets, Supabase authentication, remote migrations/RLS/Storage, backups, TLS/application responses, email delivery, OAuth, Turnstile enforcement, and provider dashboards remain unverified. No deployment, migration, DNS mutation, secret rotation, or production-data change was performed.

## Status matrix

| Component | Status | Evidence / limitation |
|---|---|---|
| Supabase project identity | PASS locally / MANUAL hosted | `supabase/config.toml`, `.env.example`, and local non-secret URLs use the canonical project; Vercel/runtime identity not queried |
| Migrations | MANUAL | All 30 migration files inspected; none applied; remote history unknown |
| RLS | NOT TESTED | Static policies reviewed; no canonical-project SQL introspection or cross-tenant runtime test |
| Storage | NOT TESTED | Static path/magic-byte controls reviewed; buckets, objects, and policies not queried remotely |
| Auth | NOT TESTED | Local source reviewed; production Auth settings and live flows unavailable |
| OTP | NOT TESTED | Delivery, expiry, replay, and branded sender not live-tested |
| Password reset | NOT TESTED | Provider delivery and canonical function state not live-tested |
| Google OAuth | MANUAL | Local callback uses canonical Supabase Auth endpoint; provider allowlist and production callback not verified |
| Resend | MANUAL | No hosted provider access; domain, sender, DNS authentication, and delivery not verified |
| Turnstile | MANUAL | Local server/site secrets are absent; hosted site/secret, enforcement, actions, and hostnames not verified |
| Cloudflare | MANUAL | Cloudflare dashboard not accessed; authoritative DNS observed as Vercel nameservers |
| DNS | PASS partial | Apex resolves via `nslookup`; `www`, sample tenant, and random tenant resolve to the Vercel DNS target; TLS/application still unverified |
| Vercel | MANUAL | Domain/variables/deployment configuration not queried |
| Edge Functions | BLOCKED | Supabase CLI local commands failed on `EPERM` writing telemetry; Deno unavailable for compile/tests |
| Telegram | MANUAL | Duplicate import fixed locally; token, webhook, controlled update, and replay behavior not live-tested |
| CORS | PASS static / NOT TESTED live | Active utility uses `CORS_ALLOWED_ORIGINS`, strict HTTPS tenant rule, no wildcard; hosted value unknown |
| Security headers | NOT TESTED | `vercel.json` defines headers; HTTPS requests were blocked by local proxy |
| Monitoring | MANUAL | Logging helpers exist; live sinks, alerts, retention, and dashboards not verified |
| Backups | NOT VERIFIED | No dashboard/tool evidence for backup, PITR, retention, or restore drill |
| Load testing | NOT TESTED | No production load test performed; staging plan exists |

## 1. Supabase identity and CLI

Static identity is consistent in the active local configuration. The old project reference was removed from active local URL settings; remaining occurrences are historical migration/audit documentation or a static test asserting that the old value must not return.

The Supabase CLI executable is present, but `supabase status --output json` and `supabase projects list` could not complete because the local environment denied the CLI’s attempt to write its telemetry file (`EPERM`). CLI authentication and linked-project state are therefore **BLOCKED**, not assumed.

The Phase 15 brief contains a second, non-canonical project reference in its migration section. No command used that reference. No migration command was run.

## 2. DNS and Vercel observations

Read-only DNS results from this environment:

- `abrobiz.com` resolved through `nslookup` to two apex IP addresses.
- `www.abrobiz.com` resolved as a CNAME to a Vercel DNS hostname.
- `business.abrobiz.com` resolved as a CNAME to the same Vercel DNS hostname.
- `unknown-test-tenant.abrobiz.com` resolved as a CNAME to the same Vercel DNS hostname.
- Authoritative nameservers returned by DNS were `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

This confirms DNS wildcard-style resolution through Vercel from the current resolver. It does not confirm Vercel domain attachment, wildcard TLS coverage, Cloudflare proxy/WAF state, or tenant application routing. No DNS record was created or modified.

HTTPS HEAD requests to the apex, www, sample tenant, and random tenant could not connect because the local environment attempted to use an unavailable proxy at `127.0.0.1`. Status codes, certificates, headers, and application behavior are **NOT TESTED**.

## 3. Environment and secrets

The current `.env.example` contains placeholders only and separates public, server-only, and configuration variables. Server-only values are not present in the local `.env` used for this audit; hosted Supabase/Vercel secret stores were not accessed.

Previously exposed credential-like values remain a manual incident/rotation matter. Rotate Resend, Supabase service-role, Turnstile, Cloudflare, Telegram, webhook, cron, and any exposed SMTP/Gmail credentials. Only status (`configured`, `missing`, `invalid`, or `not verified`) should be recorded after rotation.

See [SECRET_ROTATION_CHECKLIST.md](SECRET_ROTATION_CHECKLIST.md).

## 4. Migration and backup readiness

The ordered migration inventory and safety notes are documented in [PRODUCTION_MIGRATION_CHECKLIST.md](PRODUCTION_MIGRATION_CHECKLIST.md). Static review found no RLS-disable, `DROP TABLE`, or `TRUNCATE` statement. Migration 0025 intentionally invalidates legacy reset tokens and drops the legacy token column; this remains a destructive transition requiring backup and approval. No migration was applied.

Backup, PITR, retention, restore capability, and restore drill are all **NOT VERIFIED**. Use [PRODUCTION_BACKUP_RESTORE_CHECKLIST.md](PRODUCTION_BACKUP_RESTORE_CHECKLIST.md); do not perform a destructive production restore test.

## 5. Tests executed

| Test | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd audit --audit-level=moderate --json` | PASS; 0 reported vulnerabilities |
| `git diff --check` | PASS; line-ending warning only |
| Static credential-format scan on tracked files | PASS; no credential-shaped value reported |
| Canonical project/old-project scan | PASS for active local configuration |
| CORS static test files added | NOT RUN — Deno unavailable |
| `npm.cmd test -- --run` | BLOCKED — Windows `esbuild spawn EPERM` before discovery |
| `npm.cmd run build` | BLOCKED — Windows `esbuild spawn EPERM` during Vite config loading; TypeScript stage passed |
| Supabase CLI status/projects | BLOCKED — local `EPERM` writing CLI telemetry |
| DNS resolution | PASS partial — records resolved as documented above |
| HTTPS/TLS/security headers | NOT TESTED — local proxy connection failure |

## 6. What was configured

- Local non-secret Supabase URL and OAuth callback aligned to the canonical project.
- `.env.example` redacted and organized; `.env.*` protection retained.
- Active CORS variable standardized to `CORS_ALLOWED_ORIGINS`.
- Strict tenant-origin validation retained without wildcard trust.
- Telegram duplicate import removed.
- Local verification tests and operational checklists added.

No hosted production setting was configured by this phase.

## 7. What was verified

- Local code and configuration identity.
- Placeholder-only environment template.
- Active CORS implementation and static origin rules.
- Telegram import count.
- TypeScript compilation.
- Dependency audit.
- DNS resolution for apex, www, sample tenant, and random tenant.
- No per-tenant DNS record creation.

## 8. What failed or was blocked

- Vite/Vitest: local Windows `esbuild spawn EPERM`.
- Deno Edge Function checks: Deno unavailable.
- Supabase CLI status/auth checks: CLI telemetry file write `EPERM`.
- HTTPS requests: local proxy connection failure.
- Remote database/RLS/Storage/migration inspection: no authorized database client/session.

## 9. Exact manual actions required

1. Rotate all credentials identified in `SECRET_ROTATION_CHECKLIST.md` and update only the correct hosted secret stores.
2. Verify Vercel production variables use the canonical project and contain no server secret under `VITE_*`.
3. Verify Vercel domains, wildcard domain, TLS certificate, apex, www, and tenant routing.
4. Decide whether Cloudflare is intended to be authoritative; current DNS evidence shows Vercel nameservers. Do not change nameservers or records without explicit approval and a rollback plan.
5. Authenticate the Supabase CLI in an environment that can write its local state, confirm the linked project, and inspect migration history without applying anything.
6. Confirm backups/PITR/retention and complete a safe staging restore drill.
7. Preflight and manually apply only missing migrations to the canonical project, including 0024/0025/0028/0029 review and constraint validation.
8. Inspect final RLS, function privileges, triggers, indexes, buckets, and Storage policies on the canonical project.
9. Deploy/verify Edge Functions only after Deno checks pass; configure `CORS_ALLOWED_ORIGINS`, Turnstile, email, Telegram, and cron secrets server-side.
10. Verify Resend domain/sender and run signup OTP, resend, and password-reset delivery tests.
11. Verify Auth site/redirect settings and Google OAuth callback using only the canonical production endpoint.
12. Run the full smoke plan with two tenant owners and anonymous users; then run load tests only in staging.

## 10. Final release decision

**NO-GO.** Authentication, RLS, tenant isolation, secrets, migration state, backups, storage, payment integrity, TLS/application responses, and provider configuration remain unverified or manual. Re-evaluate only after the exact actions above produce sanitized evidence.
