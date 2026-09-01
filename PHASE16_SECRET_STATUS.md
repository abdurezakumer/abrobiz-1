# Phase 16 secret status

Audit date: 2026-09-01. Values are intentionally omitted. This report describes only safe status and configuration presence; it does not rotate or validate any secret.

| Secret/configuration | Current local `.env` | Prior tracked exposure | Production status |
|---|---|---|---|
| `RESEND_API_KEY` | MISSING | Previously present in the old `.env.example` | NOT VERIFIED |
| `SUPABASE_SERVICE_ROLE_KEY` | MISSING | Previously present in the old `.env.example` | NOT VERIFIED |
| `TURNSTILE_SECRET_KEY` | MISSING | Previously present in the old `.env.example` | NOT VERIFIED |
| `CLOUDFLARE_API_TOKEN` | MISSING | Not confirmed in current tracked files | NOT VERIFIED |
| `TELEGRAM_BOT_TOKEN` | MISSING | Not confirmed in current tracked files | NOT VERIFIED |
| `TELEGRAM_WEBHOOK_SECRET` | MISSING | Not confirmed in current tracked files | NOT VERIFIED |
| `CRON_SECRET` | MISSING | Not confirmed in current tracked files | NOT VERIFIED |
| SMTP credentials | PRESENT locally | Current `.env.example` is placeholder-only | NOT VERIFIED |
| Gmail/app password | MISSING | Current `.env.example` is placeholder-only | NOT VERIFIED |

## Required action

Treat previously exposed Resend, Supabase service-role, and Turnstile values as compromised. Review Git history and all hosted settings, rotate applicable credentials manually, then verify only `configured`, `missing`, `invalid`, or `not verified`. Do not print old or new values.

The current `.env.example` contains explicit placeholders only. The local `.env` remains ignored and was not copied into any tracked file.
