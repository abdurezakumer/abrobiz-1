# AbroBiz production migration checklist

Audit date: 2026-09-01  
Scope: repository-only review for the canonical production project `qgbvuvxxfogcsvqzncdx`.  
Important: this is a checklist, not an instruction to run migrations automatically. The linked Supabase migration history and live database were not queried in this audit.

## Gate before applying anything

1. Confirm that Vercel, Supabase Edge Functions, Auth, Storage, and scheduled jobs all use the same canonical project. The local `.env` currently references the old project `ckawqslkbanqolbvdpgf`; do not use it for production.
2. Export a fresh database backup and record its timestamp, retention, and restore owner.
3. Compare `supabase migration list` against the remote migration history. Apply only missing migrations, in numeric order, once.
4. Preflight duplicate owners/slugs and existing invalid rows before 0024/0028/0029 constraints.
5. Verify that invalidating legacy password-reset tokens in 0025 is acceptable to support and users.
6. Deploy Edge Functions and run the smoke plan after the database is confirmed.

## Ordered migration inventory

| Migration | Purpose | Safe to apply | Required | Status |
|---|---|---|---|---|
| 0001_schema.sql | Base profiles, businesses, catalog, plans, subscriptions, payments, logs, indexes, core RPCs | Only on a database without these objects and after backup | Yes | CONDITIONAL — remote history unknown |
| 0002_policies.sql | Initial RLS, policies, and storage buckets | Only after 0001 | Yes | CONDITIONAL — remote history unknown |
| 0003_seed.sql | Idempotent reference plans, methods, and categories | Review existing natural keys first | Yes | CONDITIONAL — remote data unknown |
| 0004_admin_rpc.sql | Admin payment approval/rejection RPCs | Review admin role bootstrap first | Yes | CONDITIONAL — remote history unknown |
| 0005_fix_storage_policies.sql | Replaces unsafe/ambiguous storage policies | Yes after 0002, policy diff review required | Yes | CONDITIONAL — remote history unknown |
| 0006_telegram.sql | Telegram links and supporting RLS | Yes after 0001 | If Telegram is enabled | CONDITIONAL — feature state unknown |
| 0007_subscription_cron.sql | Subscription reminder field | Yes; scheduler is separate | If billing reminders are enabled | CONDITIONAL — scheduler not verified |
| 0008_storefront_pages.sql | Pages, contact messages, notifications, gallery/featured fields | Yes after 0001 | Yes for current UI | CONDITIONAL — remote history unknown |
| 0009_plan_features.sql | Plan feature flags and entitlements | Yes after plans exist | Yes for feature gating | CONDITIONAL — remote history unknown |
| 0010_bookings.sql | Bookings and booking notifications | Yes after 0001 | If bookings are enabled | CONDITIONAL — remote history unknown |
| 0011_ordering.sql | Orders, order items, and server-side repricing | Review existing order data and RPC names | If ordering is enabled | CONDITIONAL — remote history unknown |
| 0012_reviews.sql | Reviews, moderation fields, and RLS | Yes after businesses exist | If reviews are enabled | CONDITIONAL — remote history unknown |
| 0013_email_verification.sql | Legacy custom verification token system | Historical only; later security migration revokes it | No direct rollout action | MANUAL — do not revive legacy flow |
| 0014_google_signin.sql | Google provider profile trigger support | Review Auth provider configuration separately | If Google sign-in is enabled | CONDITIONAL — dashboard not verified |
| 0015_password_reset.sql | Legacy reset token flow later superseded | Historical only; do not re-enable legacy functions | No direct rollout action | MANUAL — superseded by 0025 |
| 0016_announcements.sql | Admin announcements and recipient records | Yes after profiles/businesses | If announcements are enabled | CONDITIONAL — remote history unknown |
| 0017_templates.sql | Template metadata and GitHub repository metadata | Review admin template rows | Yes for template UI | CONDITIONAL — remote history unknown |
| 0018_professional_templates.sql | Professional template records | Seed review required | Yes for current template catalog | CONDITIONAL — remote data unknown |
| 0019_restaurant_cafe_template.sql | Restaurant/café template record | Seed review required | Yes for demo template | CONDITIONAL — remote data unknown |
| 0020_demo_business_seed.sql | Demo business/catalog creation RPC and data | Confirm no production demo collision | If demo is required | CONDITIONAL — remote data unknown |
| 0021_role_security_hardening.sql | Owner/admin role and tenant-preserving policies/triggers | Review existing role values before apply | Yes | CONDITIONAL — critical RLS gate |
| 0022_subdomain_rules.sql | Slug validation and reserved subdomains | Preflight conflicting slugs | Yes | CONDITIONAL — reserved-list drift exists |
| 0023_production_security.sql | Rate-limit state, form triggers, stricter write checks | Review current write volume and policies | Yes | CONDITIONAL — remote state unknown |
| 0024_tenant_subdomain_isolation.sql | Unique owner/slug indexes, owner lookup RPC, public visibility rules | **Not blindly**; duplicate preflight required | Yes | HIGH MANUAL — can fail on existing duplicates |
| 0025_phase0_security_hardening.sql | Hashes reset tokens, removes plaintext legacy token column, service-role claims, invalidates old reset tokens | **Not blindly**; backup and support notice required | Yes for phase 0 security | HIGH MANUAL — destructive data transition |
| 0026_phase1_auth_security.sql | Legal acceptance, auth/profile synchronization, trigger hardening | Review existing profiles and legal-version policy | Yes | CONDITIONAL — remote state unknown |
| 0027_phase2_authorization_hardening.sql | Tenant-preserving updates, payment/order/admin-log protections | Review current policies and RPC callers | Yes | CONDITIONAL — critical RLS gate |
| 0028_phase3_abuse_hardening.sql | Idempotency, service-role mutation paths, URL/length checks, owner rate limits | Preflight `NOT VALID` constraints and existing rows | Yes | HIGH MANUAL — constraints are not yet validated |
| 0029_phase4_storage_security.sql | Revokes direct browser writes, path-scoped policies, payment-proof checks | Confirm existing object paths and client upload path | Yes | HIGH MANUAL — storage access regression risk |
| 0030_phase6_database_scalability.sql | Performance indexes and bounded service maintenance functions | Review index build impact and maintenance schedule | Yes | CONDITIONAL — remote history/performance unknown |

## Required post-migration evidence

- Remote migration history contains every intended migration exactly once.
- RLS is enabled on every tenant and security-sensitive table; no unexpected permissive policy remains.
- Duplicate owner/slug preflight is empty; all `NOT VALID` constraints have a tracked validation plan.
- Auth redirect URLs, email templates, custom Auth domain, and Google provider settings point to AbroBiz.
- Storage bucket visibility and object policies match the current upload functions.
- Edge Functions compile and deploy; `telegram-webhook` duplicate imports are resolved before deployment.
- `PRODUCTION_SMOKE_TEST_PLAN.md` passes with sanitized evidence.
- Backup restore test and rollback owner are recorded.

## Per-migration safety details

The table below supplies the execution details required for each migration. `No` means no intentionally destructive operation was found in static review; it does not mean a migration is risk-free. Apply only after confirming the remote history.

| Migration | Dependencies | Destructive operation? | Required before production? | Verification method |
|---|---|---|---|---|
| 0001 | None | No; creates base objects | Yes | Tables, triggers, indexes, and function privileges exist |
| 0002 | 0001 | No; creates/replaces policies and buckets | Yes | RLS enabled and policy matrix reviewed |
| 0003 | 0001 | No; idempotent seed | Yes | Natural-key seed rows present once |
| 0004 | 0001–0003 | No; replaces admin RPCs | Yes | Non-admin denied; admin transition succeeds in staging |
| 0005 | 0002 | No; drops/recreates storage policies | Yes | Bucket access matrix and private proof denial |
| 0006 | 0001 | No | If Telegram enabled | Link RLS and token flow test |
| 0007 | 0001 | No | If reminders enabled | Column exists; scheduler separately verified |
| 0008 | 0001 | No | Yes for current UI | Page/contact/notification rows and policies |
| 0009 | 0001/0003 | No | Yes for entitlements | Public entitlement RPC exposes only feature flags |
| 0010 | 0001 | No | If bookings enabled | Booking RLS and owner notification test |
| 0011 | 0001/0003 | No | If ordering enabled | Repricing and order integrity test |
| 0012 | 0001 | No | If reviews enabled | Review moderation/RLS test |
| 0013 | 0001 | No; legacy token tables/functions | No; historical dependency | Confirm later revocation and no client execution |
| 0014 | 0001 | No; auth trigger replacement | If Google enabled | Provider-created profile test |
| 0015 | 0001/0013 | Yes in later 0025 transition; legacy flow itself is superseded | No direct rollout action | Confirm functions are revoked after 0025 |
| 0016 | 0001/0008 | No | If announcements enabled | Admin-only creation and recipient scope |
| 0017 | 0001 | No | Yes for templates | Admin metadata policy and URL validation |
| 0018 | 0017 | No; seed/updates only | Yes for catalog | Template rows and active flags |
| 0019 | 0017/0018 | No; seed/updates only | Yes for café demo | Demo template loads safely |
| 0020 | 0001/0003/0017 | No; demo inserts via guarded RPC | If demo required | One-business-per-owner and demo isolation |
| 0021 | 0001 | No; drops/replaces policies/triggers | Yes | Owner/admin cross-tenant matrix |
| 0022 | 0001 | No; replaces validation function | Yes | Reserved/malformed/duplicate slug tests |
| 0023 | 0001 | No; adds rate-limit state and policies | Yes | Rate-limit RPC service role only; form burst test |
| 0024 | 0001/0021/0022 | No intentional delete; unique indexes can fail on duplicates | Yes | Duplicate preflight, index validity, public visibility test |
| 0025 | 0015/0023 | **Yes**; deletes legacy reset tokens and drops legacy token column | Yes for current reset security | Backup, row count record, function grants, reset replay test |
| 0026 | 0013/0015/0025 | No; replaces triggers and revokes legacy execution | Yes | Legal/auth synchronization and grants |
| 0027 | 0021–0026 | No; replaces policies/functions and revokes execution | Yes | Payment/order/admin-log tenant tests |
| 0028 | 0023/0027 | Bounded cleanup deletes expired request state; adds `NOT VALID` constraints | Yes | Constraint preflight/validation, idempotency replay, URL tests |
| 0029 | 0027/0028 | No; drops/recreates storage policies | Yes | Private/public bucket matrix and object-path tests |
| 0030 | 0023/0025/0028 | Bounded retention deletes in service-only purge functions | Yes | Index usage, purge bounds, service-role-only execution |

## Static SQL audit result

- `SECURITY DEFINER` functions were found throughout the history. The reviewed definitions set `search_path = public`; later migrations revoke broad execution for sensitive functions and grant service-role or authenticated execution as appropriate.
- Historical 0013/0015 public execution grants are intentionally superseded by later revokes. Verify the final remote privilege state rather than relying on migration text alone.
- No `DROP TABLE`, `TRUNCATE`, or RLS-disable statement was found. 0025's unbounded-looking reset-token delete is intentional and must be treated as a destructive transition. Cleanup functions in 0028/0030 are bounded by expiry/limit parameters and must remain service-role-only.
- Remote function privileges, trigger order, `NOT VALID` constraint validation, and actual policy state remain **NOT VERIFIED** without canonical-project database access.
