# Phase 14 — Critical production blocker remediation report

**PHASE 14 STATUS: PARTIAL**  
Decision: **CONDITIONAL — local remediation is complete, but production configuration and live verification are still required**  
Audit date: 2026-09-01  
Scope: repository remediation only. No deployment, Git push, Supabase reset, production migration, DNS change, production-data change, or automatic secret rotation was performed.

## 1. Executive summary

The repository blockers that could be safely remediated locally have been addressed. The environment template is now placeholder-only, local non-secret Supabase URLs are aligned to the canonical project, `.env.*` is protected while `.env.example` remains tracked, the duplicate Telegram import is removed, and CORS uses one canonical variable with strict tenant-origin validation.

Production is not declared ready. Credential rotation, hosted environment verification, migration application/validation, backup/restore evidence, provider configuration, Deno checks, and live smoke tests require an authorized operator with access to Vercel, Supabase, Cloudflare, Resend, and Telegram.

## 2. Phase 13 blockers

| Blocker | Result |
|---|---|
| Non-placeholder values in `.env.example` | FIXED locally; previous values must still be treated as exposed and rotated manually |
| Local `.env` old Supabase project | FIXED for non-secret URL configuration; no old project reference remains in active local URL configuration |
| Duplicate Telegram import | FIXED; only the combined file-security import remains |
| Unknown migration/backup state | REMAINING; no remote database was queried or changed |
| CORS names inconsistent | FIXED in implementation, current template, and active setup docs using `CORS_ALLOWED_ORIGINS` |
| Live production configuration unknown | REMAINING/MANUAL; no hosted configuration was accessed |

## 3. Remediation performed

- Replaced the previous `.env.example` contents with an explicit placeholder-only environment matrix.
- Added `.env.*` to `.gitignore` and retained `!.env.example`.
- Updated local non-secret Supabase URL/callback configuration to canonical project `qgbvuvxxfogcsvqzncdx`.
- Removed the duplicate `detectAllowedFile` import from `supabase/functions/telegram-webhook/index.ts` without changing webhook security behavior.
- Consolidated Edge Function CORS configuration on `CORS_ALLOWED_ORIGINS`.
- Added exact root/www origins and strict one-label HTTPS `*.abrobiz.com` tenant matching; wildcard `*`, HTTP tenants, nested hosts, malformed origins, and external origins are rejected.
- Updated active deployment/setup documentation to use the canonical CORS variable.
- Added Deno test coverage for CORS cases and Phase 14 static checks for environment, canonical project, Telegram imports, tenant, and Turnstile references.
- Added migration, secret-rotation, backup/restore, production-configuration, and this final remediation report.

## 4. Environment changes

` .env.example` now separates PUBLIC, SERVER-ONLY, and CONFIGURATION values. It contains placeholders such as `YOUR_SUPABASE_SERVICE_ROLE_KEY`, `YOUR_RESEND_API_KEY`, and `YOUR_TURNSTILE_SECRET_KEY`, not usable credentials. No secret value is reproduced in this report.

The local `.env` URL and Google callback now use the canonical Supabase project. Existing local SMTP values were not printed, copied, or rotated. They remain local-only and require manual review if they were ever shared.

## 5. Secret findings

**CRITICAL / MANUAL:** the former `.env.example` contained credential-like values. Treat the former Resend, Supabase service-role, and Turnstile values as exposed and rotate them immediately. Also review the former file and Git history for Cloudflare, Telegram, cron, SMTP, and Gmail credentials. The current example is redacted; no automatic rotation was attempted.

See [SECRET_ROTATION_CHECKLIST.md](SECRET_ROTATION_CHECKLIST.md) for the complete inventory and rotation order.

## 6. Supabase project consistency

Static configuration now agrees on canonical project `qgbvuvxxfogcsvqzncdx` in `supabase/config.toml`, `.env.example`, and local non-secret URL settings. Historical reports and tests may mention the old project as evidence; these are not active runtime configuration. Vercel environment values, Supabase dashboard settings, and remote runtime identity are **NOT VERIFIED**.

## 7. CORS resolution

The authoritative variable is now `CORS_ALLOWED_ORIGINS`. The old `CORS_ORIGINS` and `CORS_ORIGIN` lookups were removed from the active utility. Explicit configured origins are combined with safe defaults; tenant origins are accepted only when they are exact HTTPS origins with one valid DNS label under `abrobiz.com`. No credentials header or wildcard origin was added.

Tests cover root, www, tenant, external, malformed, HTTP, nested, path-bearing, and wildcard inputs. Deno execution is **NOT RUN — Deno unavailable**.

## 8. Telegram fix

Only the duplicate import was removed from `telegram-webhook/index.ts`. Secret-header validation, replay protection, sender/link checks, rate limiting, file validation, and notification behavior were not changed. Deno compilation and the full webhook test suite remain **BLOCKED/NOT RUN — Deno unavailable**.

## 9. Migration audit

All 30 migrations remain present and unapplied by this phase. The migration checklist now includes dependencies, destructive-operation notes, production requirement, and verification method for every migration. Static review found no `DROP TABLE`, `TRUNCATE`, or RLS-disable statement. Migration 0025 intentionally deletes legacy reset tokens and drops the legacy token column; migrations 0028/0030 contain bounded service-only cleanup; historical public grants are superseded by later revokes.

Remote migration history, duplicate owner/slug preflight, `NOT VALID` constraint validation, final RLS/policy state, function privileges, and index health are **MANUAL / NOT VERIFIED**.

See [PRODUCTION_MIGRATION_CHECKLIST.md](PRODUCTION_MIGRATION_CHECKLIST.md).

## 10. Backup/restore status

No backup schedule, retention, PITR, storage backup, restore drill, RPO, or RTO was claimed or verified. All are **NOT VERIFIED**. Use [PRODUCTION_BACKUP_RESTORE_CHECKLIST.md](PRODUCTION_BACKUP_RESTORE_CHECKLIST.md) and perform a staging restore before production migration work.

## 11. Tests and checks

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASSED |
| `npm.cmd audit --audit-level=moderate --json` | PASSED; 0 reported vulnerabilities |
| `git diff --check` | PASSED; line-ending warning only |
| Frontend dangerous-sink scan | PASSED; no app `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, or `postMessage` found |
| `npm.cmd test -- --run` | BLOCKED — local Windows `esbuild spawn EPERM` before test discovery |
| `npm.cmd run build` | BLOCKED — local Windows `esbuild spawn EPERM` during Vite config loading; TypeScript stage passed |
| Deno tests/typecheck | NOT RUN — Deno unavailable |
| `psql`/remote RLS introspection | NOT RUN — `psql` unavailable and no remote query was authorized |
| Live DNS/Vercel/Supabase/Auth/Storage/email/OAuth/Turnstile checks | NOT TESTED |

## 12. Remaining production blockers

- Manual rotation and provider-history review for previously exposed credential-like values.
- Vercel variables must be aligned to the canonical project and server-only values kept out of the browser.
- Supabase migrations, RLS, function privileges, Storage policies, and constraints must be verified on the canonical project.
- Backup/PITR and staging restore evidence must be produced.
- Deno compilation and Edge Function tests must pass in CI or a permitted staging environment.
- Google OAuth, branded Auth/email settings, Resend delivery, Turnstile enforcement, Cloudflare wildcard/TLS/WAF, Telegram webhook, and cron must be verified live.
- Production smoke and load/abuse tests must pass, including cross-tenant and idempotency tests.

## 13. Exact manual actions required

1. Rotate all previously exposed provider/service credentials; update only the appropriate Vercel/Supabase secret stores.
2. Confirm Vercel production uses canonical Supabase URL/key and `https://abrobiz.com` settings.
3. Set `CORS_ALLOWED_ORIGINS` in Edge Function secrets/configuration; do not set the retired names and do not use `*`.
4. Compare and apply missing migrations manually in numeric order after backup and preflight; do not reset the database.
5. Validate RLS, Storage, function privileges, constraints, indexes, and tenant isolation with separate test accounts.
6. Configure/verify Auth, Google callback allowlists, email templates/sender/domain, Resend, Turnstile, Cloudflare, Telegram, and cron.
7. Run Deno checks, resolve any remaining environment-specific compile issue, then run the smoke plan.
8. Complete the staging restore drill and load/abuse plan before approving production.

## 14. Recommended next phase

Phase 15 may begin only as a controlled production-configuration verification phase after credential rotation is complete. It should not deploy or migrate automatically; its first gate should be canonical-project evidence, backup/restore evidence, and passing Deno/build checks.

## Status classification

- **Fixed:** environment template redaction, `.env.*` protection, active local canonical URL, duplicate Telegram import, CORS naming and validation, remediation documentation/tests.
- **Remaining:** credential rotation, hosted configuration, remote migration/RLS/storage state, backups, provider settings, live DNS/TLS, and capacity evidence.
- **Blocked:** local Vitest/Vite by Windows `esbuild spawn EPERM`; Deno checks unavailable.
- **Manual:** secret rotation, Vercel/Supabase/Cloudflare/Resend/Telegram setup, migrations, backup/restore, live smoke and load testing.
- **Not Tested:** production runtime behavior and remote database/provider state.
