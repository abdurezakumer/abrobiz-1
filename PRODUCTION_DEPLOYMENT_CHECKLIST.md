# AbroBiz Production Deployment Checklist

Use this checklist for a planned release. A checked item must have evidence in the release record; do not mark it complete from assumption.

## Before release

- [ ] Working tree reviewed; no secrets, local `.env`, source maps, or debug artifacts are included.
- [ ] `npm.cmd run typecheck` passes.
- [ ] Existing frontend and security tests pass.
- [ ] Deno tests pass in a Deno-enabled environment, or are explicitly recorded as not executed.
- [ ] `npm.cmd audit --audit-level=moderate` reviewed.
- [ ] Production build passes in CI or the local build limitation is resolved.
- [ ] Vercel configuration, CSP, headers, rewrites, domain, and HTTPS behavior reviewed.
- [ ] Supabase migrations are ordered and reviewed; no historical migration is edited or deleted.
- [ ] Backup/PITR status, retention, and a restore point are verified in Supabase.
- [ ] Migration-specific recovery plan and frontend/function rollback plan are recorded.
- [ ] Vercel, Supabase, Resend, Telegram, OAuth, and storage environment variables are present in the correct provider secret stores. Values are never placed in source.
- [ ] OAuth redirect URIs and email sender/domain configuration match the production domain.
- [ ] Health liveness/readiness endpoints are configured and tested without exposing diagnostics.
- [ ] Alerts, log access, and incident contacts are configured and tested.

## Staging verification

- [ ] Auth, legal acceptance, OTP, password reset, Google OAuth, tenant isolation, RLS, rate limits, idempotency, storage, and frontend security regression checks pass.
- [ ] Storefront, menu, contact, booking, order, review, payment, email, Telegram, and admin flows pass with non-production data.
- [ ] Failure-test scaffold is run only against an approved staging host.
- [ ] Restore rehearsal or documented restore evidence is current.
- [ ] No sensitive values appear in browser, Edge Function, provider, or CI logs.

## Release and smoke test

- [ ] Deploy frontend using a reviewed Vercel deployment.
- [ ] Deploy reviewed Edge Functions and verify configuration.
- [ ] Apply database migrations using the approved Supabase process.
- [ ] Check canonical domain, one business subdomain, auth flows, public storefront, dashboard, and admin access.
- [ ] Check liveness/readiness, error rate, latency, email delivery, storage, payment submission, and Telegram behavior.
- [ ] Observe for the agreed release window and record request IDs for any failures.

## Rollback

Frontend rollback is a Vercel deployment rollback to the last compatible deployment. Edge Functions should be redeployed from the last known-good commit after configuration review. Database rollback is migration-specific and is **not automatically safe**; use the backup/restore runbook and incident lead approval. Reconcile application/database compatibility before reverting either side.
