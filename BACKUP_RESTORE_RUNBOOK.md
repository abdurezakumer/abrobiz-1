# AbroBiz Backup and Restore Runbook

## Important status

This repository does not verify the active Supabase plan, automatic-backup retention, point-in-time recovery, or the existence of a recent export. Backup availability is **NOT VERIFIED** until an operator confirms it in the canonical Supabase project dashboard and records the date, retention, and restore point metadata without including secrets.

## 1. Identify a backup

1. Confirm the target project and incident scope.
2. In Supabase, record the backup/export identifier, creation time in UTC, retention deadline, and whether it is a physical backup, PITR point, or logical export.
3. Prefer the newest known-good point before the incident, but do not select it until the required RPO is understood.
4. Confirm storage objects have an independent recovery strategy; a database restore does not automatically prove object recovery.

## 2. Restore environment

1. Create or select a disposable staging Supabase project. Never restore experimental data over production.
2. Restrict operator access and use new staging-only credentials.
3. Set staging frontend and function environment variables only in the provider secret stores.
4. Keep production domains, OAuth redirect URIs, email provider credentials, Telegram secrets, and payment credentials out of the staging test unless explicitly isolated and approved.

## 3. Restoration procedure

1. Capture the backup metadata and current migration revision.
2. Restore using the Supabase-supported dashboard/CLI procedure for the verified backup type.
3. Apply only reviewed, ordered migrations not already represented in the backup. Do not edit historical migrations or run destructive SQL casually.
4. Recreate staging-only Edge Function configuration and deploy functions only to staging.
5. Restore or verify storage objects separately, preserving private-bucket policies.

## 4. Verification

- Migration history is complete, ordered, and matches the repository.
- RLS is enabled on protected tables and storage policies prevent cross-tenant access.
- `health?check=liveness` is 200 and `health?check=readiness` is 200.
- Signup, login, OTP, reset, and Google OAuth staging flows work without exposing provider identifiers to users.
- A published storefront loads and tenant isolation checks pass.
- Order, booking, review, payment submission/idempotency, email, Telegram, and storage smoke tests pass with staging-only data.
- Row counts, foreign keys, representative tenant records, subscription states, and payment statuses reconcile with the backup metadata.
- No staging logs contain secrets or sensitive request bodies.

The repository includes `performance/phase9-disaster-recovery.staging.example.mjs` as a safety-gated readiness check. It does not perform a restore automatically.

## 5. Rollback

If staging validation fails, discard the disposable staging project or restore it again from the selected known-good point. Do not use a failed staging restore as a production rollback. For production, first preserve evidence and obtain an incident lead/database owner decision; database rollback may lose valid writes and may be unsafe after later migrations.

## 6. Reliability schedule

Recommended policy, pending owner approval: verify backup status weekly, perform a documented staging restore at least quarterly and after material database changes, and review RPO/RTO after traffic or plan changes. These are recommendations, not current guarantees.
