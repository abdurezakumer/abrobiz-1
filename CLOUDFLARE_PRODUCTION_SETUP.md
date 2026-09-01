# Cloudflare Production Setup for AbroBiz

This document describes manual setup only. It does not contain a zone ID, record ID, nameserver, token, or secret. No provider change has been performed.

## Architecture

`Internet -> Cloudflare DNS -> Cloudflare Edge/WAF -> Vercel -> AbroBiz frontend -> Supabase Edge Functions -> Auth/PostgreSQL/RLS/Storage`.

Cloudflare is an outer edge layer. It is not tenant authorization. Hostname validation, authenticated function checks, authorization, validation, rate limits, idempotency, and RLS remain authoritative even if a request bypasses Cloudflare.

## Manual setup sequence

1. Create or verify the Cloudflare account and add `abrobiz.com`.
2. Review imported DNS records against `CLOUDFLARE_DNS_INVENTORY.md`; preserve root, `www`, email, Supabase/custom-auth, and provider records.
3. In Vercel, inspect the Domains page and copy the exact target/value required for the existing project. The repository does not reveal that target.
4. Add `abrobiz.com`, `www.abrobiz.com`, and `*.abrobiz.com` in Vercel where required. Wait for Vercel verification; wildcard support is not assumed from DNS alone.
5. Create one wildcard DNS record named `*` with the exact Vercel target. Do not create a DNS record when a business is created.
6. Use proxied mode for web traffic only after origin/TLS behavior is verified. Keep MX, mail, verification, and unsupported infrastructure records DNS-only.
7. Set Cloudflare SSL/TLS to Full (strict) only after the Vercel/origin certificate and hostname coverage are confirmed. Never use Flexible.
8. Configure conservative managed WAF rules and HTTP anomaly protection. Do not add country blocks or aggressive rules that could exclude Ethiopian/mobile/VPN users.
9. Add outer rate limits only for clear abuse surfaces. Keep Phase 3 application limits authoritative and avoid blindly duplicating their windows.
10. If exceptional DNS automation is actually needed, create a scoped API token for only the `abrobiz.com` zone with the minimum DNS permissions, then store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` only in a trusted server secret store. `CLOUDFLARE_ACCOUNT_ID` is not needed by the current scaffold unless a future Cloudflare product requires it.
11. Consider DNSSEC after the full record inventory is verified; enable it manually and record the DS values at Spaceship.
12. Verify root, www, wildcard tenant, unknown tenant, auth-reserved host, HTTPS, email, Auth, storage, payment/order, and logs.

## Vercel and origin caveats

The repository's `vercel.json` provides SPA rewrites and security headers but does not register a production domain. A directly reachable Vercel origin may remain possible; Cloudflare does not automatically hide it. Optional origin restriction must be designed with Vercel support/configuration and tested without breaking deployments. Do not claim Cloudflare is the only path.

## Required server environment names

These names are scaffolding only and have no values here:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ACCOUNT_ID` only if a future API requires it

They must never use a `VITE_` prefix, be sent to the browser, be stored in PostgreSQL, or be logged.

## Verification commands

Use Cloudflare/Vercel dashboards and approved DNS tools to verify exact records, TLS, and propagation. Confirm `business.abrobiz.com` reaches Vercel and the application resolves the business slug from a validated hostname. Confirm unknown tenants return a safe not-found state and do not fall back to another tenant.
