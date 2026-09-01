# AbroBiz production backup and restore checklist

Audit date: 2026-09-01. No backup, retention, PITR, or restore setting was queried during this repository-only audit. Every operational item below is therefore **NOT VERIFIED** until the production owner supplies sanitized evidence.

## Readiness matrix

| Control | Required evidence | Status |
|---|---|---|
| Supabase automated backups | Project backup schedule and latest successful backup timestamp | NOT VERIFIED |
| Point-in-time recovery | PITR enabled, retention window, and billing tier confirmed | NOT VERIFIED |
| Retention | Minimum retention, off-provider copy policy, and owner | NOT VERIFIED |
| Storage recovery | Storage/object backup or replication policy and sample restore | NOT VERIFIED |
| Auth recovery | User/account recovery procedure that does not expose credentials | NOT VERIFIED |
| Migration recovery | Ordered migration inventory, remote history, backup immediately before 0025/0028/0029 | NOT VERIFIED |
| Secret recovery | Secret inventory and provider rotation owners; never store raw values in backups/docs | NOT VERIFIED |
| Restore environment | Isolated staging project and access controls | NOT VERIFIED |
| Restore test | Timed staging restore with sanitized result | NOT VERIFIED |
| RPO | Approved maximum data loss for catalog, orders, payments, and messages | NOT VERIFIED |
| RTO | Approved recovery time for public storefront and owner dashboard | NOT VERIFIED |
| Monitoring | Backup failure alert and on-call notification | NOT VERIFIED |

## Safe restore procedure

1. Declare an incident/change window and freeze migrations and writes as appropriate.
2. Identify the exact target project and snapshot/PITR time. Never restore over production as the first test.
3. Restore into an isolated staging project with production access disabled and secrets replaced.
4. Apply only the migration delta required by the recorded remote history; do not reset the canonical project.
5. Verify row counts and relationships for profiles, businesses, catalog, subscriptions, payments, orders, messages, and security state.
6. Verify RLS with anonymous, owner A, owner B, and admin identities; test tenant and private payment-proof isolation.
7. Verify Edge Function configuration, Auth redirects, email templates, Storage policies, wildcard hostname behavior, and scheduled jobs.
8. Run `PRODUCTION_SMOKE_TEST_PLAN.md`, record elapsed time and failures, and obtain owner sign-off.
9. Only then plan a controlled production recovery with a rollback point and communication plan.

## Recovery verification

- No secret values are copied from production into staging.
- The canonical project ID and migration history are recorded in the change ticket.
- RPO/RTO targets are measured, not estimated.
- Restored private objects cannot be read anonymously or by another tenant.
- A restored order/payment cannot be submitted twice due to idempotency replay.
- Public storefront and owner/admin boundaries remain correct.
