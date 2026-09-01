# AbroBiz Incident Response

This runbook is local operational guidance. It does not grant access to Vercel, Supabase, Resend, Telegram, or customer data. Never paste secrets, tokens, passwords, OTPs, payment credentials, or message contents into tickets or logs.

## Detection signals

- Elevated 5xx or timeout rates in Vercel and Supabase Function logs.
- `/functions/v1/health?check=liveness` failing: function/runtime problem.
- `/functions/v1/health?check=readiness` returning 503: database readiness problem or missing function configuration.
- Auth failures, OTP resend spikes, password-reset spikes, or repeated authorization failures.
- Rate-limit hits, duplicate payment/order submissions, or unusual traffic patterns.
- Storage upload/signed-URL failures, Resend rejection/timeout, or Telegram webhook/API failures.

## Severity

| Severity | Impact | Example | Immediate action | Escalation/recovery |
|---|---|---|---|---|
| SEV-1 | Widespread outage, active data exposure, or payment integrity risk | Database unavailable for most traffic; credentials compromised | Declare incident, freeze risky changes, preserve evidence, page owners | Incident lead plus provider escalation; restore or revoke credentials; verify recovery |
| SEV-2 | Major feature or tenant segment unavailable | Auth, payment, or storage unavailable for a material segment | Assign owner, start timeline, inspect dependency health and recent changes | Provider escalation and rollback/mitigation; verify affected workflows |
| SEV-3 | Limited degradation with workaround | Elevated email failures or slow dashboard | Record incident, inspect logs and dependency status, communicate workaround | Fix during business-hours priority; add regression test |
| SEV-4 | Minor isolated defect or observation | Single failed request with no trend | Record evidence and safe request ID | Schedule normal fix and monitor |

Thresholds must be tuned from a measured baseline. Starting alert recommendations are: page on sustained widespread 5xx, database readiness failure, confirmed auth outage, payment integrity anomaly, or credential compromise; ticket on repeated dependency failures and elevated latency. Do not treat a single failed request as an outage.

## First 15 minutes

1. Assign an incident lead and communications owner; record UTC start time.
2. Confirm scope using safe request IDs, status classes, function names, and durations. Do not copy request bodies or authorization headers.
3. Check Vercel deployment/runtime status, Supabase Function/Auth/Database/Storage logs, and provider status pages.
4. Check the last deployment or migration. Do not reset the database or run an unreviewed rollback.
5. Apply the smallest reversible mitigation: revert a frontend deployment, disable a non-critical integration path, or pause an operator job.
6. Preserve logs and provider event IDs only when they contain no credentials or customer content.

## Procedures

### A. Authentication incident

Confirm liveness and Auth/provider status. Check failed-login, signup, OTP, and reset rates by function and time window. Do not enumerate accounts. If credentials or OAuth secrets may be exposed, rotate them through the provider consoles, revoke affected sessions where supported, inspect the blast radius, and verify sign-in, signup, OTP, reset, and Google OAuth redirect configuration in staging before release.

### B. Database incident

Check readiness, Supabase database health, connections, slow queries, storage, and recent migrations. Preserve the error category and request IDs. Stop repeated operator jobs if they amplify load. Use the backup/restore runbook for corruption or deletion; never assume a migration can be reversed by running its inverse.

### C. Storage incident

Check bucket availability, object policy errors, upload limits, signed URL failures, and provider status. Keep storefront text and core business operations available where possible. Do not make payment proofs public or delete objects during diagnosis.

### D. Payment incident

Stop duplicate/retry amplification, keep idempotency keys and payment IDs private, and compare database payment state with provider/operator evidence. Do not log card data or full proof contents. Reconcile pending payments before resuming approvals.

### E. Email incident

Check Resend/SMTP provider status, domain verification, sender configuration, rejection/timeout events, and rate limits. Preserve generic failure counts and safe request IDs. Do not print API keys, recipient lists, OTPs, reset links, or provider payloads. Keep signup/reset responses generic and retry only the intended operation.

### F. Telegram incident

Check webhook secret configuration, provider status, duplicate-update protection, API timeouts, and function errors. Do not log bot tokens, chat contents, or payment proofs. Telegram is non-critical for normal web payment submission; keep the web path available when safe.

### G. Data exposure incident

Declare SEV-1. Restrict access to logs and affected dashboards, preserve evidence, identify tenants/resources and time window, revoke/rotate affected credentials, correct RLS or endpoint behavior, and assess notification obligations with qualified legal/privacy support. Do not investigate by exporting broad customer data.

### H. API abuse incident

Inspect rate-limit hits, endpoint, status, safe identity class, and timing. Do not log raw bodies or secrets. Tighten a reviewed limit or block an abuse source at an approved edge/provider layer only after impact analysis. Check idempotency and payment/order duplicates.

### I. Deployment incident

Stop promotion, compare the active deployment with the last known-good deployment, and use Vercel rollback for frontend-only issues. For database or function changes, follow the migration-specific recovery procedure and redeploy the known-good function version only after compatibility review.

## Closure

Record timeline, affected components/tenants, root cause, mitigation, recovery evidence, data-integrity checks, customer communication, and follow-up actions. Close only after health, authentication, storefront, critical business paths, and monitoring signals remain stable for an agreed observation window.

## Cloudflare-specific incidents

- DNS misconfiguration or accidental record deletion: compare against the verified DNS inventory, restore only reviewed records, and verify root, www, wildcard, email, Auth, and tenant routing.
- Wildcard failure or domain-takeover attempt: freeze DNS changes, verify registrar/Cloudflare/Vercel ownership and TLS, confirm database slug ownership, and ensure unknown hosts cannot fall back to another tenant.
- Cloudflare outage: check provider status and test the approved fallback/origin path if one exists. Do not claim zero downtime or assume direct Vercel access has identical security behavior.
- WAF false positive: identify the rule and request class, add the narrowest reviewed exception, and test Ethiopian/mobile/VPN traffic in staging.
- TLS/redirect failure: verify Vercel certificate coverage, Cloudflare Full (strict) prerequisites, and canonical www/HTTPS rules; never use Flexible.
- Cloudflare token compromise: revoke the token, inspect audit activity, create a minimum-scope replacement, update only the trusted server secret store, and verify DNS/application behavior.
