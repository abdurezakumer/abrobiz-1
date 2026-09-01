# AbroBiz secret rotation checklist

Audit date: 2026-09-01. This checklist intentionally contains names and status only; it never contains secret values and does not rotate anything automatically.

## Findings

| Credential | Exists in local `.env`? | Exposed in tracked file? | Requires rotation? | Production replacement required? | Status |
|---|---:|---:|---:|---:|---|
| Resend API key | No | Previous `.env.example` contained a non-placeholder value; current example is redacted | Yes, immediately | Yes, store only in Supabase Edge Function secrets | CRITICAL — manual rotation |
| Supabase service-role key | No | Previous `.env.example` contained a non-placeholder value; current example is redacted | Yes, immediately | Yes, canonical project key only; server-side only | CRITICAL — manual rotation |
| Turnstile secret | No | Previous `.env.example` contained a non-placeholder value; current example is redacted | Yes, immediately | Yes, matching production site key/hostnames | CRITICAL — manual rotation |
| Cloudflare API token | No | No non-placeholder value remains in current example | Rotate if it was ever used in the prior file/history or hosted settings | Yes only if DNS/WAF automation is enabled | HIGH — verify history/provider |
| Telegram bot token | No | No non-placeholder value remains in current example | Rotate if previously exposed or shared | Yes if Telegram integration is enabled | HIGH — verify provider |
| Telegram webhook secret | No | No non-placeholder value remains in current example | Rotate if previously exposed or shared | Yes if webhook is enabled | HIGH — manual verification |
| `CRON_SECRET` | No | No non-placeholder value remains in current example | Rotate if previously exposed or shared | Yes for scheduled endpoint | HIGH — manual verification |
| SMTP username/password | Yes, local-only configuration names are present | Current example has placeholders only | Rotate if the local password was ever copied, committed, or shared | Yes only if SMTP fallback is used; prefer Resend | HIGH — manual review |
| Gmail/app password | No | Current example has placeholders only | Rotate if previously exposed or shared | No if Resend is the sole provider | MEDIUM — verify unused |

## Manual rotation order

1. Revoke/rotate any value that appeared in the former tracked example or its Git history. Do not wait for proof of abuse.
2. Rotate the canonical Supabase service-role key and update only Supabase Edge Function secrets.
3. Rotate Resend, Turnstile, Cloudflare, Telegram, cron, and SMTP/Gmail credentials as applicable.
4. Update Vercel only with public variables; update Supabase Edge Function secrets with server-only values.
5. Remove old hosted variables, invalidate sessions if required by the provider, and review provider audit logs.
6. Run the smoke plan and confirm email, OAuth, Turnstile, Telegram, cron, and storage flows.

## Verification rules

- Search tracked history and hosting settings for credential-shaped values without printing matches.
- Never put service-role, provider, SMTP, webhook, or cron values in a `VITE_*` variable.
- Never paste a secret into an issue, audit report, terminal transcript, or test fixture.
- The current `.env.example` is a template only. Local `.env` remains ignored and must not be committed.
