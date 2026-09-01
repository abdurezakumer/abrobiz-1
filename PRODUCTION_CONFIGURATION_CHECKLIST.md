# AbroBiz production configuration checklist

Audit date: 2026-09-01. This is a manual configuration checklist. No production settings were changed or verified by this phase.

## Vercel

- [ ] Production project is the intended AbroBiz project and uses the canonical Git branch.
- [ ] `VITE_SUPABASE_URL` points to `https://qgbvuvxxfogcsvqzncdx.supabase.co` or the verified branded equivalent.
- [ ] `VITE_SUPABASE_ANON_KEY` is the canonical public anon/publishable key; no service key is present in `VITE_*`.
- [ ] `VITE_SUPABASE_AUTH_URL`, if used, is a verified AbroBiz custom Auth hostname.
- [ ] `VITE_SITE_URL=https://abrobiz.com` and `VITE_PLATFORM_DOMAIN=abrobiz.com`.
- [ ] `VITE_TURNSTILE_SITE_KEY` matches the production Turnstile widget and allowed hostnames.
- [ ] `abrobiz.com`, `www.abrobiz.com`, and wildcard `*.abrobiz.com` are attached to Vercel with valid TLS.
- [ ] No server-only secret is configured as a Vercel public `VITE_*` variable.
- [ ] SPA deep-link rewrite and live security headers are verified.

## Supabase

- [ ] `supabase/config.toml` and hosted project both identify `qgbvuvxxfogcsvqzncdx`.
- [ ] Migrations are compared with remote history and applied only in order by an authorized operator.
- [ ] 0024 duplicate-owner/slug preflight is clear; 0025 reset-token transition is approved; 0028 `NOT VALID` constraints are validated; 0029 storage paths are audited.
- [ ] All expected Edge Functions are deployed and Deno-checked.
- [ ] Server-only secrets are stored in Supabase Function secrets, not frontend variables.
- [ ] Auth Site URL, redirect allowlist, email templates, custom email/Auth domain, and Google OAuth settings use AbroBiz URLs.
- [ ] RLS, policies, function privileges, triggers, buckets, and Storage policies are introspected on the canonical project.

## Cloudflare

- [ ] `abrobiz.com` is authoritative in the intended Cloudflare zone.
- [ ] Apex, `www`, and wildcard DNS records target the intended Vercel configuration without conflicting records.
- [ ] TLS mode, minimum TLS, certificate coverage, and HTTPS redirect are verified.
- [ ] Turnstile widget, secret, site key, action, and hostname allowlist match production.
- [ ] WAF managed rules and custom rules are enabled in a tested mode.
- [ ] Rate limits protect auth, public forms, password reset, uploads, and webhook endpoints without blocking normal users.
- [ ] Cloudflare API token is least-privilege, scoped to the correct zone, and stored server-side only.

## Resend/email

- [ ] `abrobiz.com` sending domain is verified with SPF, DKIM, and DMARC.
- [ ] Sender identity is `AbroBiz <noreply@abrobiz.com>` or another approved AbroBiz mailbox.
- [ ] `RESEND_API_KEY` is a current server-only key with minimum scope.
- [ ] Verification, password-reset, announcement, and payment notification templates render with AbroBiz branding and safe links.
- [ ] Delivery, bounce, complaint, and suppression monitoring is configured.
- [ ] One disposable signup and reset email are delivered successfully.

## Telegram

- [ ] Bot token is current and stored only in Edge Function secrets.
- [ ] Webhook URL is the intended Supabase function URL and uses the configured secret header.
- [ ] Telegram webhook secret, replay protection, sender checks, rate limit, and file validation pass.
- [ ] Admin/business link ownership and payment notification scopes are tested.
- [ ] Telegram API failures do not expose provider details or block the core payment write unexpectedly.

## Environment ownership

| Location | Public variables | Server-only variables | Status |
|---|---|---|---|
| Vercel browser build | `VITE_SUPABASE_*`, site/domain, Turnstile site key | None | MANUAL — verify |
| Supabase Edge Functions | None | service role, Resend, Turnstile secret, Cloudflare, Telegram, cron, SMTP | MANUAL — verify |
| Local development | Public local values and disposable project | Local secrets in ignored `.env` only | MANUAL — verify |
