# AbroBiz Phase 3 API Abuse Security Report

Status: Phase 3 controls implemented and validated locally. No deployment, Git push, production-secret change, database reset, or production-data deletion was performed. The application must not be declared production-ready until the new migration/functions and the dynamic staging tests have been run.

## A. Complete endpoint inventory

| Endpoint or operation | Method | Authentication | Authorization / tenant scope | Input and maximum | Rate / idempotency | Writes / external calls | Risk |
|---|---|---|---|---|---|---|---|
| `login` Edge Function | POST | Public pre-session | Supabase Auth credentials | JSON <= 8 KiB; email <= 254; password <= 128 | IP 30/15 min; email 10/15 min | Auth sign-in | High |
| `signup` Edge Function | POST | Public pre-session | Supabase Auth; legal fields required | JSON <= 16 KiB; name 120; phone 40; strong password policy | IP 10/15 min; email 5/15 min | Auth account creation / email | High |
| `verify-signup-otp` | POST | Public pre-session | Supabase Auth OTP | JSON <= 8 KiB; six-digit OTP | IP 20/15 min; email 8/15 min | Auth verification | High |
| `resend-signup-otp` | POST | Public pre-session | Supabase Auth resend | JSON <= 8 KiB; generic invalid-account response | IP 10/15 min; email 3/15 min | Verification email | High |
| `request-password-reset` | POST | Public pre-session | Service-only reset RPC; generic response | JSON <= 8 KiB; email <= 254 | IP 10/15 min; email 5/15 min | Reset token / email | High |
| `reset-password` | POST | Reset token | Service-only atomic token claim | JSON <= 8 KiB; strong password policy | IP 10/15 min; one-use token | Auth password update | High |
| `send-verification-email` | POST | Authenticated | Current user only | No request body; user from JWT | IP 10/15 min; user 3/15 min | Email provider | High |
| `submit-contact` | POST | Public | Published, non-blocked business | JSON <= 12 KiB; name 120, email 254, phone 40, message 5,000 | IP 20/15 min; business 10/15 min | Contact row and notification | High |
| `submit-booking` | POST | Public | Published business with booking entitlement | JSON <= 12 KiB; name 120, phone 40, notes 2,000, party size 1–50 | IP 15/15 min; business 10/15 min | Booking row and notification | High |
| `submit-review` | POST | Public | Published business with review entitlement | JSON <= 8 KiB; name 120, comment 2,000, rating 1–5 | IP 10/15 min; business 5/15 min | Unapproved review and notification | High |
| `submit-order` | POST | Public | Published business with ordering entitlement | JSON <= 32 KiB; 1–50 unique items; quantity 1–100; bounded text | IP 20/15 min; business 10/15 min; `Idempotency-Key` | Idempotent order RPC and notification | Critical |
| `track-page-view` | POST | Public | Published, non-blocked business | JSON <= 4 KiB; UUID; path 200; referrer 1,000 | IP 120/min; business 60/min | Service-only analytics RPC | Medium |
| `submit-payment` | POST | Authenticated owner | JWT user must own business | JSON <= 16 KiB; UUIDs; proof path 500; note 2,000 | User 5/hour; business 5/hour; `Idempotency-Key` | Payment row | Critical |
| `notify-payment-submitted` | POST | Authenticated | Payment visible through caller RLS | JSON <= 4 KiB; UUID | IP 20/15 min; user 10/15 min | Telegram API | High |
| `send-announcement` | POST | Authenticated admin | Platform-admin profile | JSON <= 16 KiB; subject 200; body 10,000; max 1,000 recipients | IP 20/hour; admin 10/hour | Up to 1,000 email calls and announcement row | High |
| `import-template` | POST | Authenticated admin | Platform-admin profile; HTTPS GitHub only | JSON <= 8 KiB; bounded manifest/config | IP 30/hour; admin 20/hour | GitHub API, template row | High |
| `telegram-webhook` | POST | Telegram secret | Secret plus callback/admin RPC checks | JSON <= 128 KiB; safe update ID | 600/min plus processed-update replay claim | Telegram API, payment rows | High |
| `subscription-cron` | POST | `CRON_SECRET` | Secret only; service role | No body | Scheduler/secret protected | Subscription/notification updates | High |
| Direct catalog/business CRUD | POST/PATCH/DELETE | Authenticated | Existing RLS owner/admin policies; account write trigger | Database constraints for text/JSON; client reads capped | Owner writes 300/min/account | Database/storage | Medium |
| Direct dashboard reads | GET | Authenticated owner/admin | Existing RLS; child rows tenant-scoped | Client caps generally 100–1,000 rows | Read-only | Database | Medium |
| Public storefront reads | GET | Public | Published/non-blocked RLS | Client catalog limits; project PostgREST max rows still required | Read-only | Database | Medium |
| Storage uploads | POST | Authenticated owner/admin | Bucket path must begin with business ID | Images <= 5 MiB; proof <= 10 MiB; allowlisted MIME | Bucket limits; per-file no distributed quota | Storage only | High |

## B. Rate-limit matrix

Rate limiting is server-side through the existing atomic `consume_rate_limit` RPC and service-role client. Keys combine the endpoint with the edge request address and, where useful, an authenticated user, email, business, or admin identifier. Account identifiers are a second layer and are never the only signal for public abuse controls.

| Scope | Limit | Purpose |
|---|---:|---|
| login IP / email | 30 / 10 per 15 min | Password guessing and credential stuffing |
| signup IP / email | 10 / 5 per 15 min | Account and verification-email abuse |
| OTP verify IP / email | 20 / 8 per 15 min | OTP guessing |
| OTP resend IP / email | 10 / 3 per 15 min | Email spam prevention |
| reset request IP / email | 10 / 5 per 15 min | Reset-email spam and enumeration resistance |
| reset password IP | 10 per 15 min | Token endpoint abuse |
| contact IP / business | 20 / 10 per 15 min | Message flooding |
| booking IP / business | 15 / 10 per 15 min | Booking flooding |
| review IP / business | 10 / 5 per 15 min | Review spam |
| order IP / business | 20 / 10 per 15 min | Order flooding |
| payment user / business | 5 / 5 per hour | Payment and notification abuse |
| page-view IP / business | 120 / 60 per minute | Analytics flooding |
| admin announcement IP / admin | 20 / 10 per hour | Bulk-email abuse |
| template import IP / admin | 30 / 20 per hour | GitHub/external-fetch abuse |
| authenticated catalog/business writes | 300 per minute/account | Direct PostgREST write flooding |
| Telegram webhook | 600 per minute | Malformed/update storm control |

Rate-limit rows are indexed and purged by the scheduled service-role cleanup. The current database-row limiter is suitable as a bounded Phase 3 control, not the final one-million-user architecture.

## C. Request-size limits

`readJsonBody` rejects non-JSON content, oversized declared bodies, oversized buffered bodies, empty bodies, and invalid JSON before application processing. Current limits are 4 KiB for page views, 8 KiB for auth/reset/review/template/login, 12 KiB for contact/booking, 16 KiB for signup/payment/announcement, 32 KiB for orders, and 128 KiB for Telegram updates. Storage buckets enforce 5 MiB public images and 10 MiB payment proofs.

## D. Input validation limits

All new public wrappers validate UUIDs, email shape, enum values, integer ranges, field lengths, and expected dates/times. Database `NOT VALID` check constraints in migration 0028 enforce future writes without rewriting existing data. Dangerous URL schemes are rejected for business links and template repository/preview URLs; only HTTPS is accepted.

## E. Array/object limits

Orders accept 1–50 unique item objects and quantities from 1–100. Business gallery URLs are limited to 20 and languages to 5. JSON columns for translations, business settings, plans, templates, and other controlled metadata are bounded to 32 KiB by database checks. Imported theme config accepts an allowlist of keys and bounded string values.

## F. Pagination limits

Client dashboard/catalog queries now apply explicit limits: categories 100, items 500, reviews 100–200, bookings/messages/orders/payments 200, plans/payment methods/templates/business categories 100, announcements 100, and admin businesses 1,000. No global offset/cursor redesign was introduced. Supabase/PostgREST project-level maximum rows should still be configured as an operational control for hostile direct GET requests.

## G. Response limits

New mutation functions return small success/error payloads. Admin announcements cap recipient processing at 1,000 and template imports cap GitHub metadata at 256 KiB and manifests at 128 KiB. Existing public table queries still include some `SELECT *` projections; current columns are storefront-safe, but explicit public views are a future hardening item.

## H. Idempotency controls

Migration 0028 adds `request_idempotency`, with a 24-hour bounded lifetime, operation binding, request hash binding, and stored result ID. Order and payment wrappers require an `Idempotency-Key`; retries with the same key and same request return the original result, while reuse with different data is rejected. The existing one-business-per-owner constraint protects business creation. Telegram updates use the existing processed-update claim table.

Payment flooding is additionally blocked by an advisory-lock-protected pending-payment trigger, allowing at most one pending payment per business at a time without failing migration creation on historical duplicates.

## I. Replay protection

Password reset tokens are atomically claimed and single-use from Phase 0. Telegram update IDs are atomically claimed before processing. Order/payment retries are idempotent for 24 hours. Payment approval RPCs remain state-checked by the existing admin functions, so already-reviewed payments do not repeat the state transition.

## J. Search security

No application search endpoint or arbitrary sort/filter API was found. The frontend uses fixed field/order expressions. Public catalog reads are scoped by business/published state through existing RLS. If search is added, it must use an allowlist and bounded query/page values rather than accepting SQL fragments or arbitrary columns.

## K. URL validation

The GitHub importer accepts only `https://github.com/owner/repository` and fetches only GitHub API/raw hosts. Business gallery/logo/cover/map/social URLs and template preview URLs must use HTTPS at the database trigger boundary. No user-provided URL is fetched by the application except the fixed-host GitHub import flow. `javascript:`, `data:`, and `vbscript:` are not accepted by the new URL controls.

## L. SQL injection testing

The application uses Supabase query builders and fixed RPC names; no client input is concatenated into SQL. UUID and enum validation rejects malformed identifier inputs before the new public mutations reach the database. The dynamic staging test plan includes representative SQL-injection strings for names, slugs, IDs, and future search values. It was not run because no isolated staging credentials were available.

## M. External API protection

Resend, GitHub, and Telegram calls now use timeout-bounded fetches. External JSON responses are byte-bounded. Telegram downloads are capped at 10 MiB, matching the payment-proof storage ceiling. Fixed hosts are used; no arbitrary server-side URL fetch exists. Email and Telegram failures are logged server-side with safe client responses, and the announcement/import endpoints have per-admin rate limits.

## N. Edge Function hardening

All mutating functions now reject unsupported methods. JSON functions use bounded parsing and safe structured errors. Protected functions retain JWT/role/secret checks. Public contact, booking, review, order, and payment writes are routed through functions; migration 0028 revokes direct anonymous table/RPC write bypasses. The new login wrapper adds account/IP controls while returning one generic credential failure response.

## O. Database constraints

Migration 0028 adds bounded checks for profile, business, catalog, contact, booking, review, payment, announcement, page-view, plan, payment-method, template, and notification fields. It adds bounded JSON/array checks, owner-write rate triggers, HTTPS business/template URL triggers, pending-payment duplicate protection, idempotency state, and cleanup. Historical migrations were not edited.

## P. Security tests

Added:

- `supabase/functions/_shared/phase3_static_security_test.ts`: verifies method/body/rate controls, public-write revocation, idempotency, URL validation, external bounds, and frontend wrapper usage.
- `supabase/tests/phase3_abuse_integration_test.ts`: environment-gated staging tests for oversized bodies, wrong content types, unsupported methods, malformed IDs, excessive quantities, and rate/idempotency endpoint availability.

The existing Phase 0, Phase 1, and Phase 2 static/security tests remain in place. The integration tests use only test environment variables and never contain secrets.

## Q. Tests passed

- `npm.cmd run typecheck`
- `npm.cmd test -- --run`: 7 files, 42 tests passed
- `npm.cmd run build`
- `git diff --check`
- Application-source secret scan: no assigned secret values found in application source or migrations

No `lint` script is defined in `package.json`; lint was not available as a repository command.

The build still reports the existing large JavaScript bundle warning (approximately 880 KiB minified); broad frontend optimization was intentionally excluded from Phase 3.

## R. Tests not executed

- Deno Edge/static tests: Deno is not installed in this workspace.
- Dynamic Phase 3 staging tests: no isolated staging URL/credentials were provided.
- Live direct PostgREST bypass tests after migration 0028.
- Live Storage MIME/size/path and upload-volume tests.
- Live Supabase Auth provider rate-limit behavior and Google OAuth tests.
- Production deployment verification.

## S. Files changed

- `supabase/migrations/0028_phase3_abuse_hardening.sql`
- `supabase/config.toml`
- `supabase/functions/_shared/requestSecurity.ts`
- `supabase/functions/_shared/external.ts`
- `supabase/functions/_shared/rateLimit.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/mailer.ts`
- `supabase/functions/_shared/telegram.ts`
- `supabase/functions/_shared/phase3_static_security_test.ts`
- `supabase/functions/login/index.ts`
- `supabase/functions/submit-contact/index.ts`
- `supabase/functions/submit-booking/index.ts`
- `supabase/functions/submit-review/index.ts`
- `supabase/functions/submit-order/index.ts`
- `supabase/functions/submit-payment/index.ts`
- Updated auth, admin, webhook, cron, notification, import, analytics, and reset handlers for method/body/rate controls.
- Updated frontend API wrappers for public writes, idempotency headers, upload checks, and read limits.
- `supabase/tests/phase3_abuse_integration_test.ts`

## T. Migrations created

- `supabase/migrations/0028_phase3_abuse_hardening.sql`

No historical migration was modified. The migration does not partition tables, reset data, delete production rows, or change production secrets.

## U. Remaining HIGH/CRITICAL issues

Severity: HIGH  
Endpoint/component: Production release state  
Attack scenario: Production continues using the pre-Phase-3 direct public write paths and lacks the new wrappers/constraints.  
Current protection: Controls exist locally only.  
Change made: Added migration 0028 and new Edge Functions.  
Verification: Deploy to staging and run dynamic cross-tenant/abuse tests before production.  
Remaining risk: High until the controlled release is completed.

Severity: HIGH  
Endpoint/component: Storage uploads  
Attack scenario: An authenticated owner repeatedly uploads allowed-size files and consumes storage because no per-account quota/distributed upload limiter exists.  
Current protection: Tenant path policies, MIME allowlists, and 5/10 MiB server-side bucket limits.  
Change made: Added client prechecks and retained server bucket limits.  
Verification: Run staging repeated-upload and path tests.  
Remaining risk: Upload quota belongs in a later storage/quota phase.

Severity: MEDIUM  
Endpoint/component: Public direct reads  
Attack scenario: A caller bypasses frontend `.limit()` values by requesting large PostgREST result sets.  
Current protection: RLS and frontend read caps; current Supabase project default max rows may apply.  
Change made: Added client-side limits and documented the project-level control.  
Verification: Set and verify Supabase maximum rows, then test public catalog response sizes.  
Remaining risk: No new server-side public projection was introduced in this phase.

Severity: MEDIUM  
Endpoint/component: Database-backed rate-limit storage  
Attack scenario: Many spoofed/new edge identities create rate-limit buckets and increase write contention.  
Current protection: Atomic RPC, indexed timestamp, scheduled cleanup, and bounded key length.  
Change made: Phase 3 cleanup now removes expired idempotency and stale limiter state.  
Verification: Observe row count and RPC latency in staging.  
Remaining risk: Distributed edge/Redis limiting is deferred to the scalability phase.

Severity: MEDIUM  
Endpoint/component: Existing dependency tree  
Attack scenario: React Router advisories may apply under affected usage patterns.  
Current protection: No Phase 3 dependency change; application does not expose an SSR server in this repository.  
Change made: None, to avoid unrelated compatibility changes.  
Verification: `npm audit --omit=dev --audit-level=high` remains clean for high severity but reports two moderate advisories.  
Remaining risk: Upgrade in a dedicated compatibility release.

## V. Future scalability recommendations

Deferred intentionally:

- distributed edge/Redis rate limiting and quota accounting;
- explicit public projection views and cursor pagination;
- CDN/image transformation and upload quotas;
- asynchronous email/Telegram delivery with retry budgets;
- analytics aggregation/retention and partitioning;
- database read replicas and EXPLAIN-driven indexes;
- bot scoring/CAPTCHA only for endpoints demonstrated to need it;
- centralized production logging, alerting, and abuse dashboards.

Phase 3 prevents obvious abuse and uncontrolled writes without claiming one-million-user scalability. Production readiness still requires staging deployment, dynamic abuse tests, and review of Supabase Auth, Storage, PostgREST, and provider settings.
