# AbroBiz production smoke-test plan

Audit date: 2026-09-01  
Target: `https://abrobiz.com` and one disposable tenant hostname.  
This document defines tests; no live production tests were run during the repository audit.

## Rules

- Use disposable test accounts, a disposable business slug, and non-production payment proofs.
- Never paste tokens, cookies, API keys, service-role keys, or full provider responses into tickets.
- Run owner, second-owner, admin, anonymous, and cross-tenant test identities separately.
- Stop if a test changes a real subscription, sends an unwanted announcement, or exposes another tenant.

## Preflight

| Check | Expected result | Evidence |
|---|---|---|
| DNS `abrobiz.com`, `www`, and wildcard | Correct Vercel target, no conflicting record, valid HTTPS certificate | Sanitized DNS/TLS output |
| Vercel environment | Production variables use canonical Supabase project and server-only values are not `VITE_*` | Variable names and masked host only |
| Supabase Auth URL | AbroBiz custom Auth/API hostname is active, or canonical project URL is intentionally used | Dashboard screenshot with values masked |
| Email provider | Domain authenticated, sender verified, bounce handling active | Provider status, no key values |
| Turnstile | Production site/secret pair and hostnames match; enforcement is enabled | Masked dashboard settings |
| Migration history | Expected migrations present, no pending required migration | Migration list |

## Functional and security tests

| ID | Test | Expected result |
|---|---|---|
| S-01 | Visit root and `www` | AbroBiz landing page, HTTPS, no project ID in visible UI or error text |
| S-02 | Visit a published tenant at `https://<slug>.abrobiz.com` | Only that published tenant is rendered; refresh and deep links work |
| S-03 | Visit blocked/unpublished tenant | Not publicly visible; no private fields returned |
| S-04 | Register with valid data and Turnstile | Account is created once, branded verification email arrives, no duplicate business is created |
| S-05 | Register with invalid/expired/replayed Turnstile token | Generic rejection; no account created; no provider secret/token in response |
| S-06 | Verify email/OTP | Correct code succeeds once; wrong, expired, and replayed codes fail generically |
| S-07 | Repeat signup with an existing email | Generic response; timing and text do not disclose account existence |
| S-08 | Password reset request for existing and unknown email | Same generic response; only the intended mailbox receives a message |
| S-09 | Reset with valid, expired, replayed, and malformed token | Valid token works once; all others fail safely; old custom token flow is not active |
| S-10 | Google sign-in | Redirect URI is an allowed AbroBiz URI; callback returns to AbroBiz setup; no Supabase project hostname is shown to users |
| S-11 | Owner A opens owner B dashboard URL/ID | 403/empty/not found; no B data, signed URL, or mutation is possible |
| S-12 | Anonymous public form submissions | Only published tenant, bounded fields, valid UUID, enabled feature, and Turnstile/rate limits are accepted |
| S-13 | Cross-tenant form ID substitution | Rejected by endpoint and RLS; no message/booking/review/order is written to another tenant |
| S-14 | Order replay with same Idempotency-Key | One order only; server-side price and item state are authoritative |
| S-15 | Payment proof upload | Only accepted magic bytes/types and size; object path is owner-scoped; bucket remains private |
| S-16 | Payment proof path substitution | Signed URL and submission are rejected unless exact owner/payment/business conditions hold |
| S-17 | Admin payment approval/rejection | Admin succeeds; owner/non-admin fails; state transition is one-way and logged |
| S-18 | Admin announcement | Only admin can send; recipient scope is correct; bounded content; provider failure is not exposed |
| S-19 | GitHub template import | Only allowed GitHub HTTPS URLs; bounded response/timeout; no arbitrary code execution or server-side URL fetching |
| S-20 | Telegram webhook | Secret verification, replay protection, rate limit, file validation, and generic responses all work |
| S-21 | Logout/session expiry | Session is revoked/expired; protected routes redirect; cached private data is not retained in a new account |
| S-22 | Host header and open redirect probes | Unknown host, nested subdomain, HTTP tenant, encoded host, and external redirect inputs are rejected |
| S-23 | Headers | CSP, HSTS, frame, MIME, referrer, and permissions headers are present and compatible with Google/Turnstile |
| S-24 | Error paths | 404/deep-link and runtime failure show safe AbroBiz UI without stack traces or project identifiers |
| S-25 | Refresh/poll behavior | Storefront refreshes within the documented interval, pauses while hidden, and does not duplicate requests excessively |

## Pass criteria

All security tests S-05, S-07, S-08, S-09, S-11, S-13, S-15, S-16, S-17, S-20, and S-22 must pass. Any failure is a release stop. Record timestamps, test identity class, endpoint, status class, and sanitized correlation/reference ID only.

## Current audit result

NOT RUN. Live DNS, Vercel environment values, Supabase dashboard settings, RLS runtime behavior, provider delivery, and production browser behavior were not independently verified in this phase.
