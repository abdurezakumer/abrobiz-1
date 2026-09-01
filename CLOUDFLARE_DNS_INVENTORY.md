# AbroBiz Cloudflare DNS Inventory

This is an inventory template, not a claim about current DNS. Existing Spaceship and Vercel records were not queried. Every target below that is not known from repository configuration is marked **REQUIRES MANUAL VERIFICATION**.

| Hostname | Type | Target | Purpose | Proxy/DNS-only | Owner | Criticality | Manual/Automatic | Notes |
|---|---|---|---|---|---|---|---|---|
| `abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Root application | Web record: verify | AbroBiz/Vercel | Critical | Manual | Confirm exact Vercel target from Vercel Domains before migration |
| `www.abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Canonical www application | Web record: verify | AbroBiz/Vercel | High | Manual | Avoid redirect loops |
| `*.abrobiz.com` | CNAME preferred | REQUIRES MANUAL VERIFICATION | One wildcard tenant route | Proxied after origin/TLS verification | AbroBiz/Vercel | Critical | Manual, one record | Do not create one record per tenant |
| `auth.abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Reserved future/custom auth host | Verify supported mode | AbroBiz/Supabase | High | Manual | Reserved; never tenant-owned |
| `api.abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Reserved infrastructure name | Verify supported mode | AbroBiz | High | Manual | Reserved; no tenant ownership |
| `mail.abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Mail/provider record if required | DNS-only unless provider says otherwise | AbroBiz/email provider | High | Manual | Do not proxy mail records |
| `status.abrobiz.com` | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Optional status host | Verify | AbroBiz | Medium | Manual | Reserved |
| `abrobiz.com` TXT/MX/CNAME | REQUIRES MANUAL VERIFICATION | REQUIRES MANUAL VERIFICATION | Email verification/delivery | DNS-only | AbroBiz/email provider | Critical if used | Manual | Preserve all verified Resend/SMTP records |

## Required verification

Export or inspect current Spaceship DNS and Vercel domain settings, then replace every unknown target/type above with the exact observed value. Verify Supabase custom-domain/auth records and Resend records from their respective dashboards. Do not infer targets from this file.
