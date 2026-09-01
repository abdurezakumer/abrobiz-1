# AbroBiz Phase 5 Edge Function Security Report

Audit scope: every Edge Function under `supabase/functions/`, including authentication, authorization, tenant context, service-role use, request/response handling, abuse controls, external APIs, webhooks, cron execution, logging, and sensitive mutations.

Production target: `https://abrobiz.com`

This phase was performed locally. No production deployment, Supabase migration, secret rotation, database reset, data deletion, or Git push was performed.

## Findings register

### F1 — Authenticated endpoints accepted any non-empty Authorization header

- Severity: MEDIUM (fixed locally)
- Function: `import-template`, `send-announcement`, `send-verification-email`, `notify-payment-submitted`, `storage-upload`, `storage-signed-url`, `submit-payment`
- Attack scenario: A malformed `Basic`, empty-token, or multi-token header is passed to a privileged function and relies on downstream behavior instead of an explicit API contract.
- Current protection: Supabase `auth.getUser()` validates the token server-side, and protected functions have `verify_jwt = true` where configured.
- Change made: Added `isBearerAuthorization()` and required the exact `Authorization: Bearer <single-token>` shape before creating the caller client.
- Verification: Static regression test covers every authenticated function; live malformed-token testing was prepared but not run.
- Remaining risk: A valid stolen bearer token remains a credential and must be protected by the client and Supabase session controls.

### F2 — Verification token RPC errors could reach the client

- Severity: MEDIUM (fixed locally)
- Function: `send-verification-email`
- Attack scenario: A database error message reveals implementation details through the HTTP response.
- Current protection: Other email and auth paths mostly returned generic errors.
- Change made: The endpoint now logs only an error code and returns a generic message.
- Verification: Static test asserts that `tokenError.message` is not returned.
- Remaining risk: Provider/database operational details still exist in server logs and must be access-controlled.

### F3 — Concurrent cron runs could duplicate subscription notifications

- Severity: HIGH (fixed locally)
- Function: `subscription-cron`
- Attack scenario: Two valid cron invocations select the same subscription before either update, then both send owner notifications.
- Current protection: `reminder_sent_at` prevented ordinary repeated reminders, but the old check and update were not a single claim operation.
- Change made: Expiry updates require the current status and reminder updates require `reminder_sent_at IS NULL`; only a successful update claim triggers notifications.
- Verification: Existing cron unit tests remain in place; Deno execution was unavailable.
- Remaining risk: External Telegram delivery is still a separate side effect after the database claim and may fail independently.

### F4 — Cron result sets were unbounded

- Severity: MEDIUM (fixed locally)
- Function: `subscription-cron`
- Attack scenario: A large backlog causes excessive memory, database work, or execution duration.
- Current protection: No query limit existed.
- Change made: Overdue and upcoming-expiry queries are limited to 1,000 rows per invocation; later invocations can continue processing the backlog.
- Verification: Static test checks the limit.
- Remaining risk: A very large backlog needs operational monitoring and repeated scheduled runs.

### F5 — Synchronous announcements can become a long-running operation

- Severity: MEDIUM (remaining)
- Function: `send-announcement`
- Attack scenario: A platform admin sends to many recipients and the sequential provider calls exceed Edge execution limits or create provider pressure.
- Current protection: Admin-only authorization, 16 KiB body limit, subject/body bounds, 1,000-recipient cap, and admin/IP rate limits.
- Change made: No queue or asynchronous architecture was introduced because Phase 5 explicitly excludes queues.
- Verification: Code inspection.
- Remaining risk: Batch delivery requires a future job/queue design or provider batch API before very large recipient populations.

### F6 — Public contact, booking, and review mutations have no idempotency key

- Severity: LOW/MEDIUM (remaining)
- Function: `submit-contact`, `submit-booking`, `submit-review`
- Attack scenario: A retry or automated client submits the same public request multiple times.
- Current protection: Business publication checks, bounded fields, and IP/business rate limits; reviews are moderated.
- Change made: No schema or UX change was introduced in this phase.
- Verification: Code inspection.
- Remaining risk: Duplicate messages, bookings, or reviews are possible within the rate window. Add a safe deduplication strategy if product semantics require exactly-once behavior.

### F7 — No full malware scanner or media parser exists

- Severity: MEDIUM (remaining from Phase 4)
- Function: Storage upload paths and Telegram ingestion
- Attack scenario: A file with an accepted signature contains a parser exploit or malicious content in metadata.
- Current protection: Strict categories, magic-byte checks, size limits, no archive extraction, no server-side rendering/parsing, and no executable file types.
- Change made: Phase 4 controls were preserved; no third-party scanner was added.
- Verification: Repository inspection.
- Remaining risk: AbroBiz must not claim uploaded files are malware-free.

### F8 — Production CSP is not defined

- Severity: MEDIUM (remaining)
- Function: Frontend delivery and file/browser boundary
- Attack scenario: A future content injection bug has a wider browser execution impact without a Content-Security-Policy.
- Current protection: React rendering, escaped announcement email content, `nosniff`, frame denial, and safe text rendering observed in the frontend.
- Change made: No CSP was added because current external asset sources require a deliberate allowlist audit.
- Verification: `vercel.json` inspection.
- Remaining risk: Add and stage a restrictive CSP after auditing images, fonts, analytics, Supabase, and OAuth origins.

### F9 — Edge runtime and live boundary tests remain unavailable

- Severity: HIGH (release blocker, not an application claim)
- Function: All Edge Functions and Supabase policies
- Attack scenario: A local static review misses a deployment-specific JWT, RLS, CORS, provider, or runtime problem.
- Current protection: Static tests and environment-gated integration tests were added.
- Change made: No production access or credentials were used.
- Verification: Deno is not installed; live staging credentials were not supplied.
- Remaining risk: Run the Edge/static and staging integration suites before deployment.

## A. Complete Edge Function inventory

| Function | Classification and purpose | Auth/authorization | Limits and controls | Privileged/external behavior |
|---|---|---|---|---|
| `signup` | PUBLIC; email/password account creation | Supabase Auth signup; no existing session | JSON 16 KiB; IP 10/15m; email 5/15m; password/name/phone/terms bounds | Anon Supabase Auth client; generic response |
| `login` | PUBLIC; password login | Supabase Auth login | JSON 8 KiB; IP 30/15m; email 10/15m | Anon Supabase Auth client; session returned to caller |
| `verify-signup-otp` | PUBLIC; confirm six-digit signup code | Supabase Auth OTP verification | JSON 8 KiB; IP 20/15m; email 8/15m | Anon Auth client; session returned on success |
| `resend-signup-otp` | PUBLIC; resend signup code | Supabase Auth resend | JSON 8 KiB; IP 10/15m; email 3/15m | Anon Auth client; generic response |
| `request-password-reset` | PUBLIC; issue reset link | Service-only reset RPC; generic response | JSON 8 KiB; IP 10/15m; email 5/15m | Service DB client and Resend/SMTP; generic response prevents enumeration |
| `reset-password` | PUBLIC; consume reset token | Service-only atomic token claim and Auth admin update | JSON 8 KiB; IP 10/15m; token max 256; password policy | Service DB/Auth client; no session required by design |
| `submit-contact` | PUBLIC; storefront contact message | Published, unblocked business check | JSON 12 KiB; IP/business limits; bounded text/email | Service DB insert; no external API |
| `submit-booking` | PUBLIC; storefront booking request | Published, unblocked business and entitlement check | JSON 12 KiB; IP 15/15m; business 10/15m; date/time/field bounds | Service DB insert; no external API |
| `submit-review` | PUBLIC; storefront review | Published, unblocked business and entitlement check | JSON 8 KiB; IP 10/15m; business 5/15m; rating/text bounds | Service DB insert; moderation remains required |
| `submit-order` | PUBLIC; storefront order creation | Tenant/product/price validation in idempotent RPC | JSON 32 KiB; max 50 distinct items; quantity max 100; IP/business limits; idempotency key | Service DB RPC; no external API |
| `track-page-view` | PUBLIC; storefront analytics event | Published, unblocked business check | JSON 4 KiB; IP 120/min; business 60/min; path/referrer bounds | Service-only analytics RPC |
| `import-template` | PLATFORM ADMIN; import GitHub metadata/config | Bearer session plus profile role `admin` | JSON 8 KiB; IP 30/hour; admin 20/hour; bounded manifest/repo responses | Caller DB client; fixed-host GitHub API/raw fetches with timeouts |
| `send-announcement` | PLATFORM ADMIN; email owners | Bearer session plus profile role `admin` | JSON 16 KiB; IP 20/hour; admin 10/hour; 1,000 recipients | Caller DB client; Resend/SMTP with provider timeouts |
| `send-verification-email` | AUTHENTICATED USER; send own verification email | Bearer session; `auth.getUser`; token RPC uses caller identity | Empty/bounded body 1 KiB; IP 10/15m; user 3/15m | Caller DB client; Resend/SMTP |
| `notify-payment-submitted` | BUSINESS OWNER/PLATFORM ADMIN; notify admins | Bearer session; payment visible under caller JWT/RLS | JSON 4 KiB; IP 20/15m; user 10/15m; UUID validation | Service Telegram client after caller-RLS ownership check |
| `submit-payment` | BUSINESS OWNER; submit own payment | Bearer session; owner of requested business | JSON 16 KiB; IP/user/business 5/hour; idempotency key; plan/price/method/proof checks | Service DB idempotent RPC; no provider call in this endpoint |
| `storage-upload` | BUSINESS OWNER/PLATFORM ADMIN; managed upload | Bearer session; business owner/admin | Binary body; images 5 MiB, proofs 10 MiB; IP/user/business limits; magic bytes | Service Storage client after authorization |
| `storage-signed-url` | BUSINESS OWNER/PLATFORM ADMIN; private proof download | Bearer session; path business owner/admin | JSON 4 KiB; IP/user 60/hour; exact path; 600-second URL | Service Storage client |
| `telegram-webhook` | WEBHOOK; Telegram commands/callbacks/photos | Constant-time webhook secret; linked chat/admin checks; replay claim | JSON 128 KiB; IP 600/min; photo chat 20/hour; Telegram download 10 MiB | Service DB and Telegram bot; all external calls timeout |
| `subscription-cron` | CRON/INTERNAL; expiry/reminder maintenance | Strict `Bearer CRON_SECRET` | Empty/bounded body 1 KiB; query batch max 1,000; conditional claims | Service DB and optional Telegram bot |

## B. Authentication matrix

Authenticated functions use a server-side Supabase client configured with the request’s bearer token and call `auth.getUser()`. Identity comes from the verified user object, not a request `user_id`. `verify_jwt = true` is enabled for payment, storage, email/admin, template, and notification functions in `supabase/config.toml`; functions also perform their own checks. Public Auth functions intentionally use Supabase Auth’s public APIs. Telegram and cron use separate server secrets rather than user JWTs.

## C. Authorization matrix

- Platform admin: `profile.role === 'admin'`, used by template import and announcements.
- Business owner: database query matches `businesses.owner_id` to verified `auth.getUser().id`.
- Business customer: public functions can only target a published, unblocked business and relevant entitlement; order/payment integrity is enforced by RPC/trigger logic.
- Telegram admin: linked admin record, private chat, and callback sender/chat identity are checked.
- Cron: only the exact configured bearer secret authorizes execution.
- Client-supplied roles, user IDs, admin flags, and ownership claims are not used as authority.

## D. Tenant matrix

Business IDs are accepted as input only as resource selectors and are independently verified. Storage upload/signed-url paths require UUID prefixes and owner/admin lookup. Payment submission requires the proof UUID to match the requested business and the object to exist in the private bucket. Public storefront submissions verify business publication/block state. Cross-tenant live testing is represented in the Phase 2/4/5 integration scaffolding but was not run.

## E. Service-role usage

Service-role access is used by public write endpoints because those endpoints intentionally bypass direct table writes after performing their own validation; by password reset; storage functions; payment notification; Telegram webhook; and cron. Admin-only template/announcement functions use the caller’s RLS client and do not need service role. Each service-role function performs input and authorization checks before privileged operations. No public endpoint simply forwards arbitrary service-role table or Storage operations.

## F. Secret inventory

Server-only environment names used or expected include `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_DOMAIN`, `EMAIL_FROM`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_USE_TLS`, `APP_NAME`, `SITE_URL`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `CORS_ORIGINS`.

Browser-exposed variables are limited to the `VITE_*` public URL/anon configuration and Telegram bot username. No secret values were printed or added. A source scan found no literal privileged-secret assignments outside the ignored local environment; the only match was the placeholder key in `.env.example`.

## G. Rate-limit matrix

All public and expensive user-facing functions reuse the Phase 3 database-backed limiter. Auth/account limits are identity-aware where an identity is available; public storefront limits combine IP and business. Storage has IP, user, and business limits. Telegram has webhook/IP and per-chat photo limits. Cron is secret-gated and intentionally has no user rate limiter.

## H. Request limits

All JSON functions use bounded JSON readers. Uploads use bounded binary readers. No-body verification and cron endpoints now consume and bound their body to 1 KiB. GitHub and Telegram responses are bounded before JSON parsing. Arrays and strings are bounded in the relevant functions. Order items are capped at 50; announcement recipients at 1,000; cron batches at 1,000.

## I. Input validation

UUIDs, email addresses, password policy, enum values, dates/times, numeric quantities/rating/amounts, text lengths, idempotency keys, storage paths, content types, file signatures, and admin roles are validated. Payment plan price and billing interval are verified through the database RPC/trigger rather than trusted from the client. Unexpected non-record JSON is rejected or treated as invalid for sensitive operations.

## J. Output validation

Responses return sessions only where the Auth flow requires them, resource identifiers/counts where needed, and generic errors elsewhere. Passwords, OTPs, reset tokens, service keys, provider credentials, raw stack traces, and authorization headers are not returned. Template output is metadata/configuration only; repository code is never executed.

## K. CORS

Shared Edge responses allow only configured AbroBiz/local origins and never use wildcard origin. Allowed request headers include the custom storage headers and idempotency key. `cors.ts` also applies `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Cron and Telegram are server-to-server endpoints and do not need browser CORS. Supabase dashboard/project CORS remains an external deployment setting.

## L. SSRF findings

No user-controlled arbitrary URL fetch was found. GitHub import accepts a GitHub URL only to derive owner/repository names, then fetches fixed `api.github.com` and `raw.githubusercontent.com` hosts. Telegram file downloads use the fixed Telegram host and a file path returned by Telegram’s API after a file ID lookup. User-provided business URLs are validated/stored but are not fetched server-side.

## M. Open redirect findings

No user-controlled `next`, `returnUrl`, `continue`, or callback destination is accepted by Edge Functions. OAuth redirect construction uses the configured site URL or the current local origin, and password/verification links use server configuration. The configured Supabase/Google redirect allowlists still need to match production deployment settings.

## N. External API security

- Resend: fixed host, server-only API key, bounded JSON response, timeout via `fetchWithTimeout`.
- SMTP/Gmail: server-only credentials and connection/greeting/socket timeouts.
- GitHub: fixed hosts, bounded 256 KiB/128 KiB responses, timeout.
- Telegram: fixed API host, bounded JSON responses, timeout for API calls and file downloads, secret webhook, replay claim, and safe client-facing errors.
- Google OAuth: browser/Auth provider flow; no Edge Function exchanges arbitrary user URLs.

## O. Timeout/retry behavior

`fetchWithTimeout` uses `AbortController`; Resend, GitHub, and Telegram calls use it. SMTP transports have connection/greeting/socket timeouts. No automatic retry loop was added around payment, order, email, or Telegram mutations. Order/payment RPCs use idempotency, Telegram updates use replay claims, and cron updates now use conditional row claims. Announcement delivery remains sequential and can be interrupted by an execution limit without transactional all-or-nothing semantics.

## P. Payment security

Payment submission requires a verified owner, valid plan/method/cycle/amount, idempotency key, rate limits, exact proof path, and an existing private proof object. Database validation additionally checks the proof path and object bucket. Payment notification re-checks payment visibility using the caller’s JWT before using service-role Telegram access. Private proofs never use public URLs.

## Q. Order security

Public order creation uses a bounded idempotency key, max 50 unique items, quantity bounds, rate limits, and `submit_order_idempotent`. The database RPC validates business/item ownership and prices. The endpoint returns only the order ID and total. Cross-tenant integrity remains dependent on the deployed Phase 3 RPC/migration and staging verification.

## R. Booking security

Booking submission validates a UUID business, published/unblocked state, booking entitlement, customer fields, party size, ISO date/time shapes, notes, body size, and rate limits. It does not trust a customer-supplied owner or user ID. Exact duplicate suppression is not implemented.

## S. Review security

Review submission validates published/unblocked business, review entitlement, customer name, integer rating 1–5, comment size, body size, and rate limits. Reviews are inserted unapproved. Exact duplicate suppression is not implemented.

## T. Contact security

Contact submission validates published/unblocked business, name/email/phone/message lengths, JSON size, and IP/business rate limits. Message text is rendered as React text in the current UI; announcement email content is escaped. Future HTML rendering must retain escaping/sanitization.

## U. Email security

Resend/SMTP credentials are server-only. Sender address is derived from configured environment values rather than a request field. Verification/reset templates are fixed and branded; announcement body lines are HTML-escaped. Recipient lists come from authenticated admin-selected server queries, not arbitrary request recipients. Account reset responses remain generic to reduce enumeration. Announcement volume is capped but synchronous.

## V. Telegram security

Webhook requests require the configured secret with constant-time comparison, POST-only handling, bounded JSON, database replay claims, and rate limits. Business actions require linked chats; admin callbacks require linked admin records, private chat, and matching sender/chat IDs. Payment photos are byte-validated JPEGs with generated paths and per-chat limits. Bot tokens are not returned or logged.

## W. Cron security

`subscription-cron` requires a configured `CRON_SECRET` and strict bearer syntax; missing configuration fails closed with 503 and invalid credentials with 401. It is POST-only, body-bounded, batch-bounded, conditionally idempotent, and returns no secret. Operational monitoring is still required for backlog and provider failures.

## X. RPC security

Critical public mutation RPCs are service-role-only after Phase 3 revocations. Payment/order RPCs validate tenant/resource/price/idempotency state. Password reset and email verification RPCs have dedicated grants and security-definer controls from prior phases. Page-view tracking is service-role-only. RPC SQL/search paths and grants require live migration verification because this audit did not connect to the production database.

## Y. Logging security

Logs now use error names/codes or generic provider-failure labels instead of raw errors in the newly reviewed paths. No passwords, OTPs, reset tokens, bearer headers, service keys, Resend keys, or Telegram bot tokens are intentionally logged. Email recipient logging was removed from announcement failure messages. Production log retention/access should still be restricted because business IDs and operational metadata may appear.

## Z. Static tests

Added `supabase/functions/_shared/phase5_static_security_test.ts`. It checks public/authenticated endpoint contracts, bearer identity checks, bounded no-body endpoints, cron/webhook security, fixed-host external calls, timeout/response bounds, non-wildcard CORS, protected function configuration, and Phase 3 mutation boundaries.

## AA. Dynamic tests

Added `supabase/tests/phase5_edge_function_integration_test.ts`. With isolated staging variables, it checks anonymous privileged access denial, malformed bearer denial, wrong method/content type rejection, cross-tenant storage upload denial, and cron missing/invalid secret behavior. It does not require production credentials and is environment-gated.

## AB. Tests passed

- `npm.cmd run typecheck` — passed after Phase 5 changes.
- `npm.cmd audit --omit=dev` — 0 reported vulnerabilities.
- `git diff --check` — passed for tracked changes; Phase 5 files were separately checked for trailing whitespace.
- Secret scan — no literal privileged secret assignments found; `.env.example` contains placeholders only.
- Required A–AF report section check — passed.

## AC. Tests not executed

- Deno static/Edge tests — Deno is not installed.
- Live Supabase/RLS/tenant/API integration tests — no isolated staging credentials/data were supplied.
- Vitest — blocked by environment `spawn EPERM` while Vite/esbuild loaded configuration.
- Production build — TypeScript completed, but Vite/esbuild was blocked by the same `spawn EPERM` environment restriction.
- Lint — not available; `package.json` has no `lint` script.
- SQL migration/RPC verification against Supabase — no remote database connection or deployment was performed.
- Million-user/load testing — explicitly outside Phase 5 scope.

## AD. Files changed

Phase 5 changes:

- `supabase/functions/_shared/requestSecurity.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/endpointSecurity.ts`
- `supabase/functions/_shared/endpoint_security_test.ts`
- `supabase/functions/_shared/rateLimit.ts`
- `supabase/functions/_shared/notify.ts`
- `supabase/functions/_shared/phase5_static_security_test.ts`
- `supabase/functions/import-template/index.ts`
- `supabase/functions/send-announcement/index.ts`
- `supabase/functions/send-verification-email/index.ts`
- `supabase/functions/request-password-reset/index.ts`
- `supabase/functions/reset-password/index.ts`
- `supabase/functions/notify-payment-submitted/index.ts`
- `supabase/functions/storage-upload/index.ts`
- `supabase/functions/storage-signed-url/index.ts`
- `supabase/functions/submit-payment/index.ts`
- `supabase/functions/subscription-cron/index.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/tests/phase5_edge_function_integration_test.ts`
- `PHASE5_EDGE_FUNCTION_SECURITY_REPORT.md`

Existing Phase 0–4 worktree changes were preserved and not reset.

## AE. Migrations created

No Phase 5 migration was required. Phase 5 changes use existing Phase 0–4 tables, RLS, RPCs, rate-limit infrastructure, and Storage controls. No historical migration was modified by this phase.

## AF. Remaining HIGH/CRITICAL findings

1. **HIGH — Release verification blocker:** Deno/static Edge tests, live tenant/RLS/API tests, and SQL verification were not executable in this environment.
2. **HIGH — Deployment state unknown:** Local Phase 5 code changes and prior Phase 4 migration/function changes have not been deployed; production behavior must not be assumed to match this report.
3. **MEDIUM — Synchronous announcement delivery:** Large owner populations may exceed Edge execution time or provider limits; future batching/queueing is required for scale.
4. **MEDIUM — No malware scanning/full media parsing:** Accepted signatures are not a malware guarantee.
5. **MEDIUM — CSP and Storage project settings:** Add/stage CSP and separately verify Supabase Storage CORS/delivery headers.
6. **LOW/MEDIUM — Public duplicate mutations:** Contact, booking, and review requests have rate limits but no exact idempotency/deduplication.

Phase 5 does not declare AbroBiz fully production-ready. Staging deployment, isolated security tests, SQL/RLS verification, and operational review are required before any production release.
