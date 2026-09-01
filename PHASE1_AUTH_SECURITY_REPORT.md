# AbroBiz Phase 1 Authentication & Account Security

Status: implemented locally; production configuration and migration/function deployment are still manual.

## A. Architecture

- React 19 + Vite frontend uses @supabase/supabase-js browser sessions.
- Supabase Auth remains authoritative for users, passwords, email confirmation, OTPs, OAuth, JWTs, refresh tokens, and logout.
- Edge Function wrappers add server-side validation and rate limits before selected Auth calls.
- Postgres RLS remains the authorization boundary. Migration 0026_phase1_auth_security.sql adds legal-consent and verified-email gates without changing the existing tenant model.

## B. Signup

- src/pages/Register.tsx now requires email, name, phone, separate Terms acceptance, and separate Privacy acceptance.
- supabase/functions/signup/index.ts validates the same inputs server-side, applies the password policy, rate-limits by IP plus normalized email, and calls supabase.auth.signUp.
- Signup responses are generic for duplicate/unknown accounts to reduce email enumeration.
- The Edge Function validates both legal choices, and the authenticated post-OTP acceptance RPC records the timestamps/version. The database still requires legal acceptance before business creation.

## C. Email OTP verification

- verify-signup-otp calls Supabase Auth verifyOtp({ type: 'signup' }); it does not store or log OTPs.
- OTP input is six separate accessible fields with paste, keyboard navigation, numeric mobile input, loading state, expiry/invalid feedback, and resend countdown.
- resend-signup-otp calls Supabase Auth resend({ type: 'signup' }), with generic responses and IP/email rate limiting.
- Supabase Auth controls OTP generation, expiry, one-time use, and its own abuse controls. Configure the production OTP expiry to a short value such as 600 seconds.
- The previous custom verification-link functions are revoked for client roles and are no longer used by the frontend.

## D. Password policy

- New signup and reset passwords must be 12–128 characters and include lowercase, uppercase, digit, and special character.
- No password truncation is performed.
- src/lib/passwordPolicy.ts provides the five-level indicator: Very weak, Weak, Fair, Strong, Very strong.
- The same validation is enforced in the reset Edge Function. Configure the same requirements in Supabase Auth so direct Auth API calls cannot bypass the frontend/Edge wrapper.

## E. Login

- Login continues to use Supabase Auth signInWithPassword.
- Unconfirmed email responses are routed to OTP verification.
- Invalid credentials remain generic.
- Supabase Auth attack protection remains active for direct login API calls.

## F. Forgot/reset password

- The existing Phase 0 hashed, expiring, single-use, atomically claimed reset flow is preserved.
- Reset now uses the Phase 1 password policy.
- Forgot-password responses remain generic and do not reveal account existence.

## G. Google OAuth

- Existing Supabase Google OAuth remains in place; no custom OAuth token or account system was added.
- New Google accounts are verified through the provider/profile trigger.
- New Google accounts without a legal-consent record are routed to /legal-acceptance before setup.
- The existing Supabase Auth redirect allow-list and Google Cloud callback must be configured manually for abrobiz.com.

## H. Sessions

- Browser persistence, automatic refresh, onAuthStateChange, setSession, and signOut remain Supabase-supported mechanisms.
- No custom JWTs or localStorage authentication flags were introduced.
- Protected routes now require a session, verified profile state, legal acceptance, and the appropriate role/business.

## I. Rate limiting

- Signup: 5 requests per 15 minutes per IP/email bucket.
- OTP verification: 8 attempts per 15 minutes per IP/email bucket.
- OTP resend: 3 requests per 15 minutes per IP/email bucket, plus Supabase Auth’s resend cooldown.
- Password reset and reset completion retain the existing Phase 0/production limits.
- Supabase Auth’s own login/OTP attack protection remains an additional layer.

## J. Migration

- New migration: supabase/migrations/0026_phase1_auth_security.sql.
- Adds terms_accepted_at, privacy_accepted_at, and legal_version.
- Synchronizes profiles.email_verified_at from auth.users.email_confirmed_at.
- Prevents direct self-editing of legal fields.
- Adds record_legal_acceptance(...), which is the only client path that records consent.
- Adds a database trigger requiring verified email and legal acceptance before business creation.
- No old migration was rewritten and no destructive schema reset was used.

## K. Edge Functions changed/added

Added:

- signup
- verify-signup-otp
- resend-signup-otp

Changed:

- reset-password now enforces the strong password policy.
- supabase/config.toml explicitly marks the three pre-session endpoints as verify_jwt = false.

## L. Frontend changed

- Signup form and separate legal checkboxes.
- Password-strength indicator.
- OTP verification page.
- Legal acceptance page for OAuth/existing accounts missing consent.
- Route guards for verification, legal consent, role, and one-business ownership.
- Login handling for unverified email.
- Reset-password policy and strength feedback.
- Dashboard resend action uses the Auth OTP resend endpoint.

## M. Tests passed

- npm.cmd run typecheck
- npm.cmd test -- --run: 7 files, 42 tests
- npm.cmd run build
- git diff --check

The production build still reports the existing large main bundle warning: approximately 880 kB minified and 246 kB gzip. This is not part of Phase 1 scope.

## N. Not executed

- Deno is not installed in this workspace, so Edge Function Deno tests were not executed.
- No remote Supabase migration push was executed.
- No Edge Function deployment was executed.
- No production email delivery, OAuth callback, or live OTP test was executed.

## O. Environment/secrets

Frontend/Vercel:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- optional branded VITE_SUPABASE_AUTH_URL
- VITE_SITE_URL=https://abrobiz.com
- VITE_PLATFORM_DOMAIN=abrobiz.com

Supabase Edge Function secrets:

- automatic SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
- CORS_ORIGINS=https://abrobiz.com,https://www.abrobiz.com
- SITE_URL=https://abrobiz.com
- APP_NAME=AbroBiz
- existing Phase 0 secrets and Resend/mail secrets as applicable

Never put SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, SMTP passwords, webhook secrets, or Google client secrets in Vite variables.

## P. Manual Supabase configuration

1. Confirm the production project is the canonical AbroBiz project.
2. Enable Email provider and turn Confirm email on.
3. Set password minimum length to 12 and require lowercase, uppercase, digit, and symbol. Do not enable an external compromised-password check unless that policy is explicitly approved.
4. Set Email OTP expiration to approximately 600 seconds and keep the Auth resend cooldown enabled.
5. Configure Supabase Auth SMTP through Resend using a verified abrobiz.com sending domain.
6. Update the Confirm signup template to use {{ .Token }} in the branded AbroBiz email, with a clear six-digit code and no sensitive data.
7. Set Site URL to https://abrobiz.com and allow https://abrobiz.com/verify-email, https://abrobiz.com/setup, plus only required local development URLs.
8. Enable Google provider and set the Google callback to the Supabase Auth callback for the canonical project (or the active branded Auth domain).
9. In Google Cloud Console, add the exact same authorized redirect URI; do not use a localhost callback in production.
10. Verify Resend SPF/DKIM/DMARC and test delivery to Gmail, Outlook, and an Ethiopian mailbox.

## Q. Remaining risks

- npm audit reports two moderate React Router advisories in the current dependency tree. They are not introduced by Phase 1; upgrade/react-router compatibility should be handled in a dedicated dependency-maintenance change.
- Production configuration cannot be verified from this local workspace.
- Direct Supabase Auth calls remain possible to anyone who has the public project URL/key; Supabase Auth’s own attack protection and production password settings must be enabled.
- Edge Function rate-limit persistence depends on the Phase 0 consume_rate_limit RPC and service-role secret being deployed correctly.
- The legacy custom verification table remains for migration history but its client RPC execution is revoked; it should be removed only in a separately planned cleanup migration after all old links have expired.
- The large frontend bundle should be code-split in a later performance phase.
- Production readiness must not be claimed until migration/function deployment, SMTP, Auth templates, Google callback, and live end-to-end tests are confirmed.
