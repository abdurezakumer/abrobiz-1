# AbroBiz Product UX & Admin Operations Update Report

Audit and implementation date: 2026-09-19
Environment: local repository only
Production deployment: not performed
Git push: not performed
Production secrets/data: not accessed or changed

## Executive summary

The existing AbroBiz architecture was inspected before changes. This update reuses the current React/Vite application, Supabase RPC/RLS model, template registry, route guards, admin permission matrix, notification table, and Telegram connection RPC.

Implemented locally:

1. A full long-form template preview with desktop/mobile modes and real draft business data when available.
2. A controlled owner support workflow for website-address changes.
3. A permission-scoped admin Support Requests workspace for reviewing and resolving those requests.
4. Database enforcement preventing direct browser-side subdomain mutation, plus approval audit logging and owner notifications.

Existing functionality verified from source and preserved:

- Template registry, category/search filters, switching confirmation, active-template selection, and setup/settings integration.
- Real one-account Telegram disconnect RPC for business owners and administrators.
- Versioned/configurable commission rules and existing marketing dashboards.
- Existing notification center polling and read-state handling.
- Existing RLS, MFA/privileged-admin guards, audit log, storage, and route-permission architecture.

Items not claimed as complete in this scoped update are listed explicitly below.

## Architecture inspected

- Frontend: React 19, TypeScript, Vite, React Router, Framer Motion, Lucide.
- Backend: Supabase Auth, PostgreSQL, RLS, Storage, and Edge Functions.
- Tenant model: one business per owner account, one DNS label from `businesses.slug`, public storefront resolution through the existing tenant-host helpers.
- Admin model: `profiles.role`, `profiles.admin_role`, `has_admin_permission`, route guards, MFA step-up, and `admin_logs`.
- Templates: central registry plus database-backed active templates, shared `Business` data, `TemplateSelector`, and storefront renderers.
- Notifications: `notifications` table consumed by `DashboardLayout`; unread items are polled and can be marked read.
- Telegram: `disconnect_telegram_connection(kind)` RPC scopes business disconnects to the owner and admin disconnects to the signed-in administrator.
- Marketing: existing attribution, referral, team, commission-rule, ledger, and reminder tables/functions.

## Implemented changes

### 1. Full template preview — IMPLEMENTED

Files:

- `src/components/TemplatePreviewSurface.tsx`
- `src/components/TemplateSelector.tsx`

The selector’s Preview action now opens a tall, scrollable storefront-like presentation rather than a short metadata modal. It includes navigation, hero, feature highlights, services/products-style cards, gallery treatment when real gallery images exist, CTA, contact/footer, and a clear sample-preview label when no business draft is supplied.

The preview has Desktop and Mobile modes. In settings, the current draft business name, logo, cover, gallery, description, address, phone, email, accent color, and selected template configuration are used. The preview is presentation-only and does not write data or query Supabase.

### 2. Owner website-address support request — IMPLEMENTED LOCALLY

Files:

- `supabase/migrations/0051_owner_support_subdomain_requests.sql`
- `src/lib/api/support.ts`
- `src/pages/BusinessSettings.tsx`

The owner settings page now displays the current address read-only and provides a request form with optional context. The owner sees request status history. The client invokes `request_business_subdomain_change`; it does not update `businesses.slug` directly.

The migration creates `support_requests` with owner/business references, requested/current addresses, status, review metadata, and indexed status/owner lookups. Duplicate open address requests for one business are prevented by a partial unique index.

### 3. Admin support resolution workflow — IMPLEMENTED LOCALLY

Files:

- `src/pages/admin/AdminSupport.tsx`
- `src/components/AdminLayout.tsx`
- `src/App.tsx`
- `src/lib/api/adminControl.ts`
- `src/lib/api/support.ts`

Operations, Support, and Super Admin users with the appropriate permission receive a Support Requests navigation item and `/admin/support` route. The workspace supports search, status filtering, request details, approval with an optional corrected address, rejection, refresh, and clear success/error states.

Approval uses `admin_resolve_subdomain_request`, updates the business atomically, marks the request completed, inserts an `admin_logs` audit record, and inserts an owner notification. Rejection records the reviewer/note and notifies the owner.

### 4. Subdomain security control — IMPLEMENTED IN MIGRATION, NOT YET LIVE

The migration adds a database trigger that rejects direct slug changes unless the controlled approval RPC has set a transaction-local authorization marker or the caller is the service role. The existing subdomain validation trigger remains in place, including lowercase, DNS-label, reserved-name, and length validation.

This means an owner cannot bypass the support workflow by sending a direct table update from the browser. Admin approval is the only normal interactive path for changing an existing address, and the change is audited.

## Requirement classification

| Requested area | Status | Evidence / limitation |
|---|---|---|
| Reuse existing architecture and data | VERIFIED | Existing registry, `Business` model, storefront, API, RLS, route guards, and admin permission system were reused. |
| Full template preview | IMPLEMENTED | New `TemplatePreviewSurface` with real draft data, sample label, desktop/mobile modes, and long-form sections. |
| Guided owner template UX | VERIFIED / IMPROVED | Existing setup/settings selector, categories, search, recommendation marker, switch confirmation; preview is now substantially richer. |
| Save/error UX | VERIFIED | Existing settings save state, upload state, inline errors, and `friendlyError` handling remain in place. |
| Owner cannot directly change subdomain after setup | IMPLEMENTED IN MIGRATION | `0051` adds a database trigger. It must be applied to the target Supabase project before live behavior changes. |
| Owner can request subdomain change | IMPLEMENTED LOCALLY | Settings form and owner RPC/API are present. |
| Admin can validate/approve/reject subdomain requests | IMPLEMENTED LOCALLY | Admin page, scoped permission, RPC validation, atomic update, notification, and audit log are present. |
| Owner-management search | VERIFIED / PARTIAL | Existing User Directory and Businesses pages support search. A full owner detail/timeline/notes workspace was not rebuilt in this scoped pass. |
| Owner-management pagination | PARTIAL | Existing user/business list APIs use bounded limits; full cursor pagination is not added here. |
| Owner-management notes/timeline | NOT IMPLEMENTED IN THIS PASS | Existing `admin_logs` remains the audit source; no new notes system was introduced. |
| Telegram disconnect | VERIFIED | Existing `disconnect_telegram_connection` is real, account-scoped, and already used by owner/admin UI. |
| Commission rates/versioning | VERIFIED | Existing marketing commission rule schema/RPC/UI support configurable active rules and ledger records. |
| Announcement/email/Telegram fan-out | PARTIAL | Existing announcement/notification/email/Telegram systems remain; this pass adds owner in-app notifications for subdomain decisions, not a new universal fan-out pipeline. |
| Notification center | VERIFIED / IMPROVED | Existing dashboard notification polling/read state remains; new support decisions insert notifications. |
| Admin RBAC/RLS | PRESERVED / EXTENDED | Added `support.manage` to the existing operations/support client matrix and corresponding migration function. Existing MFA and route guards remain required. |
| Production deploy | NOT PERFORMED | Explicitly excluded. |
| Git push | NOT PERFORMED | Explicitly excluded. |

## Security review of changes

- No secret values were printed or edited.
- No production data was queried or mutated.
- Owner-provided `owner_id`, reviewer identity, status, and business slug are not trusted from the browser.
- Owner request creation derives ownership from `auth.uid()` and verifies the business owner server-side.
- Admin resolution checks privileged MFA-backed permissions in the database function.
- Approved slug values are normalized and checked against the DNS-label/reserved-name rules and existing businesses.
- Direct slug updates are blocked by a database trigger outside the controlled approval transaction.
- The approval actor and target request are written to `admin_logs`.
- Owner-facing request reads are scoped by RLS; admin reads require support/business-management permission.
- The template preview is presentation-only and does not access private data or bypass RLS.

## Validation completed

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test -- --run` | Passed — 13 files, 138 tests |
| `npm.cmd run lint` | Passed — 0 errors, 9 existing warnings |
| `npm.cmd run build` | Passed — Vite production build completed |
| Production deployment | Not run |
| Git push | Not run |
| Supabase migration apply | Not run |

The initial `npm run typecheck` command could not run because this Windows environment blocks `npm.ps1`; the equivalent `npm.cmd` command passed.

## Required manual rollout checks

Before using this in production, an authorized operator should:

1. Review `0051_owner_support_subdomain_requests.sql` in a staging Supabase project.
2. Apply the migration through the approved Supabase migration process.
3. Confirm the migration creates the table, indexes, policies, functions, and trigger successfully.
4. Test with an owner account that the current address is read-only and an address request is created.
5. Test duplicate open requests, reserved names, invalid labels, and an already-used subdomain.
6. Test Support and Operations admin access after MFA step-up; verify unauthorized roles cannot list or resolve requests.
7. Approve one request and verify the business slug, public storefront URL, owner notification, and `admin_logs` entry.
8. Reject one request and verify the owner sees the rejection note and notification.
9. Test the preview at 320px, 390px, 768px, and desktop widths with both real and incomplete business data.
10. Confirm the final approved DNS/Vercel wildcard routing remains configured for `*.abrobiz.com`.

No production migration, deployment, GitHub push, secret change, or production-data operation was performed in this task.
