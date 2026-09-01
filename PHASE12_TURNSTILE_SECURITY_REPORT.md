# Phase 12 — Cloudflare Turnstile + Bot/Abuse Protection

Status: **PARTIAL — local implementation complete; production configuration and live verification remain manual gates.**

Scope: defense-in-depth bot protection for selected high-risk anonymous flows. This phase does not replace authentication, authorization, RLS, application rate limits, idempotency, input validation, storage controls, or password/OTP controls. No database schema, authentication provider behavior, production deployment, DNS, WAF, or production secret was changed.

## Architecture

- The browser uses Cloudflare's official explicit-rendering widget through `src/components/TurnstileWidget.tsx`.
- The widget is loaded only when the public `VITE_TURNSTILE_SITE_KEY` exists. Its success, expiry, error, timeout, reset, and retry states are handled without logging the token.
- Each endpoint receives the token in the transient `turnstileToken` request field. The client does not persist it in local storage, cookies, URL parameters, or application state outside the active component.
- `supabase/functions/_shared/turnstile.ts` performs one HTTPS Siteverify request to Cloudflare, with a 5-second timeout and a 32 KiB response bound. There are no retries because Turnstile tokens are single-use.
- Server validation requires `success === true`, the expected action, and a configured hostname allowlist. The request `Host` header is never treated as proof of a valid challenge.
- Provider errors are mapped to generic responses. Secret values, tokens, raw provider responses, user input, and email addresses are not logged.
- When `TURNSTILE_ENFORCE=true`, missing, invalid, expired, wrong-action, wrong-hostname, misconfigured, and unavailable verification all fail closed. When it is false, the existing application behavior remains available for development and staged rollout.

Cloudflare requires server-side validation; tokens are short-lived and single-use. The implementation follows the official [server-side validation guidance](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [explicit client rendering guidance](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), and [CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

## Protected endpoints and actions

When enforcement is enabled, the following endpoints require a valid token after their existing request validation and rate limits:

| Endpoint | Action | Browser surface |
| --- | --- | --- |
| `signup` | `signup` | Register form |
| `login` | `login` | Login form |
| `resend-signup-otp` | `otp-resend` | Verify-email resend |
| `request-password-reset` | `password-reset` | Login password-reset request |
| `submit-contact` | `contact` | Public contact form |
| `submit-booking` | `booking` | Public booking form |
| `submit-review` | `review` | Public review form |
| `submit-order` | `order` | Public storefront checkout |

Authenticated management and payment flows retain their existing session, authorization, RLS, rate-limit, and idempotency controls. They were not blindly made dependent on an anonymous challenge. OAuth Google sign-in is a redirect-based provider flow and remains governed by the existing Supabase/Google OAuth configuration.

## Secrets and environment variables

Only variable names and blank placeholders were added to `.env.example`:

- `VITE_TURNSTILE_SITE_KEY`: public browser site key; configure in the Vercel project.
- `TURNSTILE_SECRET_KEY`: server-only Cloudflare secret; configure only as a Supabase Edge Function secret.
- `TURNSTILE_ENFORCE`: set to `true` only after both keys and hostnames are configured.
- `TURNSTILE_ALLOWED_HOSTNAMES`: comma-separated exact hosts and validated one-label wildcard patterns, for example `abrobiz.com,www.abrobiz.com,*.abrobiz.com`.

No real key or secret is present in this report or source code. The browser bundle must never receive `TURNSTILE_SECRET_KEY`.

## CSP and CORS

`vercel.json` now allows only the exact Cloudflare origin needed by the widget:

- `script-src`: `https://challenges.cloudflare.com`
- `frame-src`: `https://challenges.cloudflare.com`
- `connect-src`: `https://challenges.cloudflare.com`

No `unsafe-eval` or wildcard source was added. The pre-existing `unsafe-inline` in `style-src` remains because of the application’s current inline-style usage and was not broadened. CORS remains explicit through `CORS_ORIGINS`/`CORS_ORIGIN` and the existing AbroBiz/local development allowlist; no wildcard origin was added.

## Rate-limit interaction

The existing endpoint-specific, database-backed rate limits run before Siteverify. This caps both provider calls and downstream work during a flood. Turnstile then runs once, followed by the existing business/entitlement/RLS/database operation. Cloudflare WAF/rate limiting, Supabase limits, and application rate limits remain separate layers and must continue to be enabled in production.

## Tenant isolation

Turnstile hostname validation is only an anti-abuse signal. It does not identify a tenant or authorize access. Tenant resolution continues to use the existing validated `abrobiz.com`/`*.abrobiz.com` hostname logic, while server-side authorization and RLS remain authoritative for account and business data.

## Tests and validation

- **PASS** — `npm.cmd run typecheck`
- **PASS** — `npm.cmd audit --audit-level=moderate --json` reported zero vulnerabilities.
- **PASS** — `git diff --check` produced no whitespace errors; existing worktree changes are present from prior phases.
- **PASS** — Vercel CSP/config was updated with exact Turnstile sources, without `unsafe-eval` or wildcard sources.
- **PASS** — server utility test coverage was added in `supabase/functions/_shared/turnstile_test.ts` for disabled mode, missing/oversized token, provider success, wrong action, wrong hostname, expired/duplicate, invalid, malformed, provider failure, and missing configuration.
- **NOT EXECUTED** — Deno tests; Deno is not installed in the available environment.
- **NOT EXECUTED** — Vitest; `npm.cmd test -- --run` is blocked before test discovery by the environment’s `esbuild` `spawn EPERM` error.
- **NOT EXECUTED** — production build; `npm.cmd run build` passes TypeScript and is blocked at Vite/esbuild startup by the same `spawn EPERM` error.
- **NOT TESTED** — live Cloudflare Siteverify, Vercel CSP headers, Supabase Edge Function secrets, widget rendering on production, and challenge behavior on all tenant hostnames. These require staging/production configuration and must be performed manually.

## Manual production setup

1. In Cloudflare Turnstile, create a production site key and restrict it to `abrobiz.com`, `www.abrobiz.com`, and the supported tenant hostnames under `*.abrobiz.com` as appropriate for the Cloudflare dashboard.
2. Add `VITE_TURNSTILE_SITE_KEY` to the Vercel production environment and redeploy the frontend.
3. Add `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENFORCE=true`, and `TURNSTILE_ALLOWED_HOSTNAMES=abrobiz.com,www.abrobiz.com,*.abrobiz.com` to Supabase Edge Function secrets. Do not put the secret in Vercel or any `VITE_` variable.
4. Deploy the changed Edge Functions and shared module through the normal reviewed Supabase release process.
5. Confirm Vercel returns the updated CSP on `https://abrobiz.com` and a representative tenant hostname.
6. In a staging account, test signup, login, OTP resend, password reset request, contact, booking, review, and order with: no token, valid token, expired token, wrong action, wrong hostname, repeated token, provider timeout, and provider outage. Confirm generic errors and that rate-limit responses still occur.
7. Verify Google OAuth, email delivery, tenant routing, and authenticated dashboard/payment flows still work; Turnstile must not be treated as an authorization mechanism.

## Remaining risks and recommended next phase

- **MANUAL / HIGH** — Production keys, hostname restrictions, Edge Function deployment, and Cloudflare WAF/rate-limit policy are not verifiable from this workspace.
- **MANUAL / MEDIUM** — The application’s existing inline styles keep `style-src 'unsafe-inline'`; removing that requires a separate UI/CSS migration.
- **NOT TESTED / MEDIUM** — Provider outage behavior and real browser widget lifecycle require staging tests with a non-production site key.
- **NOT TESTED / MEDIUM** — Observability should be checked in the deployed environment to ensure Turnstile failure counts and latency are visible without sensitive data.

Recommended Phase 13: production abuse telemetry and incident validation—provider health metrics, per-endpoint challenge failure dashboards, alert thresholds, safe replay/duplicate detection metrics, and a staged load/abuse test run.
