# AbroBiz load-test plan

Target capacity: 1,000,000 registered users, high concurrent public traffic, and burst traffic on signup/forms/order/payment workflows.  
No load test was run during the repository audit.

## Safety and environment

- Run against a staging project with production-like indexes, RLS, Edge Function settings, storage, and realistic row counts.
- Use generated users, businesses, catalog rows, and fake payment proofs. Disable real email delivery or route to a sink.
- Do not load-test production without written capacity approval, a rollback owner, and provider quotas confirmed.
- Use one tenant per public scenario and retain a fixed cross-tenant authorization cohort.

## Workloads

| Scenario | Mix | Initial target |
|---|---:|---:|
| Public storefront read | 70% | 5,000 RPS burst, p95 < 500 ms at the edge |
| Catalog/config reads | 12% | 1,000 RPS, bounded payloads |
| Public forms | 6% | 100 RPS, rate limits enforced without database saturation |
| Auth/signup/reset/OTP | 5% | 50 RPS sustained, provider quotas respected |
| Owner dashboard reads/writes | 4% | 500 concurrent owners, p95 < 1 s for ordinary reads |
| Orders/payments/uploads | 2% | 25 RPS, zero duplicate idempotency outcomes |
| Admin/reporting | 1% | 20 concurrent admins; pagination remains bounded |

## Test stages

1. Baseline: one user/tenant and empty cache.
2. Ramp: 10%, 25%, 50%, 75%, then 100% of target concurrency for 15 minutes each.
3. Spike: five times baseline for 60 seconds, then recovery for 15 minutes.
4. Soak: 30–60% target for 4–8 hours to find connection leaks, queue growth, storage leakage, and stale locks.
5. Failure test: disable or slow Resend/Telegram/Turnstile in staging and confirm bounded timeouts, safe errors, and no retry storm.
6. Authorization test: parallel cross-tenant reads and writes; zero unauthorized success is required.

## Measurements

- Vercel request count, cache hit ratio, TTFB, edge errors, function duration, cold starts, memory, and 4xx/5xx rate.
- Supabase REST/RPC latency, connection saturation, CPU/IO, lock waits, dead tuples, query plans, index usage, storage egress, and auth/provider quotas.
- Endpoint rate-limit denials, idempotency conflicts, Turnstile failures, email delivery/bounce rate, and webhook replay denials.
- Payload size for storefront, admin lists, orders, and images; browser LCP/INP/CLS on mobile and desktop.

## Release thresholds

- No authorization or tenant-isolation failure.
- No duplicate order/payment caused by retries or concurrent requests.
- Public read p95 < 500 ms at target; authenticated ordinary request p95 < 1 s; mutation p95 < 2 s excluding provider delivery.
- 5xx < 0.1% in steady state and no sustained error growth after a spike.
- Database CPU < 70% sustained, connection pool < 70%, lock waits near zero, and no unbounded queue.
- Memory and Edge Function duration remain below configured limits with 30% headroom.
- All payloads remain bounded; admin endpoints never fetch unbounded history.

## Likely scale bottlenecks to investigate

- Client storefront refreshes every 30 seconds and can issue several reads per tenant; validate cache effectiveness and tenant hot-spot behavior.
- Admin business/payment queries use fixed large limits rather than cursor pagination; replace with server-side pagination before very large datasets.
- Rate-limit counters and idempotency rows in PostgreSQL may become hot under global bursts; assess partitioning/retention and an edge/distributed limiter.
- Public Supabase reads and image URLs need CDN/cache strategy, cache invalidation, and egress budget.
- Auth, Turnstile, Resend, Telegram, and GitHub APIs have independent quotas and failure modes.
- Maintenance/purge functions must be scheduled, bounded, observable, and separated from user-facing latency.

## Test evidence template

Record test build, migration hash, dataset sizes, concurrency, region, provider mode, thresholds, p50/p95/p99, error classes, DB metrics, and decision. Never record secrets or full authorization headers.
