# Spaceship DNS to Cloudflare Migration

Manual procedure only. Do not change Spaceship nameservers until the inventory, Vercel domain verification, email, Supabase/Auth, and rollback plan are reviewed.

1. Create/sign in to the Cloudflare account and add `abrobiz.com`.
2. Review Cloudflare's imported records against the current Spaceship DNS. Record every hostname, type, value, TTL, proxy mode, and owner.
3. Verify every root, `www`, email/MX/TXT/CNAME, Resend, Supabase/custom-auth, and other provider record with its provider dashboard.
4. Identify the exact Vercel target for the current project. It is **REQUIRES MANUAL VERIFICATION** and must not be guessed.
5. Add and verify `abrobiz.com`, `www.abrobiz.com`, and `*.abrobiz.com` in Vercel if required.
6. Add exactly one wildcard record `*` with the verified Vercel target. Keep specific records available to override the wildcard when a documented exception exists.
7. Decide proxy versus DNS-only per record. Web traffic can be proxied after TLS testing; mail and unsupported infrastructure stay DNS-only.
8. Set Cloudflare SSL/TLS to Full (strict) only after the origin certificate prerequisites are confirmed.
9. Configure conservative WAF and outer rate limits; retain application security controls.
10. At Spaceship, replace nameservers with the two Cloudflare nameservers shown for the zone, only after recording them manually and approving the change. This repository does not provide nameservers.
11. Wait for Cloudflare zone activation and normal DNS propagation; do not assume instant propagation.
12. Verify DNS answers for root, www, wildcard tenant, mail/provider records, and reserved hosts.
13. Verify HTTPS, redirects, CSP/security headers, Vercel deployment, Auth/OAuth, email delivery, Supabase connectivity, and Storage.
14. Verify two known staging tenant subdomains and one unknown tenant. Confirm the application, not DNS, decides tenant identity.
15. Monitor errors, WAF events, rate limits, TLS, Vercel origin errors, email, and Auth for the agreed observation period.

## Rollback

If the migration is unhealthy, preserve evidence and use the approved DNS rollback plan to restore the prior Spaceship nameservers/records. DNS rollback timing is provider/cache dependent. Do not delete the Cloudflare zone or records during diagnosis.
