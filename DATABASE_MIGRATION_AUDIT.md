# AbroBiz Database and Production-Readiness Audit

Audit scope: local repository only. Canonical Supabase project configured locally: `qgbvuvxxfogcsvqzncdx`. No remote database, Auth settings, Edge Functions, Vercel settings, or migration history were changed.

## Architecture inventory

1. Frontend: React 19 with TypeScript.
2. Build system: Vite 6, with TypeScript typechecking before build.
3. Hosting configuration: `vercel.json` provides SPA rewrites and basic security headers.
4. Supabase configuration: `supabase/config.toml`; 25 ordered SQL migrations.
5. Authentication: Supabase Auth with email/password and Google OAuth; browser client uses the anon key.
6. Database schema: profiles, business categories, businesses, catalog categories/items, plans, payment methods, subscriptions, payments, Telegram links, notifications, page views, admin logs, forms, orders, reviews, verification/reset tokens, announcements, templates, and rate limits.
7. RLS: enabled across application tables and storage objects; admin/owner/public policies are migration-driven.
8. Edge Functions: email verification, password reset, announcements, template import, payment notification, Telegram webhook, and subscription cron.
9. Storage: public logos/covers/item-images buckets and private payment-proofs bucket.
10. Email: Resend is preferred, generic SMTP/Gmail is fallback; templates are in the function directories.
11. Google OAuth: `signInWithOAuth` redirects to `/setup`; provider and callback allowlists remain Supabase/Google deployment settings.
12. Environment variables: Vite public variables are client-side; service-role, mail, Resend, Telegram, and cron secrets are Edge-only.
13. Server/client boundary: browser uses anon Supabase client; privileged database access is intended for the shared Edge admin client.
14. Admin: role in `public.profiles`, protected frontend routes, RLS checks, admin RPCs, template import, announcements, payment review.
15. Roles: `admin` and `owner`; one business per owner is enforced by a unique owner key and RPC/policies.
16. Routing: React Router SPA routes plus Vercel catch-all rewrite; storefront routes also support `/r/:slug`.
17. API calls: direct Supabase REST/RPC from the browser and authenticated Edge Function calls.
18. Database queries: tenant-scoped direct queries, several security-definer RPCs, and nested admin queries.
19. Caching: no server/data cache; storefront polls every 30 seconds.
20. Error handling: friendly browser mappings exist, but several Edge handlers still return provider/database error text.
21. Security controls: RLS, security-definer search paths, role guards, token hashing, single-use reset claims, CORS allowlist, security headers.
22. Rate limiting: database-backed RPC plus public-form triggers and Edge Function limits.
23. Validation: frontend checks, slug trigger, RPC checks, manifest allowlists, and several SQL constraints.
24. Tests: Vitest suite passes; Edge/Deno tests exist but Deno is unavailable in this environment; SQL/RLS execution tests are absent.
25. Performance: indexed tenant/status/date columns, but one large browser bundle, polling, unbounded lists, and synchronous bulk email remain.

## Local repairs made

- Qualified every `pgcrypto` UUID/byte/digest call through `extensions` and made the extension schema explicit. Supabase documents that most extensions are installed under `extensions`; this directly addresses the original `gen_random_bytes(integer)` failure. See [Supabase extension documentation](https://supabase.com/docs/guides/database/extensions).
- Added final `WITH CHECK` tenant checks for public storage updates in `0002` and `0005`.
- Replaced the final item insert policy so an owner can only attach an item to a category belonging to the same business.
- Restricted payment-admin RPC execution to authenticated users and service role, while retaining in-function admin checks.
- Removed active placeholder Telebirr/CBE account numbers from production seed data.
- Removed optional `pg_cron`/`pg_net` creation from the core migration chain. They must be enabled and scheduled separately with project-specific values; Supabase lists both as managed extensions and provides separate cron/function scheduling guidance.
- Tightened final public policies so blocked businesses, catalogs, and approved reviews are not publicly readable.
- Updated local `supabase/config.toml` to the supplied canonical project reference.

## A. CRITICAL issues

- **SQL execution is not yet proven.** Location: all migrations. Docker/Postgres is unavailable, and `supabase db lint --local` fails to connect to `127.0.0.1:54322`. Impact: syntax, extension permissions, trigger compilation, RLS behavior, and migration ordering cannot be certified locally. Fix: start Docker, run the full local migration/lint/RLS test suite, then apply to the empty canonical project only after review. Priority: **Blocker**.
- **Production email/OAuth infrastructure is not verified in the canonical project.** Locations: Supabase Auth settings, Edge Function secrets, Vercel environment, Google OAuth allowlist, Resend domain. Impact: signup verification, password reset, and Google signup can fail despite passing frontend tests. Fix: verify without printing secrets: provider enabled, exact production callback, `SITE_URL`, `EMAIL_FROM`, Resend/SMTP credentials, and deployed function versions. Priority: **Blocker**.

## B. HIGH issues

- **Optional cron is operationally incomplete.** Location: `supabase/migrations/0007_subscription_cron.sql`. The schema column exists, but pg_cron/pg_net and the schedule are manual prerequisites. Impact: expiration/reminder jobs silently do not run. Fix: enable both extensions, create one schedule using the cron secret, and add an operational health check. Priority: **High**.
- **Unrestricted public file uploads.** Locations: `0002_policies.sql`, `0005_fix_storage_policies.sql`, browser upload helpers. Buckets have no migration-level size/MIME restrictions, and the client derives an extension from the original filename. Impact: storage abuse, unexpected content, cost growth, and possible unsafe downloads. Fix: enforce bucket size/MIME limits, validate content server-side, use generated safe names, and add cleanup/versioning. Priority: **High**.
- **Public form resource abuse remains possible.** Locations: `0008`, `0010`, `0012`, `0011`, `0023`. Form rate limits are identity-based and do not reliably bind to a trusted source IP; order payloads and text fields have no strong maximums. Impact: spam, oversized requests, DB growth, and expensive trigger execution. Fix: enforce trusted edge IP limits, body-size limits, maximum item count/quantity, and field lengths. Priority: **High**.
- **Email verification behavior is split between Supabase Auth and AbroBiz mail.** Locations: `src/pages/Register.tsx:34-49`, `send-verification-email/index.ts`, `supabase/config.toml`. When signup returns no session, the custom AbroBiz function is not called; the flow depends on Supabase Auth email configuration. Impact: users may receive the wrong sender/template or no usable email. Fix: choose one authoritative verification flow and test it with confirmation enabled and disabled. Priority: **High**.
- **Announcement delivery is synchronous and unbounded.** Location: `supabase/functions/send-announcement/index.ts:40-80`. It loads all owners and sends one email at a time in one invocation. Impact: timeout, provider throttling, duplicate retries, and failure at large user counts. Fix: queue recipient batches with idempotency and provider webhooks. Priority: **High**.
- **Public storefront reads were missing blocked-tenant filtering.** Locations: original `0002` select policies; final repair in `0024_tenant_subdomain_isolation.sql:51-89`. Impact: blocked tenants could remain visible through direct catalog/review queries. The final migration now closes this path, but it requires SQL execution verification. Priority: **High until verified**.

## C. MEDIUM issues

- **Rate-limit IP headers are trusted from request headers.** Location: `supabase/functions/_shared/rateLimit.ts`. A caller may rotate `x-forwarded-for`/similar headers when no trusted proxy guarantees them. Fix: use a verified platform header or edge/WAF rate limiting and retain the database limit as a second layer. Priority: **Medium**.
- **Error detail leakage.** Locations: `send-verification-email`, `send-announcement`, `notify-payment-submitted`, `import-template`. Some 500/502 responses return provider/database error text. Fix: return correlation IDs and generic public errors; keep details in structured private logs. Priority: **Medium**.
- **Profile email is a copied Auth value.** Location: `0015_password_reset.sql:20-27` and `public.profiles.email`. Drift is possible if an email changes in Auth but not in the profile copy. Fix: synchronize on Auth email-change events or use a controlled server-side lookup. Priority: **Medium**.
- **No generated Supabase database types.** Location: handwritten `src/types` plus untyped `any` row mapping. Fix: generate and commit types from the canonical schema after the first verified database build. Priority: **Medium**.
- **No CSP is configured.** Location: `vercel.json`. Existing headers are useful, but there is no Content-Security-Policy. Fix: add a tested CSP covering Supabase, Resend/browser assets as needed, fonts, images, and Google OAuth. Priority: **Medium**.
- **Dependency audit reports two moderate React Router advisories.** Locations: `package.json:20`, `package-lock.json`. Fix: upgrade to a patched compatible version, test redirects/navigation, and regenerate the lockfile. Priority: **Medium**.

## D. LOW issues

- **No `robots.txt` or sitemap was found.** Impact: weaker indexing and discoverability for public tenant sites. Fix: generate host-aware robots/sitemap behavior. Priority: **Low**.
- **Metadata is minimal.** Location: `index.html:6`. Fix: add canonical, description, Open Graph/Twitter metadata and per-tenant metadata where applicable. Priority: **Low**.
- **No explicit branded 404/error document.** Location: SPA wildcard route in `src/App.tsx`. Fix: add a user-friendly not-found/error boundary without exposing internal details. Priority: **Low**.
- **Some duplicate indexes exist.** Location: `0001_schema.sql` and `0024_tenant_subdomain_isolation.sql`. Review redundant owner/slug indexes after measuring query plans. Priority: **Low**.

## E. Performance bottlenecks

- Production bundle is approximately 871.6 kB minified / 244.1 kB gzip; Vite warns about the 500 kB chunk threshold. Use route-level dynamic imports and manual chunks.
- A storefront load performs business, categories, items, entitlements, template, category-label, and analytics requests; combine public read models or cache stable template/category data.
- Storefront polling every 30 seconds multiplies reads by open tabs. Use visibility-aware polling, ETags/cache headers, or realtime only where required.
- Admin lists are not paginated. Add cursor pagination and bounded selects.
- Page views are append-only with no retention/partition strategy.

## F. Scalability bottlenecks

- The current synchronous announcement design cannot support million-user fanout.
- Database rate-limit rows grow until purged; cleanup is not scheduled by the migration chain.
- Orders, page views, form submissions, notifications, and email events need retention/archival policies before high traffic.
- Storage URLs are public and image transformations/CDN policy are not centrally controlled.
- Repeated RLS `exists` checks are reasonable at small scale but should be measured with realistic tenant data and composite indexes.

## G. Authentication weaknesses

- Google OAuth correctness depends on exact Supabase Site URL, redirect allowlist, Google callback, and production `VITE_SITE_URL`; source code alone cannot verify this.
- Password reset is substantially hardened in `0025` (hashed, service-role-only, atomically claimed, single-use), but it still uses a six-character minimum and has no password-strength policy.
- Email verification is informational rather than a login gate; confirm this is intentional.
- There is no MFA or session/device management.
- Reset and signup behavior must be tested for enumeration resistance, resend limits, expired links, replay, and email delivery failure.

## H. Database/RLS weaknesses

- Several numeric/text fields lack database length/range constraints (prices, quantities, names, message bodies, JSON payload sizes). Add constraints only after confirming product limits.
- The one-business-per-owner model is enforced well by the unique owner key and RPC, but concurrent signup/setup must be tested against the final empty database.
- Storage policy ownership is now checked on both old and new object paths; this requires an actual RLS test.
- `purge_rate_limits` is now service-role-only, reducing unnecessary authenticated execution.
- There is no automated pgTAP or SQL integration suite for cross-tenant read/write attempts.

## I. API/Edge Function weaknesses

- Edge Functions are individually guarded, but deployed function inventory and versions must be reconciled with the repository before production use.
- Bulk email is not queued or idempotent.
- GitHub template import safely stores metadata/config rather than executing repository code, but outbound dependency availability and GitHub API quotas still need operational limits.
- Error responses and logs need correlation IDs and redaction policy.
- Public RPCs such as ordering/page-view tracking need body, array, text, and frequency limits.

## J. Infrastructure weaknesses

- Local Supabase config is aligned to the supplied canonical ref, but Vercel and Supabase environment values must be independently verified without printing secrets.
- Cron, custom auth hostname, wildcard tenant DNS, Resend domain authentication, Google OAuth, and Edge Function deployment are external prerequisites not proven by this local audit.
- `vercel.json` has baseline headers but no CSP, cache policy, or explicit static asset strategy.
- Production observability is console-based; add structured logs, alerting, function error rates, DB saturation, email bounces, and storage growth metrics.

## K. Recommended implementation phases

1. **Database gate:** start Docker, run local migrations/lint, execute RLS cross-tenant tests, verify extensions/triggers/functions, and inspect the final schema.
2. **Canonical project gate:** verify the empty project reference, Auth provider/callback configuration, Vercel public environment values, and migration dry-run procedure.
3. **Email/OAuth gate:** configure one authoritative AbroBiz verification/reset sender, verify Resend domain or SMTP, test Google signup, and test all failure paths.
4. **Security gate:** configure storage restrictions, trusted rate limiting, request/body limits, CSP, generic error responses, and structured redacted logging.
5. **Scale gate:** add pagination, cache strategy, image/CDN policy, retention/partitioning, queued email, idempotency, and load tests.
6. **Release gate:** run `typecheck`, tests, build, Edge/Deno tests in a Deno-enabled environment, SQL/RLS tests, and a staging smoke test before any production push.

## Validation evidence

- `npm run typecheck`: passed.
- `npm test`: 6 files and 39 tests passed.
- `npm run build`: passed; Vite emitted the large-bundle warning above.
- `npm audit --omit=dev --audit-level=high`: 2 moderate React Router advisories.
- Migration versions: `0001` through `0025`, unique prefixes; no unqualified crypto calls remain.
- `supabase db lint --local`: not runnable because Docker/Postgres is unavailable.

## Exact manual production configuration

These steps are intentionally not executed in this audit.

### Supabase project and database

1. Open only the canonical project `qgbvuvxxfogcsvqzncdx`.
2. Confirm the project URL is `https://qgbvuvxxfogcsvqzncdx.supabase.co`.
3. Before the first production push, enable `pgcrypto` if it is not already enabled. The migrations also explicitly create it in the `extensions` schema.
4. Enable `pg_cron` and `pg_net` from Database → Extensions. `pg_net` is enabled from the Supabase Dashboard according to the official documentation: [pg_net enablement](https://supabase.com/docs/guides/database/extensions/pg_net).
5. Run the migration chain only after Docker/local SQL validation passes. Do not mark migrations as applied manually.
6. After the schema exists, create the first admin through the normal Auth flow and promote that profile through a controlled administrator SQL operation. Do not seed an admin password or credential.

### Cron

The core migration only adds `subscriptions.reminder_sent_at`. The schedule is separate because it requires a secret and project-specific URL.

1. Set the Edge Function secret `CRON_SECRET` in Supabase, not in Vercel `VITE_*` variables.
2. Ensure the `subscription-cron` function is deployed with `verify_jwt = false`; its own code requires `Authorization: Bearer <CRON_SECRET>` and returns 503 when the secret is missing or 401 when it is wrong.
3. Schedule the function after deployment using `pg_cron` + `pg_net`. Supabase’s documented function URL pattern is `https://<project-ref>.supabase.co/functions/v1/<function-name>` and its scheduling guide recommends Vault for stored tokens: [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
4. Use Vault or another approved secret store for the cron secret. Never paste a real secret into a migration file.
5. Verify one successful invocation, one missing-secret failure, one invalid-secret failure, and that `reminder_sent_at` prevents duplicate reminders.

### AbroBiz email

The custom AbroBiz sender is used by:

- `send-verification-email` for the custom verification link.
- `request-password-reset` for password reset messages.
- `send-announcement` for admin announcements.

Set these as Supabase Edge Function secrets only:

```text
RESEND_API_KEY=<Resend secret>
EMAIL_DOMAIN=abrobiz.com
EMAIL_FROM=AbroBiz <noreply@abrobiz.com>
APP_NAME=AbroBiz
SITE_URL=https://abrobiz.com
```

Then, in Resend:

1. Add `abrobiz.com` as a sending domain.
2. Add the exact Resend-provided DNS records at the domain DNS provider.
3. Verify the domain and confirm the sender address is permitted.
4. Send a test verification and password-reset email and inspect delivery/bounce logs.

Supabase Auth’s native confirmation email is a separate path. The current register flow invokes the custom function only when signup returns a session; when Auth confirmation is enabled and no session is returned, the user receives the Supabase Auth confirmation flow instead. This must be resolved as a product/configuration choice before claiming that every signup email is sent by AbroBiz.

### Vercel

Production frontend variables must contain only public/client values:

```text
VITE_SUPABASE_URL=https://qgbvuvxxfogcsvqzncdx.supabase.co
VITE_SUPABASE_ANON_KEY=<canonical project anon key>
VITE_SITE_URL=https://abrobiz.com
VITE_PLATFORM_DOMAIN=abrobiz.com
```

Set the same public values for the intended Preview environment only when preview behavior is explicitly supported. Do not add `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, or mail passwords to Vercel `VITE_*` variables. The ignored local `.env` and `.env.test` currently use a different Supabase reference and require manual reconciliation with a matching anon key; they were not modified because the matching canonical key was not available and secrets must not be guessed.

### Google OAuth

Code configuration:

- `src/lib/authActions.ts` calls Supabase `signInWithOAuth({ provider: 'google' })`.
- Production `redirectTo` is `https://abrobiz.com/setup` when `VITE_SITE_URL=https://abrobiz.com`.
- The Google provider callback is not `/setup`; it is the Supabase Auth callback below.

Supabase Dashboard configuration:

1. Authentication → URL Configuration: set Site URL to `https://abrobiz.com`.
2. Add only the deployed application redirect URLs that are actually served, including `https://abrobiz.com/setup` and, if the `www` host is served independently, `https://www.abrobiz.com/setup`.
3. Authentication → Providers → Google: enable Google and paste the Google client ID and secret.

Google Cloud configuration:

1. Configure the OAuth consent screen and authorized domain `abrobiz.com`.
2. Add the Supabase callback URI exactly as:
   `https://qgbvuvxxfogcsvqzncdx.supabase.co/auth/v1/callback`
3. Add `https://abrobiz.com` as an authorized JavaScript origin, plus `https://www.abrobiz.com` only if it is an active application origin.
4. Do not add the `/setup` URL as the Google callback; `/setup` is the post-auth application redirect.

### Storage

In Supabase Storage, verify the four migration-created buckets and configure approved file-size and MIME limits for `logos`, `covers`, `item-images`, and `payment-proofs`. The exact limits are product decisions and are not invented in this audit. Confirm with authenticated owner/admin test accounts that cross-tenant upload, overwrite, rename, delete, and private-file reads fail.

## Final production checklist

### Database

- [x] Migration numbering is unique and sequential 0001–0025.
- [x] No duplicate migration files were found.
- [x] `pgcrypto` is explicitly enabled before first use and crypto calls are schema-qualified.
- [x] Placeholder payment accounts were removed from production seed data.
- [x] No secrets or development credentials were found in migrations.
- [ ] Empty-database migration execution is tested.
- [ ] Function/trigger/index/constraint inspection is completed against a running database.
- [ ] RLS and cross-tenant runtime tests are completed.
- [ ] Storage runtime policy tests are completed.

### Authentication

- [x] Password reset tokens are hashed, service-role-only, expiring, atomically claimed, and single-use in Phase 0.
- [x] Google post-auth redirect behavior is identified in code.
- [ ] Supabase Auth email-confirmation mode is chosen and tested against the AbroBiz custom verification flow.
- [ ] Canonical Supabase Auth and Google Cloud settings are verified manually.
- [ ] Mandatory verification, six-digit OTP, and strong-password requirements remain Phase 1 work.

### Edge Functions

- [x] Function inventory and repository secret references were audited.
- [x] Telegram webhook secret and idempotency protections remain fail-closed.
- [x] Cron secret validation remains fail-closed.
- [ ] Deno/Edge tests run in a Deno-enabled environment.
- [ ] Deployed function versions and Supabase secrets are reconciled manually.
- [ ] Request/body/file limits are added or configured where required.

### Infrastructure

- [x] Local Supabase CLI config points to the canonical project reference.
- [x] Old project references are absent from repository text outside ignored environment files.
- [ ] `.env`/`.env.test` and Vercel production values use the canonical URL and matching anon key.
- [ ] Resend domain and sender are verified.
- [ ] Cron extensions, Vault/secret storage, schedule, and health check are configured.
- [ ] Google Cloud OAuth and Supabase provider settings are configured.
- [ ] Telegram bot secrets/webhook are configured if Telegram is enabled.

### Security

- [x] No service-role key, Resend key, Telegram token, or cron secret is present in frontend source or built assets.
- [x] Tenant/RPC/storage policy repairs are preserved.
- [x] Password reset and Telegram Phase 0 hardening is preserved.
- [ ] SQL/RLS/storage behavior is verified at runtime.
- [ ] React Router moderate advisories are reviewed and patched compatibly.

## Static empty-database simulation

The following dependency chain was reviewed in order. No migration was found to reference an application table, column, function, trigger, or policy defined by a later migration. Replacements and drops are intentional final-state hardening, not accidental duplicate migrations.

| Migration | Static dependency result |
|---|---|
| 0001 | Enables `pgcrypto` in `extensions` before every UUID/byte call; creates profiles, business tables, core functions, triggers, and indexes. |
| 0002 | Depends on 0001 plus Supabase-managed `storage`; enables RLS and creates application/storage policies. |
| 0003 | Seeds only business categories and plans; no placeholder payment accounts remain. |
| 0004 | Depends on payments/subscriptions/notifications; admin RPCs are authorization-checked and explicitly granted. |
| 0005 | Replaces storage policies with corrected path checks and update `WITH CHECK` checks. |
| 0006 | Depends on profiles/businesses/plans/payment methods; creates RLS-protected Telegram tables. |
| 0007 | Depends only on subscriptions; adds the reminder column. Cron setup is external. |
| 0008 | Depends on businesses/items/notifications; adds storefront columns and contact messages. |
| 0009 | Depends on plans/businesses/subscriptions; adds feature flags and entitlement RPC. |
| 0010 | Depends on the entitlement RPC and businesses; creates bookings and notification trigger. |
| 0011 | Depends on items/businesses; creates orders/order-items and the atomic order RPC. |
| 0012 | Depends on businesses and entitlement RPC; creates reviews and notification trigger. |
| 0013 | Depends on profiles; adds email verification column/table/RPCs. |
| 0014 | Depends on `email_verified_at`; replaces the Auth profile trigger for Google users. |
| 0015 | Adds profile email before using it; creates legacy reset objects later replaced by 0025. |
| 0016 | Depends on profiles; creates admin-only announcements. |
| 0017 | Depends on profiles; creates templates and intentional built-in seed records. |
| 0018 | Depends on templates; adds built-in professional templates. |
| 0019 | Depends on templates; adds the restaurant/cafe template. |
| 0020 | Depends on 0008 business columns and seeded categories/plans; replaces business creation with demo catalog creation. |
| 0021 | Depends on businesses/categories/items/profiles; tightens owner and cross-category policies. |
| 0022 | Depends on businesses; adds lowercase/reserved-subdomain validation. |
| 0023 | Depends on form/order/Telegram tables; adds rate limiting and final update ownership checks. |
| 0024 | Depends on businesses/categories/items/reviews; adds owner lookup and final blocked-tenant policies. |
| 0025 | Depends on reset tables from 0015; invalidates legacy tokens and creates hashed service-role-only reset/Telegram RPCs. |

Static conclusion: the empty-database order is internally coherent. Supabase-managed `storage` objects and the `extensions` schema are platform prerequisites; their runtime availability is **UNVERIFIED - REQUIRES DATABASE/PROJECT EXECUTION**.

## Static RLS matrix

All 26 migration-created public tables have explicit `ENABLE ROW LEVEL SECURITY` statements. Final effective policies are summarized below; runtime enforcement remains unverified.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Own row/admin | Auth trigger/service role | Own row/admin, final check, self-role trigger | No client policy |
| business_categories | Active rows/admin | Admin | Admin | Admin |
| businesses | Owner/admin or published non-blocked public | Admin only; owner RPC | Owner/admin, owner-scope trigger, final check | Admin only |
| categories | Owner/admin or published non-blocked business | Owner/admin business match | Owner/admin with final check | Owner/admin business match |
| items | Owner/admin or published non-blocked business | Owner/admin and category belongs to same business | Same tenant/category checks | Owner/admin business match |
| plans | Active rows/admin | Admin | Admin | Admin |
| payment_methods | Active rows/admin | Admin | Admin | Admin |
| subscriptions | Business owner/admin | No client policy; RPC/service role | Admin | No client policy |
| payments | Business owner/admin | Own business and pending only | Admin | No client policy |
| business_telegram_links | Business owner/admin | Own business/admin | Own business/admin with final check | No client policy |
| admin_telegram_links | Linked admin/admin | Matching admin identity | Matching admin/admin with final check | No client policy |
| telegram_pending_actions | No client policy | No client policy | No client policy | No client policy; service role only |
| notifications | Own user/admin | Admin/trigger | Own user/admin with final check | No client policy |
| page_views | Business owner/admin | No direct policy; tracking RPC | No client policy | No client policy |
| admin_logs | Admin | Admin | No client policy | No client policy |
| contact_messages | Business owner/admin | Public only for published non-blocked business | Owner/admin with final check | No client policy |
| bookings | Business owner/admin | Public only for published non-blocked entitled business | Owner/admin with final check | No client policy |
| orders | Business owner/admin | No client policy; atomic order RPC | Owner/admin with final check | No client policy |
| order_items | Parent-order owner/admin | No client policy; atomic order RPC | No client policy | No client policy |
| reviews | Owner/admin or approved review for published non-blocked business | Public unapproved review for published non-blocked entitled business | Owner/admin with final check | Owner/admin business match |
| email_verification_tokens | No client policy | Verification RPC only | Verification RPC only | No client policy |
| password_reset_tokens | No client policy | Final service-role RPC only | Final service-role RPC only | Service role/migration only |
| announcements | Admin | Admin | No client policy | No client policy |
| templates | Active templates/admin | Admin | Admin | Admin |
| rate_limits | No client policy | Service-role RPC | Service-role RPC | Service-role purge |
| telegram_processed_updates | No client policy | Service-role claim RPC | No client policy | No client policy |

## Static RPC/security review

- `admin_approve_payment` and `admin_reject_payment`: `SECURITY DEFINER`, `search_path = public`, authenticated/service-role grants, and in-function admin/service-role authorization.
- `create_business_with_trial`: final authenticated-only grant; requires a session, one business per owner, active category, active trial, and creates demo data atomically.
- `get_business_entitlements`: `SECURITY DEFINER`, public search path, anonymous/authenticated grant, returns only published non-blocked business entitlements.
- `submit_order`: `SECURITY DEFINER`, public search path, anonymous/authenticated grant, checks published/non-blocked status and entitlement, verifies item tenant, and reprices server-side. Maximum body/item limits remain a scalability gate.
- `track_page_view`: public tracking RPC, inserts only for published businesses. It should additionally exclude blocked businesses in a later hardening pass; this does not expose tenant data.
- `create_email_verification_token`: authenticated only. `verify_email_token`: anonymous/authenticated by token proof; token table has no direct client policy.
- Legacy plaintext reset RPCs are dropped by 0025. Final reset issuance, claim, completion, and release RPCs are service-role-only and use hashed tokens, expiration, atomic claim, and single-use completion.
- `get_my_business`: authenticated only, security-definer owner lookup.
- `consume_rate_limit` and `purge_rate_limits`: service-role-only in the final migrations.
- `claim_telegram_update`: service-role-only and unique by Telegram `update_id`.
- Trigger-only functions use `SECURITY DEFINER` with `search_path = public`; direct browser data access is controlled by table RLS.

## Validation result

| Check | Result |
|---|---|
| Migration numbering and duplicate scan | PASS |
| Empty-database dependency reasoning | STATICALLY VERIFIED; Supabase-managed objects are UNVERIFIED |
| Crypto/extension ordering | STATICALLY VERIFIED; `pgcrypto` precedes first use |
| Application/schema table and RPC name scan | STATICALLY VERIFIED; no missing tables/RPCs found |
| Public table RLS enablement | STATICALLY VERIFIED for all 26 tables |
| Secret-name/source/bundle scan | PASS; no secret values exposed |
| `npm run typecheck` | PASS |
| `npm test` | PASS - 6 files, 39 tests |
| `npm run build` | PASS - large bundle warning remains |
| `npm audit --omit=dev --audit-level=high` | PASS with 2 moderate React Router advisories |
| `git diff --check` | PASS |
| Local SQL execution | UNVERIFIED - intentionally unavailable; Docker not used |
| Runtime RLS/storage tests | UNVERIFIED - REQUIRES DATABASE EXECUTION |
| Deno/Edge tests | BLOCKED - DENO UNAVAILABLE |

## Technical confidence

- Static SQL/dependency confidence: **High** for the reviewed empty-database order; not equivalent to SQL execution.
- RLS static confidence: **High** for final policy expressions and tenant paths; runtime enforcement is **UNVERIFIED**.
- Application/schema confidence: **High** for table/RPC names and migration order; row-shape and generated-type validation should follow the first controlled database build.
- Phase 0 security confidence: **High statically**; Deno runtime execution and remote secret configuration remain unverified.
- Scale confidence: **REQUIRES LOAD TESTING**. Indexes and tenant lookup paths are present, but bulk email, polling, unbounded lists, public form limits, page-view retention, and storage limits are not proven for one million users.

## Remaining blockers and manual verification

CRITICAL:

- None for the migration push decision based solely on static SQL/dependency review.

HIGH:

- Supabase-managed `storage` schema/buckets and `extensions` availability must be confirmed in the new empty project. This requires Supabase Dashboard/project execution, not Docker.
- Runtime RLS/storage tests remain unverified. They are required for security confidence but are not a static migration dependency failure.
- `.env` and `.env.test` use different Supabase references and require manual replacement with the canonical URL plus its matching anon key before frontend use. Do not guess or print the key.

MEDIUM:

- Deno Edge runtime tests are blocked because Deno is unavailable.
- Two moderate React Router advisories remain and should be patched/tested before a full application release.
- Resend, Google OAuth, Vercel, DNS, storage limits, and cron remain post-push/manual configuration tasks.

## Migration verdict

MIGRATIONS READY FOR PRODUCTION PUSH

This verdict means the 0001 through 0025 migration chain is statically ready to apply to the confirmed empty canonical Supabase project. It does not mean runtime RLS tests, Edge Functions, email, OAuth, cron, storage limits, or Vercel deployment have been completed.

## Next command

Do not execute it in this audit. After reviewing this report and confirming the canonical project is empty:

```powershell
supabase.cmd db push
```

No production push, Edge Function deployment, Vercel deployment, or remote data modification was performed.