# Cloudflare Incident Runbook

Never put tokens, cookies, authorization headers, Supabase keys, or customer data in incident notes.

## DNS misconfiguration or accidental record deletion

Confirm the exact record and timestamp in Cloudflare audit activity, compare with `CLOUDFLARE_DNS_INVENTORY.md`, restore only the reviewed record, and verify root, www, wildcard, email, Auth, and tenant routing. Do not recreate unknown records from memory.

## Wildcard failure or tenant takeover attempt

Check wildcard DNS, Vercel wildcard registration, TLS coverage, and application hostname resolution. Confirm the requested slug is valid/reserved-safe and that the database mapping is unchanged. Unknown hosts must not fall back to another business. Preserve evidence and suspend/review the affected tenant if ownership is uncertain.

## Cloudflare outage

Cloudflare DNS/edge/WAF/proxy traffic may fail or degrade. Direct Vercel origin reachability, if available, is not guaranteed and may not have the same hostname/TLS behavior. Application Auth, RLS, validation, rate limiting, and idempotency remain the security boundary. Verify provider status, test the approved fallback path, and do not claim zero downtime.

## WAF false positives

Confirm the rule, path, request class, geography, and time window. Do not add country blocks. Create the narrowest exception possible, test mobile/VPN/Ethiopian traffic in staging, and monitor before production use.

## TLS failure or redirect loop

Check Cloudflare SSL mode, Vercel certificate/domain status, HTTP-to-HTTPS rules, and canonical www behavior. Full (strict) requires a valid origin certificate. Never use Flexible to hide an origin mismatch.

## Compromised Cloudflare token

1. Revoke the affected token immediately in Cloudflare.
2. Create a replacement scoped only to `abrobiz.com` and minimum DNS permissions.
3. Update the trusted server secret store, never frontend/VITE variables.
4. Review Cloudflare audit activity and identify the blast radius.
5. Verify DNS, Vercel, TLS, email, Auth, and tenant routing.
6. Record the incident without printing either token.

## Domain takeover attempt

Verify registrar ownership, nameserver state, Cloudflare account access, Vercel domain ownership, and wildcard target. Freeze DNS changes, revoke suspicious credentials, and escalate to registrar/Cloudflare/Vercel support. Review tenant slug lifecycle and reserved names.
