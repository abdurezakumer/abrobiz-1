# AbroBiz Final Production Security Verification

Date: 2026-09-16  
Scope: live AbroBiz frontend, linked Supabase project/function metadata, repository source, public HTTP surfaces, and safe unauthenticated checks  
Method: read-only/controlled verification. No accounts, roles, customer records, payments, commissions, referrals, secrets, policies, or migrations were changed during this verification pass.

## Final classification

### READY FOR FINAL HUMAN SECURITY REVIEW

The deployed baseline is healthy and the source-level controls are present, but the required authenticated test matrix cannot be completed without dedicated test identities and safe test records. No critical/high vulnerability was newly discovered in the available evidence. The application must not be labeled fully security-verified until the remaining controlled tests below are completed.

## Deployment

- Repository commit: `af893b8` (`main`, `origin/main`) — `Harden authentication and document security audit`.
- Live frontend: HTTP 200 from `https://abrobiz.com/`; Vercel response identifies the server as Vercel and exposes a deployment ID, but not a source commit ID.
- Live asset: `/assets/index-CBaDoPpx.js`.
- Local audited build asset is named differently because Vercel generates its own build hash. The live asset contains the audited `abrobiz-auth-token`, Google nonce, and `/security/mfa` markers. Exact source-to-build cryptographic correspondence is not exposed by the public response and remains a human-release-process check.
- Migration status: `0050_full_security_remediation.sql` is present remotely; linked migration list shows local and remote through `0050`.
- Edge Functions: all 23 local functions are listed `ACTIVE` remotely after deployment.
- Health: `https://qgbvuvxxfogcsvqzncdx.supabase.co/functions/v1/health` returned HTTP 200 with database readiness `ok`.
- Protected endpoint: unauthenticated POST to `storage-signed-url` returned HTTP 401 with `UNAUTHORIZED_NO_AUTH_HEADER`.

## Authentication

### Password login

- Implemented by `src/pages/Login.tsx` -> `src/lib/authActions.ts` -> `login` Edge Function -> Supabase `signInWithPassword`.
- The returned Supabase session is installed with `supabase.auth.setSession`.
- Login has input validation, per-IP/account limits, and Turnstile policy.
- Dedicated credential runtime test: **NOT VERIFIED**; no approved test account was available.

### Signup/OTP

- Implemented by `Register.tsx` -> `signup` Edge Function -> Auth signup OTP generation -> AbroBiz mailer -> `verify-signup-otp` -> `setSession`.
- Signup requires terms/privacy acceptance, password policy, body limits, rate limits, and Turnstile policy.
- Signup response is generic and does not return a user record or OTP length.
- Dedicated signup/OTP receive/verify/replay runtime test: **NOT VERIFIED**; no approved test account/mailbox was available.

### Password reset

- `request-password-reset` returns a generic response, creates a server-side reset record, and sends the email through the server mailer.
- `reset-password` claims the hashed token atomically, updates the Auth password, and consumes the token.
- Password reset one-time/replay/expiry/new-password runtime test: **NOT VERIFIED**; no approved test account/mailbox was available.
- Residual: reset token is placed in the URL query string while the reset page is open. Keep query strings out of analytics/proxy logs and consider a short-lived exchange code in a future hardening phase.

### Google OAuth

- Current frontend flow is Google Identity Services popup credential -> Google ID token + nonce -> Supabase `signInWithIdToken`.
- Nonce generation and forwarding are present in `src/lib/authActions.ts` and live bundle markers are present.
- No Google client secret is shipped in the frontend source or public bundle scan.
- Dedicated Google account login/logout/invalid-token/nonce runtime test: **NOT VERIFIED**; no approved test Google account was available.

### Logout

- Dashboard/admin/MFA UI calls `supabase.auth.signOut()` through `AuthProvider`.
- Installed Auth SDK default scope is global: local session storage is removed and refresh sessions are revoked where supported.
- Supabase access JWTs cannot be retroactively revoked before their expiry. This is an architectural residual, not by itself evidence of a critical vulnerability.
- Same-tab, multi-tab, other-device, and post-expiry runtime tests: **NOT VERIFIED** without a dedicated account.

### Session expiration

- `persistSession: true` and `autoRefreshToken: true` are configured in `src/lib/supabaseClient.ts`.
- Privileged browser sessions have a 30-minute client inactivity sign-out in `src/lib/authContext.tsx`.
- Exact production JWT lifetime, refresh rotation/reuse, absolute session lifetime, and password-change revocation settings: **NOT VERIFIED — dashboard confirmation required**.

### MFA

- Privileged route guards require `aal2` when the profile is an administrator.
- Migration `0050` requires `aal2` in server-side permission functions.
- MFA setup uses Supabase TOTP enrollment/challenge/verification in `src/pages/MfaSetup.tsx`.
- AAL1 denial, AAL2 success, recovery, and direct API MFA tests: **NOT VERIFIED**; no dedicated privileged test administrator was available.

## Authentication test accounts

The required dedicated accounts were not available in the local environment:

- Account A — owner/tenant A: **MISSING / NOT VERIFIED**
- Account B — owner/tenant B: **MISSING / NOT VERIFIED**
- Account C — sales person: **MISSING / NOT VERIFIED**
- Account D — marketing admin: **MISSING / NOT VERIFIED**
- Account E — super admin test administrator: **MISSING / NOT VERIFIED**

No privileged production account was created automatically.

## Authorization

### Owner

- UI routes use `RequireOwner`.
- Business lookup explicitly scopes by `owner_id = auth.uid()`.
- Database policies and owner/business relationships are present.
- Direct cross-tenant owner test: **NOT VERIFIED** without Accounts A and B.

### Sales Person

- UI permission matrix limits access to marketing/referral/commission views.
- Database permission matrix and marketing attribution policies are present in migration `0050` and prior marketing migrations.
- Direct attempts to approve payments, alter commissions, access unrelated customers, or access private storage: **NOT VERIFIED** without Account C.

### Marketing Admin

- UI permission matrix allows marketing workspace/referrals/commissions/reminders only.
- Database permission matrix is explicit and requires privileged MFA assurance.
- Out-of-scope operation tests: **NOT VERIFIED** without Account D.

### Super Admin

- Super-admin route and role-assignment RPC exist.
- Role changes are protected by database triggers/RPC and audit logging.
- MFA-protected privileged operation test: **NOT VERIFIED** without Account E.

Client-side role or localStorage edits are not treated as the authorization boundary. Server authorization and RLS are the intended boundary.

## Tenant Isolation

- `auth.uid()`, `businesses.owner_id`, tenant relationships, RLS, Edge Function checks, and storage path validation are present.
- Migration `0050` is now applied remotely, so the final policy source is deployed.
- Cross-account RLS tests for businesses, settings, profiles, orders, bookings, reviews, messages, payments, commissions, referrals, notifications, and private data: **NOT VERIFIED** because Accounts A/B and safe records were unavailable.
- IDOR substitution tests for business/user/order/booking/payment/customer/commission/referral/notification IDs: **NOT VERIFIED**.
- One safe unauthenticated protected endpoint check passed with HTTP 401.

## Storage

- Public branding buckets are handled through `storage-upload` with business ownership or explicit business-management permission.
- Payment proofs are handled as private objects; signed URLs are generated only after owner or `payments.read` authorization.
- Upload body limits, UUID/path validation, magic-byte checks, and rate limits are present.
- Live unauthenticated signed-URL request: **DENIED — HTTP 401**.
- Owner A/B, sales, marketing, super-admin, direct private URL, signed URL, manipulated path, and traversal tests: **NOT VERIFIED** without dedicated identities and test files.

## Payments

- Payment submission is protected by authenticated Edge Function access and server-side plan/payment-method/proof-path validation.
- Direct client-side payment status/commission writes are restricted by the deployed migration and trusted workflow design.
- Payment amount/status/salesperson/marketing-admin/commission manipulation tests: **NOT VERIFIED**; no sandbox payment record was available.
- Duplicate callback/idempotency and verified-payment commission trigger tests: **NOT VERIFIED**.

No real customer payments, commissions, or referrals were modified.

## Browser Security

- Auth storage is `localStorage['abrobiz-auth-token']`, containing Supabase session information including access/refresh token material and user/session metadata.
- No password, service-role key, Resend secret, Telegram bot token, Gemini secret, or Turnstile secret was found in the deployed HTML/JavaScript bundle scan.
- Public bundle scan: one JS asset inspected, zero detected private-secret pattern hits, zero source-map references in HTML.
- React escaping is the normal rendering path; no production source dangerous HTML/eval sink was found in the reviewed scan.
- XSS runtime payload tests through user fields: **NOT VERIFIED** without a dedicated test business. Because tokens are localStorage-readable, any future same-origin XSS would have high token impact.

## Infrastructure

- HTTPS: verified. `http://abrobiz.com/` redirects with HTTP 308 to HTTPS.
- HSTS: live `Strict-Transport-Security` with `includeSubDomains`.
- CSP: live with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, restricted script sources, and `upgrade-insecure-requests`.
- X-Content-Type-Options: live `nosniff`.
- X-Frame-Options: live `DENY`.
- Referrer-Policy: live `strict-origin-when-cross-origin`.
- Permissions-Policy: live camera/microphone/geolocation disabled.
- COOP: live `same-origin-allow-popups`.
- CORP: live `cross-origin`.
- DNS prefetch: live `off`.
- CORS production origin: allowed for `https://abrobiz.com` and `https://www.abrobiz.com`.
- CORS localhost origin: no `access-control-allow-origin` header.
- CORS unknown origin: no `access-control-allow-origin` header.
- `robots.txt`: HTTP 200, `text/plain`.
- `sitemap.xml`: HTTP 200, `application/xml`.

## Automated Tests

- `npm.cmd test -- --run`: **13 test files, 138 tests passed**.
- `npm.cmd run typecheck`: **passed** through the production build.
- `npm.cmd run lint`: **0 errors, 9 warnings**. Warnings are existing Fast Refresh and React Hook dependency warnings.
- `npm.cmd run build`: **passed** with Vite 6.4.3; no chunk-size warning.
- `npm.cmd audit`: **0 vulnerabilities**.
- `npm.cmd run security:secrets`: **passed for 305 tracked files**.
- `git diff --check`: **passed**; only normal Windows line-ending warnings were emitted.

## Vulnerabilities/discovered residuals

No new critical/high exploitable vulnerability was demonstrated by the safe live checks. The following warnings remain:

1. Browser sessions use localStorage, so a future XSS could read bearer tokens. Severity: High impact if XSS occurs; no XSS sink was found in the reviewed source.
2. Already-issued access JWTs remain valid until expiry after logout. Severity: Medium architectural residual; mitigate with short JWT lifetime and MFA/reauthentication for high-risk actions.
3. Production Supabase JWT/refresh/session settings were not readable from the local environment. Severity: Medium verification gap.
4. Authenticated cross-tenant, IDOR, role, MFA, payment, referral, reset, and XSS runtime tests remain pending dedicated test identities/safe records. Severity: High verification gap, not a demonstrated vulnerability.
5. CSP retains `style-src 'unsafe-inline'` and broad HTTPS media allowances. Severity: Low residual.

## Remaining manual checks

1. In Supabase Auth settings, record JWT/access-token lifetime, refresh-token rotation/reuse, session lifetime, inactivity settings, MFA policy, and password/email-change session behavior.
2. Provision temporary, non-customer Accounts A-E in a non-production or explicitly isolated production test environment. Do not create them automatically in this repository.
3. Run the full owner A/B cross-tenant and IDOR matrix directly through authenticated REST/Edge Function requests.
4. Enroll the privileged test administrator in TOTP; verify AAL1 denial, AAL2 success, recovery, and direct API enforcement.
5. Run controlled Google OAuth, signup/OTP, password reset, logout, and post-expiry tests with dedicated mailboxes/accounts.
6. Use only a payment sandbox or isolated test payment to verify amount/status/commission/referral integrity and idempotency.
7. Run harmless XSS payloads through isolated test business fields and verify text rendering/no execution.
8. Confirm Cloudflare overwrites the trusted client-IP header and that direct-origin paths cannot spoof it.
9. Verify deployed Vercel build metadata against commit `af893b8` in the release dashboard, since the public HTML does not expose the commit.

## Conclusion

The deployment, migration, functions, headers, CORS, public crawler files, health endpoint, unauthenticated denial, local tests, dependency audit, and bundle secret scan all passed. The required authenticated security matrix was not run because the necessary dedicated accounts and safe records were unavailable. Therefore the correct final classification is:

### READY FOR FINAL HUMAN SECURITY REVIEW
