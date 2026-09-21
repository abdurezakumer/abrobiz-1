# AbroBiz Google Search Console guide

## Domain setup

1. Add a **Domain property** for `abrobiz.com` in Google Search Console.
2. Verify ownership using the DNS TXT record provided by Google. Keep the record at the DNS provider; do not put verification secrets in the application.
3. Confirm the wildcard DNS record and HTTPS certificate cover customer subdomains.

## Sitemaps

Submit both:

- `https://abrobiz.com/sitemap.xml` for public AbroBiz pages.
- `https://abrobiz.com/sitemap-index.xml` for eligible customer storefront sitemap chunks.

Do not submit dashboard, authentication, billing, payment, admin, preview, or private URLs.

## URL inspection checklist

For the platform and one controlled test tenant, inspect the rendered URL and verify:

- one title, description, canonical, robots directive, and JSON-LD block;
- the canonical host is the intended host and uses HTTPS;
- the tenant name and description match the current public business data;
- an unpublished, blocked, expired, or indexing-disabled tenant is not indexable;
- no owner IDs, payment data, sales attribution, or private files appear in HTML;
- the public H1 and primary content are visible in returned HTML before JavaScript executes.

## Monitoring

Review Search Console coverage, page indexing, Core Web Vitals, mobile usability, and structured-data enhancements after the first production deployment. A crawlable page is not proof that Google has indexed it or that rankings/traffic have improved.

