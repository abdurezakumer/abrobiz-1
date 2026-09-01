# AbroBiz Phase 2 Authorization Security Report

Status: implemented and validated locally; production migration/function deployment and live cross-tenant verification remain manual.

## A. Tenant model

The existing canonical model is one Supabase Auth account to one business website:

Platform admin → owner account → one business → business-owned data.

The schema has no business_members, staff, products, menus, customers, or separate analytics tables. Therefore the current supported roles are platform admin and business owner; there is no implicit staff or business-admin access. The database unique constraint on businesses.owner_id and the existing subdomain uniqueness enforce one website per owner.

Public visitors can access only intentionally published storefront data. Public /r/:slug routes are discoverable by design; private owner data remains RLS-protected.

## B. Authorization model

- Supabase Auth identifies the caller.
- public.profiles.role determines platform admin versus owner.
- businesses.owner_id determines the owner relationship.
- Child rows use their business_id and an owner/business existence check.
- Orders use order_id → business_id for owner reads.
- Storage paths use business_id as their first path segment and storage policies verify the owner relationship.
- No request body, query parameter, localStorage value, or frontend role is trusted as authorization.

Business membership and staff roles are not introduced because the current product schema does not support them. Adding them would be a separate product/data-model phase.

## C. RLS audit

All application tables inspected have RLS enabled. The existing final policies provide:

- owner/admin access to private owner data;
- public access only to active/published catalog-facing rows;
- admin-only management of plans, payment methods, announcements, templates, and moderation;
- no direct client insert for orders or page views;
- no owner delete/recreate path for businesses;
- no owner writes to subscriptions or reviewed payment state.

Migration 0027 makes update policies explicit with WITH CHECK clauses so an authorized update of an old row cannot move it to another business.

## D. Tables audited

| Table | Tenant relationship | Client access |
|---|---|---|
| profiles | user-owned | own row; platform admin |
| business_categories | platform-wide reference | active public read; admin write |
| businesses | owner_id | published public read; owner/admin private read; owner/admin update with ownership trigger; admin delete |
| categories | business_id | published public read; owning owner/admin write |
| items | business_id and category_id | published public read; owning owner/admin write |
| plans | platform-wide reference | active public read; admin write |
| payment_methods | platform-wide payment instructions | active public read; admin write |
| subscriptions | business_id | owning owner/admin read; admin/service updates |
| payments | business_id | owning owner/admin read; owner pending insert; admin review |
| business_telegram_links | business_id | owning owner/admin |
| admin_telegram_links | admin_id | own/admin |
| notifications | user_id | own/admin read/update; admin insert |
| page_views | business_id | owner/admin read; rate-limited Edge Function write |
| admin_logs | admin actor | admin read/insert with actor trigger |
| contact_messages | business_id | public insert to published business; owner/admin read/update |
| bookings | business_id | public insert to published entitled business; owner/admin read/update |
| orders | business_id | public RPC insert; owner/admin read/status update |
| order_items | order_id → orders → business | owner/admin read; no client write |
| reviews | business_id | public unapproved insert; owner/admin moderation |
| email_verification_tokens | user_id | no client policies; client RPCs revoked in Phase 1 |
| password_reset_tokens | user_id | no client policies; service-role-only Phase 0 RPCs |
| telegram_pending_actions | business_id | no client policies; service-role-only webhook state |
| telegram_processed_updates | webhook replay state | service-role-only |
| announcements | platform-wide | admin read/insert |
| templates | platform-wide | active public read; admin write |
| rate_limits | platform security state | service-role-only |
| storage.objects | bucket/path tenant relationship | public assets deliberate; payment proofs private |

The schema does not contain business_members, products, menus, customers, or a separate analytics table. Their absence is a documented current-scope limitation, not an authorization bypass.

## E. Policies changed

Migration 0027 changes:

- contact_messages, bookings, orders, reviews, business_telegram_links, admin_telegram_links, and notifications update policies now have explicit tenant-preserving WITH CHECK clauses;
- payments insert policy now requires the authenticated owner, pending status, empty review fields, active non-trial plan, matching plan price/billing cycle, active payment method, and a proof path under the same business ID;
- storage bucket limits and allowed MIME types are set server-side;
- direct client execution of track_page_view is revoked.

## F. RPCs audited

- create_business_with_trial: authenticated owner path; Phase 1 database trigger requires verified email and both legal acceptances; owner uniqueness remains enforced.
- get_my_business: owner_id is derived from auth.uid().
- get_business_entitlements: public by design and returns only feature flags for a published, non-blocked business.
- submit_order: public by design, re-prices items server-side and checks published status/entitlement. Migration 0027 bounds the order to 1–50 items, limits quantities to 1–100, validates UUIDs, and caps customer text fields before insertion.
- admin_approve_payment/admin_reject_payment: platform-admin or service-role only.
- get/record rate limits: service-role only.
- password-reset RPCs: service-role only after Phase 0.
- legacy custom email verification RPCs: client execution revoked after Phase 1.
- track_page_view: service-role only after Phase 2; callable through the rate-limited track-page-view Edge Function.

SECURITY DEFINER functions use an explicit public search_path in the inspected migrations. No client-executable privileged RPC was found that accepts an owner_id and trusts it as the authorization source.

## G. Storage buckets audited

- logos, covers, item-images: public read is intentional for storefront assets; writes/updates/deletes require the business ID in the first path segment to belong to the caller or the caller to be a platform admin.
- payment-proofs: private; read and insert require the owning business or platform admin, and there is no client update/delete policy.
- Migration 0027 adds server-side size/MIME configuration: 5 MiB image assets and 10 MiB payment proofs, with PDF allowed only for payment proofs.

The remaining operational requirement is to verify the bucket configuration after migration in the production Storage dashboard.

## H. Edge Functions audited

- signup, verify-signup-otp, resend-signup-otp: pre-session Auth wrappers; server validation/rate limits; no service-role credentials.
- request-password-reset/reset-password: unauthenticated token flows; Phase 0 service-role/token protections preserved.
- import-template/send-announcement: authenticate the caller and check the database platform-admin role.
- notify-payment-submitted: now requires a valid caller session and verifies payment visibility through the caller JWT before using service-role notification work.
- send-verification-email: legacy endpoint is no longer used and its client RPC path is revoked.
- subscription-cron: secret-protected.
- telegram-webhook: secret-protected, replay-protected, and callback authorization checked.
- track-page-view: public storefront endpoint with input validation, published-business check, and 60-per-minute IP/business rate limit.

Raw internal errors are no longer returned by the audited notification, announcement, or template-import handlers.

## I. Public/private data separation

Public:

- published, non-blocked business/catalog rows;
- active plans and payment instructions;
- approved reviews;
- public contact/booking/order submission paths;
- public storefront asset buckets.

Private:

- profiles;
- unpublished/blocked owner data;
- orders and customer details;
- contact messages and bookings;
- payments and payment proofs;
- subscriptions;
- notifications;
- page views;
- admin logs;
- Telegram state;
- reset/verification state.

Some public queries still use SELECT * on tables whose current columns are intentionally storefront-safe. A future public projection/view should be considered before adding sensitive columns to those tables.

## J. IDOR findings

The client APIs accept business IDs for convenience, but database policies independently validate the relationship. getMyBusiness explicitly scopes by the Auth user. Child resources are filtered through their business relationship.

Fixed in 0027:

- update-policy tenant reassignment via old-row authorization;
- payment proof path reassignment;
- payment plan/amount/method tampering;
- order customer/total/business reassignment by an owner.

No production direct-object test was executed because there is no local/remote test database session configured in this workspace.

## K. Role escalation findings

- Self-promotion from owner to admin is blocked by the existing role trigger.
- Business ownership changes are blocked for non-admins.
- Direct legal/email verification field forgery is blocked by Phase 1.
- Admin routes and admin Edge Functions check the database role.
- Admin logs now reject a non-service caller claiming another admin as actor.

There is no business-admin/staff role to test because the current schema supports only owner and platform admin.

## L. Cross-tenant findings

The original owner-scoped model was generally sound, but several UPDATE policies did not state explicit WITH CHECK tenant predicates. Migration 0027 closes that ambiguity and adds data-integrity triggers. The expected cross-tenant result is deny for User A against Business B on SELECT, INSERT, UPDATE, DELETE, storage read/write, orders, payments, bookings, reviews, messages, notifications, and analytics.

## M. Payment-data findings

Payment proofs are private and tenant-scoped. Owners cannot read another business’s payments or proofs. Migration 0027 prevents fake plan price, billing-cycle, inactive-method, review-state, and cross-business proof-path values on submission. Platform admins remain intentionally broader.

The platform still stores payment proof files and account/payment instructions; no card data or unnecessary financial secret storage was found.

## N. Analytics findings

Page views are business-scoped for reads. Their public write path is now rate-limited through track-page-view and direct RPC execution is revoked. There is no platform analytics table beyond page_views.

Repeated RLS existence checks on page_views and other child tables may become expensive at scale; index coverage is documented below for a later performance phase.

## O. Subscription findings

Owners can read only their own business subscription and cannot insert, update, or delete subscriptions. Admin/service-role approval flows control subscription state. Payment submission now derives accepted plan price and billing cycle from the active plan row rather than trusting the client.

## P. Business slug/hostname findings

- Database trigger 0022 validates lowercase single-label slugs and reserved names.
- Lowercase uniqueness is enforced by migration 0024.
- Public storefront resolution uses the configured AbroBiz domain and rejects reserved subdomains in frontend resolution.
- /r/:slug is an intentional public preview path and remains limited by published/non-blocked RLS.
- No server-side trust of an arbitrary client business_id was added.

Because this is a Vite SPA on Vercel, hostname parsing is frontend routing rather than a server middleware authorization boundary. Supabase RLS remains the data boundary.

## Q. Indexes added

No new indexes were added in Phase 2. Existing indexes cover owner_id, business_id, category_id, order_id, slug, payment status, subscription business_id, notification user_id, page views, and the rate-limit key. New indexes should be based on production EXPLAIN plans in Phase 7.

## R. Migrations created

- supabase/migrations/0027_phase2_authorization_hardening.sql

No earlier migration was edited, production data was not reset/deleted, and ownership was not changed.

## S. Tests created

- supabase/functions/_shared/phase2_static_security_test.ts: static checks for tenant-preserving policies, payment/order integrity controls, storage limits, and safe Edge responses.
- Existing frontend guard tests updated for verified/legal-accepted accounts.
- Existing Phase 0 static security tests retained.
- Existing frontend password/auth tests retained.

## T. Tests passed

- npm.cmd run typecheck
- npm.cmd test -- --run: 7 files, 42 tests passed.
- npm.cmd run build: passed; existing large-bundle warning remains.
- git diff --check

Final Phase 2 validation was rerun after review with npm.cmd test -- --run and npm.cmd run build.

## U. Tests not executed

- Deno Edge Function tests: Deno is not installed.
- Direct database RLS tests with Business A/User A and Business B/User B: implemented in supabase/tests/phase2_rls_integration_test.ts, but not executed because no isolated test database credentials/session were provided.
- Storage API cross-tenant tests: not executed against a deployed project.
- Live production OAuth, subdomain, and payment-proof tests: not executed.

## V. Remaining HIGH/CRITICAL risks

Severity: HIGH  
Component: Production configuration  
Problem: The migration and functions are local only.  
Attack scenario: Production continues running old policies/endpoints.  
Fix: Review and deploy migration 0027/functions through the controlled release process.  
Verification: Run direct API/RLS/storage cross-tenant tests against a staging project first.  
Remaining risk: Cannot be verified from this workspace.

Severity: MEDIUM  
Component: Tenant model  
Problem: There is no business_members/staff/business-admin model.  
Attack scenario: Implementing staff features by trusting a frontend flag could create platform-wide access.  
Fix: Design a separate membership schema and policy matrix before adding staff features.  
Verification: Require membership-based RLS tests in that phase.  
Remaining risk: Current owner/admin model is safe but not multi-member capable.

Severity: MEDIUM  
Component: Public projections  
Problem: Some storefront reads use SELECT * on currently safe tables.  
Attack scenario: A later sensitive column addition becomes publicly readable.  
Fix: Introduce explicit public projections before adding sensitive business fields.  
Verification: Schema review and public API response tests.  
Remaining risk: Current columns do not contain passwords, tokens, or service secrets.

Severity: MEDIUM  
Component: Dependency security  
Problem: npm audit reports two pre-existing moderate React Router advisories.  
Attack scenario: A vulnerable router path is exploitable under an affected usage pattern.  
Fix: Upgrade React Router in a dedicated compatibility change.  
Verification: npm audit and route regression tests.  
Remaining risk: Not introduced by Phase 2.

## W. Manual production actions required

1. Review migration 0027 and deploy it to staging, then production.
2. Deploy signup, verify-signup-otp, resend-signup-otp, and track-page-view.
3. Verify all function secrets, CORS origins, and service-role configuration.
4. Confirm Storage bucket limits and MIME settings.
5. Run the Business A/Business B direct RLS and Storage matrix with test accounts.
6. Confirm the production Auth/SMTP/OAuth settings from Phase 1 remain unchanged.
7. Run npm.cmd test -- --run and npm.cmd run build in CI/release.
8. Do not declare production-ready until live cross-tenant denial tests pass.
