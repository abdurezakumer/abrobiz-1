# AbroBiz Phase 6 — PostgreSQL Database Performance, RLS & Scalability Audit

Date: 2026-08-30  
Scope: repository migrations `0001`–`0030`, frontend database calls, Edge Function database calls, Supabase configuration, and existing Phase 0–5 hardening.  
Production safety: no production database connection, data mutation, deployment, or Git push was performed.

## Executive status and severity summary

The repository has a coherent PostgreSQL/Supabase multi-tenant design with UUID primary keys, foreign keys, RLS, server-side RPCs for sensitive writes, database-backed rate limiting, and idempotency for orders/payments. Phase 6 adds evidence-backed indexes, explicit projections, query bounds, and bounded maintenance functions.

There are no newly observed Critical database findings from static inspection. Production readiness is not fully proven because this environment has no safe staging/production database connection for row counts, `EXPLAIN`, lock inspection, RLS execution tests, or load testing. The main remaining High risks are operational: maintenance functions need a scheduled trusted job, production query plans/counts have not been measured, and high-volume lists still need cursor pagination before very large tenants are supported.

Severity meaning below:

- Critical: immediate compromise, destructive data exposure, or unrecoverable integrity risk.
- High: likely operational/security failure at scale or an unverified control protecting sensitive data.
- Medium: material performance, maintenance, or abuse risk with a practical mitigation.
- Low: optimization, observability, or maintainability improvement.

## A. Architecture map

The application is a Vite-built React 19 single-page application hosted as static assets on Vercel. `src/lib/supabaseClient.ts` creates the browser Supabase client using only the public URL and anon key. The browser uses Supabase Auth, PostgREST/RLS, and Storage. Sensitive writes and external integrations are routed through Supabase Edge Functions under `supabase/functions/`. PostgreSQL is the system of record for tenant content, orders, payments, bookings, reviews, messages, subscriptions, rate limits, and replay/idempotency state. Supabase-managed `auth.users` and `storage.*` are outside the custom `public` table inventory.

Vercel uses the SPA rewrite in `vercel.json` and sends baseline security headers. There is no application connection pool or custom server process in this repository; each Edge invocation creates a short-lived Supabase client. This keeps the client/server boundary simple, but production capacity and connection behavior remain Supabase-plan dependent.

## B. Table inventory

Current custom tables and columns, grouped by role:

| Table | Columns | PK / principal foreign keys | Growth class / RLS |
|---|---|---|---|
| `profiles` | `id`, `role`, `name`, `phone`, `created_at`, `email`, `email_verified_at`, `terms_accepted_at`, `privacy_accepted_at`, `legal_version` | `id`; `auth.users(id)` cascade | One row per account; owner/admin RLS |
| `business_categories` | `id`, `slug`, `label`, `item_label`, `category_label`, `icon`, `sort_order`, `is_active`, `created_at` | `id`; unique `slug` | Small admin catalog; public read/admin write |
| `businesses` | `id`, `owner_id`, `category_id`, `name`, `slug`, `description`, `logo_url`, `cover_url`, `phone`, `email`, `address`, `maps_url`, `template_slug`, `languages`, `accent_color`, `opening_hours`, `social`, `currency`, `timezone`, `is_published`, `is_blocked`, `blocked_reason`, `about_content`, `gallery_urls`, `created_at`, `updated_at` | `id`; owner → `profiles`, category → `business_categories` | One per owner; public storefront reads are tenant-scoped |
| `categories` | `id`, `business_id`, `name`, `icon`, `sort_order`, `is_hidden`, `translations`, `created_at` | `id`; business cascade | Tenant catalog; owner/admin RLS |
| `items` | `id`, `business_id`, `category_id`, `image_url`, `price`, `is_available`, `sort_order`, `translations`, `created_at`, `is_featured` | `id`; business/category cascade | Tenant catalog; owner/admin RLS |
| `plans` | `id`, `slug`, `name`, `price_etb`, `billing_interval`, `features`, `is_trial`, `trial_days`, `is_active`, `sort_order`, `created_at` | `id`; unique slug | Small admin catalog; public active read |
| `payment_methods` | `id`, `name`, `account_name`, `account_number`, `instructions`, `is_active`, `sort_order`, `created_at` | `id` | Small admin catalog; admin writes |
| `subscriptions` | `id`, `business_id`, `plan_id`, `status`, `start_date`, `end_date`, `auto_renew`, `created_at`, `updated_at`, `reminder_sent_at` | `id`; unique business, plan → `plans` | One current row per business; owner/admin RLS |
| `payments` | `id`, `business_id`, `plan_id`, `billing_cycle`, `amount_etb`, `payment_method_id`, `proof_url`, `owner_note`, `status`, `telegram_message_id`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at` | `id`; business/plan/method/profile FKs | Append-heavy financial history; owner/admin RLS |
| `business_telegram_links` | `id`, `business_id`, `telegram_chat_id`, `telegram_username`, `link_token`, `linked_at` | `id`; unique business → business | At most one per business; owner/admin RLS |
| `admin_telegram_links` | `id`, `admin_id`, `telegram_chat_id`, `telegram_username`, `link_token`, `linked_at` | `id`; unique admin → profile | At most one per admin; admin RLS |
| `telegram_pending_actions` | `telegram_chat_id`, `business_id`, `plan_id`, `payment_method_id`, `updated_at` | text chat ID; optional FKs | Ephemeral, one row per chat; service role only |
| `telegram_processed_updates` | `update_id`, `processed_at` | bigint update ID | Replay ledger; service role only |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `link`, `is_read`, `created_at` | `id`; user → profile | One per event/user; owner/admin reads |
| `page_views` | `id`, `business_id`, `path`, `referrer`, `created_at` | `id`; business cascade | Highest-volume analytics table; service-side insert and owner/admin read |
| `admin_logs` | `id`, `admin_id`, `action`, `target_table`, `target_id`, `meta`, `created_at` | `id`; optional profile FK | Append-only audit history; admin read |
| `contact_messages` | `id`, `business_id`, `name`, `email`, `phone`, `message`, `is_read`, `created_at` | `id`; business cascade | Public append / tenant read, rate limited |
| `bookings` | `id`, `business_id`, `customer_name`, `phone`, `party_size`, `requested_date`, `requested_time`, `notes`, `status`, `created_at` | `id`; business cascade | Public append / tenant read, rate limited |
| `orders` | `id`, `business_id`, `customer_name`, `phone`, `fulfillment_type`, `address`, `notes`, `status`, `total_etb`, `created_at` | `id`; business cascade | Append-heavy; RPC-only insert, owner/admin read |
| `order_items` | `id`, `order_id`, `item_id`, `item_name`, `price_etb`, `quantity` | `id`; order cascade, item set-null | Child rows per order; owner/admin read |
| `reviews` | `id`, `business_id`, `customer_name`, `rating`, `comment`, `is_approved`, `created_at` | `id`; business cascade | Public append / moderated read, rate limited |
| `email_verification_tokens` | `id`, `user_id`, `token`, `expires_at`, `used_at`, `created_at` | `id`; user cascade | Short-lived security state; RLS with RPC access |
| `password_reset_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`, `claimed_at` | `id`; user cascade, unique token hash | Short-lived security state; service role only |
| `request_idempotency` | `idempotency_key`, `operation`, `request_hash`, `result_id`, `created_at`, `expires_at` | text idempotency key | Short-lived replay state; no client access |
| `rate_limits` | `bucket_key`, `window_started_at`, `request_count`, `updated_at` | text bucket key | Hot single-row counters; no client access |
| `announcements` | `id`, `admin_id`, `subject`, `body`, `audience`, `recipient_count`, `created_at` | `id`; optional admin FK | Low-frequency admin history |
| `templates` | `id`, `slug`, `name`, `description`, `repo_url`, `preview_url`, `config`, `is_builtin`, `is_active`, `sort_order`, `created_by`, `created_at` | `id`; unique slug, optional profile FK | Small admin catalog; active public read |

Supabase-managed `storage.buckets` and `storage.objects` are also used. No custom views, materialized views, generated columns, custom enum types, or application-owned sequences were found. UUID defaults use `extensions.gen_random_uuid()`; the two bigint/text operational identifiers are externally meaningful keys.

## C. Growth classification

Current production row counts were intentionally not queried. The following are workload classifications, not measurements:

- Low growth: `business_categories`, `plans`, `payment_methods`, `templates`, `admin_telegram_links`, `business_telegram_links`.
- Account/tenant growth: `profiles`, `businesses`, `categories`, `items`, `subscriptions`.
- High growth: `page_views`, `rate_limits`, `request_idempotency`, `telegram_processed_updates`, `notifications`, `contact_messages`, `bookings`, `orders`, `order_items`, `reviews`, `payments`.
- Moderate append-only audit: `admin_logs`, `announcements`.
- Short-lived but abuse-sensitive: verification/reset tokens and Telegram pending actions.

At 10k, 100k, and 1M registered accounts, account-linked rows are expected to be of the same order as accounts, but no current or future row-count multiplier is asserted. Public event tables depend on traffic and conversion rates and can exceed account growth by orders of magnitude; they require retention, pagination, and monitoring rather than account-based estimates.

## D. PK audit

All business entities use primary keys. UUIDs avoid predictable tenant identifiers and sequential insert hotspots. `telegram_pending_actions.telegram_chat_id`, `rate_limits.bucket_key`, and `request_idempotency.idempotency_key` are intentional natural/operational keys with one-row lookup semantics. Child table keys are indexed by their PK and their parent lookup indexes where needed. Wide UUID indexes have normal storage/write cost; this is acceptable for the current relational model.

No missing primary key was found. No primary key was changed in Phase 6.

## E. FK audit

Tenant children reference `businesses` and use `on delete cascade` where deleting a business should remove its owned content. `order_items.item_id` uses `on delete set null` to preserve historical line items. Account-linked rows reference `profiles`; subscriptions/payments reference plans and payment methods. The FK set is structurally coherent.

Not every FK has a separate child-side index. This is not automatically a defect: many referenced tables are small or only joined by a parent PK. `order_items.order_id`, the main high-volume parent lookup, is indexed. Before enabling bulk parent deletes or frequent parent-key updates, inspect `pg_stat_user_indexes` and add missing child FK indexes based on real plans.

## F. Index inventory

Existing indexes cover business owner/slug/category, category/item tenant access, subscription status/end date, payment business/status, notifications, page views by tenant/time, admin log time, messages, bookings, orders, order items, reviews, token user IDs, profile email, request expiry, template sorting, and the unique business/slug constraints added by Phase 2.

Phase 6 migration `supabase/migrations/0030_phase6_database_scalability.sql` adds:

- `subscriptions_status_end_date_idx`
- `payments_business_created_at_idx`
- `payments_status_created_at_idx`
- `reviews_business_approved_created_at_idx`
- partial Telegram chat-ID indexes for business/admin links
- `telegram_processed_updates_processed_at_idx`
- verification/reset expiry indexes
- `page_views_created_at_id_idx`

The migration also replaces unbounded maintenance routines with bounded batches and adds `purge_page_views` and `purge_expired_security_state`.

## G. Missing indexes

No missing index was proven from a live query plan because no database connection was available. The most defensible prior gaps were addressed in Phase 6. Candidates to verify with production statistics are payment review/approval lookups by `reviewed_by`, admin-log target filtering, `order_items.item_id` if reverse item reporting is introduced, and any future subscription `plan_id` reporting. Add them only after query evidence; unused indexes increase write cost.

Finding: **Medium — live index evidence unavailable**. Location: database runtime, not a repository line. Impact: an apparently complete migration may still miss a workload-specific index. Fix: capture `pg_stat_statements`, `pg_stat_user_indexes`, and representative `EXPLAIN (ANALYZE, BUFFERS)` in staging/production read-only mode. Priority: before the first high-volume launch and after each major query feature.

## H. Duplicate/redundant indexes

`businesses_owner_id_idx` from `0001_schema.sql` is redundant with the unique owner index introduced in `0024`; the unique index already supports equality lookups. `businesses_slug_idx` may be redundant for some exact slug queries but is not guaranteed redundant with a unique `lower(slug)` expression index because expression/case semantics differ. No index was dropped in Phase 6 because removal requires usage statistics and a rollback plan.

Finding: **Low — redundant owner index**. Location: `supabase/migrations/0001_schema.sql:121`, `supabase/migrations/0024_tenant_subdomain_isolation.sql:10`. Impact: duplicated write/storage overhead. Fix: confirm with `pg_stat_user_indexes`, then remove only in a separate reviewed migration. Priority: maintenance window, after production observation.

## I. Query inventory

Frontend API modules cover business/profile data, categories, items, subscriptions, payments, payment methods, bookings, orders/order items, reviews, contact messages, announcements, templates, and notifications. High-growth list calls now use explicit columns and hard limits. The main public and owner sort keys are tenant plus creation/request time. Sensitive writes are routed to Edge Functions/RPCs for rate limiting, entitlement checks, repricing, payment integrity, and notifications.

Edge Functions also query Auth, profiles, businesses, tokens, storage metadata, subscriptions, and Telegram state. External email/Telegram calls are performed outside database transactions.

## J. N+1 query audit

No obvious frontend N+1 pattern was found in normal list reads. Orders use one nested `order_items` relation rather than fetching each order’s children independently. The subscription cron intentionally loops bounded subscriptions and performs conditional per-row claims/notifications; this is a side-effect workflow, not a read-render N+1, but it should be moved to a queue/batch worker if volume grows materially. Announcement delivery similarly sends sequentially to a bounded recipient batch and remains a scalability concern.

## K. `SELECT *` audit

Phase 6 replaced wildcard projections in high-growth list APIs for announcements, bookings, items, messages, orders, payments, reviews, and subscriptions. Admin business listing still uses a wildcard projection for a low-frequency admin screen, and single-row business/template/plan reads use broad projections. These are not currently the same risk as unbounded event-list queries, but the admin listing should eventually select only required columns and paginate.

## L. Pagination audit

High-growth client lists have explicit limits, generally 100–200, and the pending-payment admin list is capped at 200. No `OFFSET` pagination was introduced. The current limit prevents runaway payloads but is not a complete user-facing pagination strategy: a tenant with more than the cap cannot browse all records through one request.

Finding: **High — cursor pagination is not yet implemented**. Locations: `src/lib/api/orders.ts`, `payments.ts`, `bookings.ts`, `messages.ts`, `reviews.ts`, and related dashboard callers. Impact: large tenants eventually hit hidden/truncated records or need expensive offset pagination. Fix: add `(created_at,id)` cursor parameters and “load next” UI/API contracts. Priority: before high-volume tenant onboarding.

## M. Keyset-pagination candidates

Best candidates are orders, payments, bookings, contact messages, reviews, notifications, admin logs, and page views. Use a stable composite cursor such as `(created_at,id)` with the matching sort direction; bookings may additionally use `(requested_date,id)`. Keep the current bounded limit as a server-side maximum. This was not implemented because it changes API contracts and UI behavior beyond a safe audit/index patch.

## N. RLS performance

RLS is enabled on custom application tables and on storage objects through the migration chain. Most tenant policies use `public.is_admin()` or an `EXISTS` lookup from a child row to `businesses` by primary key and owner ID. Those predicates are index-friendly for the child’s business ID and the parent PK. Public storefront policies constrain reads to published, unblocked businesses and tenant-owned child rows.

RLS overhead has not been measured with `EXPLAIN`; nested policy checks can become material on large scans. The correct test is to compare representative authenticated/public queries with RLS enabled in staging and inspect buffers/plans, not to disable RLS in production.

## O. RLS supporting indexes

Supporting indexes exist for the principal policy paths: `businesses.id` PK plus owner unique index; category/item/business indexes; order/order-item parent lookup; payment/review/booking/message tenant indexes; and profile ID PK. Phase 6 adds the composite review index needed for public approved review lists and payment/business time indexes for owner/admin dashboards. Storage policies use object path prefixes and owner/business checks from Phase 4.

## P. `SECURITY DEFINER` audit

Security-definer helpers set `search_path = public`; sensitive functions check `auth.role()` or `public.is_admin()` and have explicit grants/revokes in later migrations. Service-role-only functions include reset-token lifecycle, Telegram replay claims, idempotent order/payment operations, page-view tracking, and Phase 6 purge functions. Public-facing security-definer flows intentionally expose only their documented result.

Residual risk: `create_business_with_trial` and historical function definitions should be verified in the live catalog for final `proconfig`, owner checks, and grants after all migrations run. Do not rely only on source ordering. Priority: High before production migration sign-off.

## Q. RPC audit

Important RPCs include account/business creation with trial, entitlement lookup, order submission/repricing, idempotent order/payment submission, admin payment approval/rejection, reset/verification token lifecycle, Telegram update claiming, page-view tracking, and rate-limit consumption. The sensitive write RPCs centralize integrity and avoid trusting client price/status fields. Phase 6 maintenance RPCs are bounded and service-role gated.

## R. Query plans

No `EXPLAIN`, `EXPLAIN ANALYZE`, `BUFFERS`, `pg_stat_statements`, lock, vacuum, bloat, or connection metrics were executed because no safe staging/production database credentials were provided. Query-plan status is therefore **not executed**, not “passed”. Run plans for owner order/payment/review lists, public storefront catalog, cron filters, rate-limit lookup, idempotency lookup, and storage policy-backed reads before making further index changes.

## S. High-growth tables

`page_views`, `notifications`, `orders`, `order_items`, `payments`, `bookings`, `contact_messages`, `reviews`, replay state, rate limits, and idempotency state are the principal growth paths. Tenant event tables have tenant/time indexes. Global maintenance state has expiry/time indexes. The remaining capacity risks are retention scheduling, cursor pagination, analytics aggregation, and observability.

## T. Analytics

`page_views` is a raw event table with a tenant/time index and a new global `(created_at,id)` index. It is suitable for bounded inserts and recent tenant reads, but raw events should not be retained indefinitely. The new service-role-only `purge_page_views(before,batch_size)` deletes at most 5,000 ordered rows per call. A recommended initial policy is 90–180 days, subject to product/legal approval; this is not configured automatically.

## U. Rate-limit storage

`rate_limits` uses a primary-key bucket lookup and row locking in `consume_rate_limit`; this is efficient for a single bucket but creates intentional contention on very hot keys. The Phase 3 public-form triggers and Edge Functions bound abuse. `purge_rate_limits` and `purge_phase3_request_state` now delete at most 5,000 stale rows per invocation. A distributed or edge-native limiter may be required for very high global traffic.

## V. Idempotency

`request_idempotency` uses the request key as a PK, stores an operation and request hash, and has an expiry index. Order/payment RPCs check the existing key and preserve the original result. The Phase 6 cleanup is bounded. Remaining work is an explicit job schedule and metrics for collision/replay rates; idempotency keys must remain scoped by operation/client contract and never contain secrets.

## W. Payments

Payments have tenant, status, plan, method, reviewer, proof, and audit fields. RLS restricts tenant/admin visibility; integrity triggers and the service-side submission flow protect status/amount/proof relationships. Phase 6 adds tenant/time and status/time indexes. Payment history should be cursor-paginated and retained according to financial/legal policy. No live duplicate-rate, approval-latency, or plan evidence was available.

## X. Orders

Orders are created through atomic `submit_order`/idempotent submission, which verifies business entitlement/publication and reprices line items from current catalog data. `order_items(order_id)` supports nested reads and cascade cleanup. The tenant/time order index is present. Add cursor pagination, order-status reporting indexes only when query evidence supports them, and an archival policy before order history becomes very large.

## Y. Bookings

Bookings use public insert through a rate-limited Edge Function/RPC path, entitlement/publication checks, owner/admin reads, and an owner notification trigger. `(business_id,requested_date)` supports calendar-style access. A future dashboard usually needs `(business_id,status,requested_date)` or a similar composite; verify the actual filter/sort first. Public abuse protection is present but requires monitoring.

## Z. Reviews

Reviews are public-submitted, initially unapproved, and tenant/admin moderated through RLS. Phase 6 adds `(business_id,is_approved,created_at desc)` for the public approved feed; the existing tenant/time index remains useful for owner/moderation paths. Review spam and moderation volume are product risks; retention should normally preserve approved history and separately handle rejected spam according to policy.

## AA. Messages

Contact messages are public-submitted, rate limited, and indexed by tenant/time. Owner/admin reads use bounded explicit projections. The notification trigger adds one notification row per message. Add a stable unread/time composite only if the dashboard filters unread frequently; validate with plans first. Consider retention/archive policy for old messages and a queue if email/Telegram delivery becomes slow.

## AB. Triggers

Triggers cover profile creation/synchronization, role and block protection, tenant/subdomain validation, legal verification, public-form rate limiting, payment/order integrity, admin actor protection, and owner notifications for messages/bookings/reviews. They are appropriate for invariants but add write latency and can amplify writes. Notification triggers are small database writes; they do not call external services. Monitor trigger time and failed transaction rates.

## AC. Transactions and locking

Order creation is intentionally atomic. Rate-limit consumption locks a single bucket row. Payment duplicate protection uses a business-scoped advisory lock/constraint path. Subscription cron uses bounded reads and conditional update claims to reduce duplicate work. Cleanup functions delete bounded batches. Potential contention remains on hot rate-limit buckets and a single high-volume tenant; avoid long external calls inside database transactions.

## AD. Connections

The frontend uses one shared browser Supabase client. Edge Functions create per-invocation clients and do not create a custom pool. This is the correct low-complexity boundary for the current application, but connection saturation, pooler mode, statement timeouts, and Supabase quotas were not measurable locally. Confirm Supabase pooler/database connection settings and alert thresholds before large traffic campaigns.

## AE. Retention policy

No production retention policy was found in the repository. Recommended starting points, subject to legal/product approval: rate-limit rows after two quiet days, idempotency rows after 24 hours, verification/reset rows after expiry plus a safety interval, Telegram replay rows after the replay-protection window, page views after 90–180 days, and business/customer/financial/audit records according to contractual/legal requirements. Never apply generic deletion to payments, orders, bookings, or audit logs without an approved policy.

## AF. Cleanup

Phase 6 implements bounded, explicit cleanup functions for request/rate-limit state, page views, expired verification/reset records, and old Telegram replay records. They do not run automatically and do not delete data merely by applying the migration. A trusted scheduler/job must call them repeatedly with an approved cutoff and monitor return counts. This is a remaining operational High until scheduled and observed.

Finding: **High — cleanup scheduling is not proven**. Location: `supabase/migrations/0030_phase6_database_scalability.sql` functions are present, but no scheduler configuration/job was found in the repository. Impact: stale state can grow without bound and consume storage/index/cache resources. Fix: configure a service-role-only scheduled job outside the client path, alert on failures and backlog, and test it in staging. Priority: before sustained production growth.

## AG. Migration safety

`0030` is additive/replacement-only: it creates indexes if absent and replaces function bodies/grants. It does not change primary keys, RLS policies, columns, or existing data at migration execution time. Normal `CREATE INDEX` can hold locks during index creation; apply in staging first and use a production-safe index strategy compatible with the Supabase migration runner. Historical migration `0025` contains a deliberate password-reset-token invalidation delete; it is a one-time security migration and should not be replayed against an existing production database outside the canonical migration history.

## AH. Scalability model

At roughly 10k accounts, the current indexed tenant model and hard list bounds should be workable if cleanup and monitoring are active. Around 100k accounts, cursor pagination, raw-event retention, notification management, scheduled maintenance, and connection/slow-query dashboards become required. At 1M accounts or high concurrent public traffic, this repository alone does not establish capacity: expect read replicas or a managed scaling tier, queue-based notifications, cacheable public storefront responses, partition/aggregate strategy for analytics, stronger distributed rate limiting, and load-tested connection pooling.

## AI. Future roadmap

Recommended order:

1. Apply `0030` to a staging clone, inspect catalog grants/indexes, and run RLS/query-plan tests.
2. Schedule bounded cleanup and add metrics/alerts for stale rows, slow queries, locks, bloat, and connection saturation.
3. Add `(created_at,id)` cursor pagination to high-growth dashboard APIs and UI.
4. Aggregate or partition page-view analytics; keep raw-event retention explicit.
5. Replace sequential email/notification fan-out with a durable queue and retry/dead-letter handling.
6. Load-test public storefront reads, public writes, cron, and admin payment review against realistic Supabase quotas.
7. Revisit cache/CDN/read-replica architecture only after measurements justify it.

## AJ. Static tests

Added `supabase/functions/_shared/phase6_static_database_test.ts`. It checks the Phase 6 index names, bounded cleanup limits, service-role guards, explicit high-growth projections/limits, preserved storage/RLS hardening, absence of Phase 6 offset pagination, and bounded cron/idempotency maintenance. The test was not executed because Deno is not installed in this environment.

## AK. Dynamic tests

Added `supabase/tests/phase6_database_integration_test.ts`. When all `PHASE6_TEST_*` variables are supplied for an isolated staging project, it checks owner access to own tenant rows, cross-tenant denial, and bounded high-growth reads for orders, payments, bookings, reviews, and contact messages. It is environment-gated and was not run because no test project/tokens were provided.

## AL. Passed

- `npm.cmd run typecheck` passed.
- Repository/static inspection completed for migrations `0001`–`0030`, application query modules, Edge Function query paths, Vercel configuration, Supabase configuration, and existing Phase 0–5 artifacts.
- Phase 6 source changes are present: additive migration, explicit projections, list bounds, and regression-test files.
- No secrets were printed or added to the report.

## AM. Not executed

- `npm.cmd run build` could not complete because Vite/esbuild failed with environment-level `spawn EPERM` while loading `vite.config.ts`; TypeScript passed before that failure.
- Deno static/Edge tests: Deno is not installed.
- Vitest: not re-run in this audit; prior repository validation recorded the same environment process restriction.
- Live Supabase RLS, grants, migration application, row counts, `EXPLAIN`, `pg_stat_statements`, lock/bloat/vacuum inspection, and load testing: not executed.
- No deployment, production data mutation, or Git push was performed.

## AN. Files changed

Phase 6 files changed/added in this turn:

- `supabase/migrations/0030_phase6_database_scalability.sql`
- `supabase/functions/_shared/phase6_static_database_test.ts`
- `supabase/tests/phase6_database_integration_test.ts`
- `PHASE6_DATABASE_SCALABILITY_REPORT.md`

The worktree also contains earlier Phase 0–5 changes and reports. They were preserved and not rewritten as part of this Phase 6 audit.

## AO. Migrations

The complete migration chain inspected is `0001_schema.sql`, `0002_policies.sql`, `0003_seed.sql`, `0004_admin_rpc.sql`, `0005_fix_storage_policies.sql`, `0006_telegram.sql`, `0007_subscription_cron.sql`, `0008_storefront_pages.sql`, `0009_plan_features.sql`, `0010_bookings.sql`, `0011_ordering.sql`, `0012_reviews.sql`, `0013_email_verification.sql`, `0014_google_signin.sql`, `0015_password_reset.sql`, `0016_announcements.sql`, `0017_templates.sql`, `0020_demo_business_seed.sql`, `0021_role_security_hardening.sql`, `0022_subdomain_rules.sql`, `0023_production_security.sql`, `0024_tenant_subdomain_isolation.sql`, `0025_phase0_security_hardening.sql`, `0026_phase1_auth_security.sql`, `0027_phase2_authorization_hardening.sql`, `0028_phase3_abuse_hardening.sql`, `0029_phase4_storage_security.sql`, and new `0030_phase6_database_scalability.sql`.

There are gaps in numbering (`0018`, `0019`) but no missing migration was inferred from the repository because the chain references later migrations directly. Verify the canonical Supabase migration history before applying to production.

## AP. Remaining HIGH/CRITICAL

No Critical issue was proven by this repository audit. Remaining High items are:

1. **Live database verification absent** — catalog grants, final RLS behavior, function security settings, row counts, query plans, and capacity are unverified. Run isolated staging tests before production sign-off.
2. **Maintenance scheduling absent** — schedule the bounded Phase 6 cleanup functions with a trusted service role and monitor backlog/failures.
3. **Cursor pagination absent** — high-growth lists are bounded but not yet traversable beyond the cap; implement keyset pagination before large tenant growth.
4. **Announcement/cron fan-out is synchronous and bounded** — move high-volume delivery to a durable queue with retries and backpressure.
5. **Retention is not an automatic policy** — approve retention for analytics, replay, token, notification, and customer records and enforce it through scheduled bounded jobs.

Medium/Low follow-ups are live index-plan validation, possible redundant owner-index removal, admin wildcard projection cleanup, operational metrics, and load testing. These should be addressed according to the roadmap above; no further schema or authentication change is justified by static inspection alone.
