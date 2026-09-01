# AbroBiz Phase 4 Storage Security Report

Audit scope: user-controlled uploads, Storage objects, file paths, private-file downloads, payment-proof references, and related delivery controls.

Production target: `https://abrobiz.com`

This report covers local repository changes only. No Supabase migration, Edge Function, deployment, or Git push was performed.

## Findings register

### F1 — Storage writes were directly reachable from browser clients

- Severity: HIGH
- Component: Supabase Storage policies; `src/lib/api/businesses.ts`, `src/lib/api/items.ts`, `src/lib/api/payments.ts`
- Attack scenario: An authenticated client bypasses frontend checks and uploads arbitrary bytes directly to a bucket, avoiding application validation and rate limits.
- Current protection: Existing bucket RLS required tenant prefixes, but browser writes were still available and MIME/size checks were primarily client-side.
- Change made: Migration `0029_phase4_storage_security.sql` revokes `INSERT`, `UPDATE`, and `DELETE` on `storage.objects` from `anon` and `authenticated`. Browser API wrappers now call `storage-upload`, which authenticates the caller, checks tenant ownership, applies limits, validates signatures, and generates the path.
- Verification: Static test source checks cover the function, revoked grants, generated names, and frontend call sites. Live Storage RLS testing was not executed.
- Remaining risk: The migration and new function must be applied/deployed before this protection exists in production.

### F2 — Private proof access depended on a client-supplied path

- Severity: HIGH
- Component: Payment proof download; `storage-signed-url`, `src/lib/api/payments.ts`
- Attack scenario: A user submits another tenant’s object path to an endpoint that signs arbitrary objects.
- Current protection: The previous private bucket read policy checked owner/admin, but application signed-URL behavior required a focused audit.
- Change made: `storage-signed-url` accepts only an exact two-segment UUID/filename path, verifies the authenticated user, verifies the business owner/admin relationship, rate-limits requests, and returns a 600-second download URL.
- Verification: Static regression test and an environment-gated cross-tenant integration test were added. Live integration was not executed.
- Remaining risk: Storage policy and function deployment are still pending.

### F3 — The first draft used the wrong Storage folder count

- Severity: HIGH (fixed locally)
- Component: `supabase/migrations/0029_phase4_storage_security.sql`
- Attack scenario: `business-id/file.ext` has one folder component; checking for two would deny every legitimate object read.
- Current protection: The draft was corrected to `array_length(storage.foldername(...), 1) = 1`, while separately validating the safe filename.
- Change made: Public and private read policies now represent the actual two-segment path layout.
- Verification: Static migration assertion updated to require folder count one. No live SQL execution was available.
- Remaining risk: The migration still needs staging execution and policy tests before production application.

### F4 — File validation could be bypassed with MIME/extension spoofing

- Severity: HIGH
- Component: Browser and Telegram upload paths; `supabase/functions/_shared/fileSecurity.ts`
- Attack scenario: HTML, script, executable, or malformed content is presented as an image by changing its MIME type or filename.
- Current protection: Frontend checks MIME and size, but those are not trusted security boundaries.
- Change made: Server-side byte signatures are required for JPEG, PNG, and WebP; PDF is allowed only for payment proofs. SVG, HTML, JavaScript, executables, archives, and server-side script formats are not allowlisted. Object names are generated and original filenames are discarded.
- Verification: Static regression test checks the allowlist and both upload functions use the shared validator. A live malformed-file test is included but not run.
- Remaining risk: Signature checks are not a full image/PDF parser or malware scanner.

### F5 — Telegram payment photos were a separate upload path

- Severity: HIGH (fixed locally)
- Component: `supabase/functions/telegram-webhook/index.ts`
- Attack scenario: A Telegram-supplied file is downloaded and stored without the browser upload validator, potentially bypassing content and abuse controls.
- Current protection: Telegram webhook secret, replay protection, a 10 MiB download limit, and webhook rate limiting already existed.
- Change made: Telegram photos now require validated JPEG bytes, use generated UUID paths, and receive an additional per-chat 20-photo/hour limit.
- Verification: Static regression test checks the shared validator and per-chat limit. Live Telegram testing was not run.
- Remaining risk: Telegram remains an external ingestion path and still needs production monitoring and staging verification.

### F6 — Payment records could reference a fake or malformed proof path

- Severity: HIGH (fixed locally)
- Component: `submit-payment`; `payments` validation trigger
- Attack scenario: A caller bypasses the UI and submits a same-tenant-looking path that is not an actual uploaded proof.
- Current protection: Existing RLS and trigger checks required a path beginning with the payment business ID.
- Change made: The endpoint requires an exact UUID/filename path, approved extension, matching business UUID, and an existing object. Migration `0029` also tightens `validate_payment_submission()` so direct authorized inserts require an exact proof path and an existing object in `payment-proofs`.
- Verification: TypeScript passed; SQL was statically inspected only. No live database test ran.
- Remaining risk: Storage and PostgreSQL are separate systems; a successful upload followed by a failed payment insert can still leave an orphan object.

### F7 — Orphaned objects are not automatically reconciled

- Severity: MEDIUM
- Component: All upload flows; Storage/DB consistency
- Attack scenario: Upload succeeds but the subsequent business/item/payment update fails, or a business/payment is deleted while its object remains.
- Current protection: Generated paths, exact payment references, and DB validation prevent unauthorized references but do not provide a distributed transaction.
- Change made: No destructive cleanup was introduced in this phase.
- Verification: Upload-before-DB workflows were inspected.
- Remaining risk: A scheduled, audited orphan-report and retention workflow is needed before deleting anything automatically.

### F8 — No malware scanner or full media parser exists

- Severity: MEDIUM
- Component: Storage content handling
- Attack scenario: A file with an accepted signature contains a parser exploit or malicious payload in metadata/content.
- Current protection: Small allowlist, bounded bytes, no archive extraction, no server-side parsing, no execution path.
- Change made: No third-party scanning service was added.
- Verification: Repository contains no malware scanner or archive extraction pipeline.
- Remaining risk: The system can state only that executable/script types are rejected; it cannot claim uploaded files are malware-free.

### F9 — Storage delivery headers are not fully application-controlled

- Severity: MEDIUM
- Component: Supabase Storage public and signed URLs; `vercel.json`
- Attack scenario: A browser interprets a served user-controlled object unexpectedly if Storage response headers are permissive.
- Current protection: Vercel responses set `X-Content-Type-Options: nosniff`; payment signed URLs now request download behavior. Public assets are limited to image types by the upload function.
- Change made: Private proof URLs use `{ download: true }` and a short lifetime.
- Verification: Code inspection only; response headers were not tested against the remote Storage service.
- Remaining risk: Vercel headers do not automatically apply to `*.supabase.co/storage/*`; verify Storage delivery headers in staging. Headers are not a malware defense.

### F10 — Storage CORS is partly outside this repository

- Severity: MEDIUM
- Component: Supabase Storage project configuration; Edge Function CORS
- Attack scenario: Broad project-level Storage CORS permits unintended browser origins, or missing headers blocks the new upload endpoint.
- Current protection: Edge Function CORS uses an allowlist for AbroBiz and local development origins; the new upload headers were added to `cors.ts`.
- Change made: Added `x-business-id` and `x-upload-bucket` to Edge Function allowed headers.
- Verification: Repository CORS code inspected.
- Remaining risk: Supabase Storage CORS must be reviewed manually in the project dashboard/configuration; it is not defined here.

### F11 — Public asset enumeration remains intentional

- Severity: LOW
- Component: `logos`, `covers`, `item-images`
- Attack scenario: An anonymous user lists or requests known public asset objects.
- Current protection: These buckets are explicitly public and intended for customer storefront delivery; paths are tenant UUID plus generated filename and contain no private proof data.
- Change made: Public read policies reject nested, unsafe, or non-UUID-prefixed object paths.
- Verification: Policy inspection and static assertions.
- Remaining risk: Existing orphaned public objects may remain discoverable until separately inventoried and safely retired.

## A. Storage inventory

| Bucket | Classification | Purpose | Allowed types | Limit | Upload path | Download path |
|---|---|---|---|---:|---|---|
| `logos` | Public | Business logo | JPEG, PNG, WebP | 5 MiB | `storage-upload` | `getPublicUrl` |
| `covers` | Public | Business cover/gallery asset | JPEG, PNG, WebP | 5 MiB | `storage-upload` | `getPublicUrl` |
| `item-images` | Public | Storefront item image | JPEG, PNG, WebP | 5 MiB | `storage-upload` | `getPublicUrl` |
| `payment-proofs` | Private | Payment evidence | JPEG, PNG, WebP, PDF | 10 MiB | `storage-upload` or trusted Telegram webhook | `storage-signed-url`, 600 seconds |

Application references are in `src/lib/api/businesses.ts`, `src/lib/api/items.ts`, `src/lib/api/payments.ts`, `supabase/functions/telegram-webhook/index.ts`, and `supabase/functions/_shared/notify.ts`. No application `move`, `copy`, or browser `remove` operation was found.

## B. Bucket classification

Public buckets contain only intended storefront assets. `payment-proofs` is private and has no public-read policy. Existing demo/external image URLs are HTTPS URLs stored in business/item fields and are not fetched server-side.

## C. Storage policies

Migration `0029_phase4_storage_security.sql` revokes browser write/update/delete privileges, keeps public reads limited to safe tenant-prefixed names, and limits payment-proof reads to the owning business or an admin. Service-role writes are used only after function-level authorization. Historical policies remain unchanged; `0029` is additive and corrective.

## D. Tenant isolation

The upload and signed-URL functions independently validate the authenticated user and the requested business owner/admin relationship. Payment proof paths must match the payment business UUID. Business A is not authorized to upload for or sign files under Business B. Live A/B tests were prepared but not executed.

## E. File-type allowlists

Images: JPEG, PNG, WebP. Payment documents: PDF in addition to those images. SVG and active content are rejected. Validation requires both matching MIME and a basic file signature. Original filenames and extensions are never used as trusted storage identifiers.

## F. File-size limits

Public image buckets: 5 MiB. Payment proofs: 10 MiB. The Edge Function checks `Content-Length` early and checks the fully buffered byte count again. Telegram downloads are capped at 10 MiB.

## G. File-count limits

Each upload request accepts one binary body, not a client-controlled array or batch. Browser uploads are limited to 30 per user/hour, 60 per business/hour, and 60 per IP/hour. Telegram payment photos are limited to 20 per chat/hour in addition to the webhook limit.

## H. Filename/path protections

The server creates `{business UUID}/{random UUID}.{safe extension}`. Client filenames, folders, extensions, separators, Unicode names, control characters, and traversal strings do not enter the generated path. Signed URLs and payment submission accept only two segments with an ASCII-safe filename up to 128 characters.

## I. Signed URL security

Only `payment-proofs` can be signed through the new endpoint. The requester must be authenticated and must own the path’s business or be an admin. Requests are rate-limited and URLs expire in 600 seconds with download behavior requested.

## J. Public/private separation

`getPublicUrl` remains used only for the three intentional public asset buckets. Payment proofs are returned to the application as object paths and resolved through the authorized signed-URL function. Anonymous access to private proofs is expected to fail through Storage RLS.

## K. Payment-proof security

Dashboard uploads and Telegram photos both use private storage, server-side size/type checks, safe generated paths, and ownership checks. The payment validation trigger now requires an exact path and matching existing private object. Replacement/delete is not exposed to browser clients.

## L. Upload authorization

`storage-upload` requires a session, obtains the user through the Supabase Auth API, checks admin/owner access with the service client, then validates and uploads. Supabase browser write privileges are revoked by migration `0029`.

## M. Download authorization

Public storefront assets are intentionally anonymous-readable. Payment proofs require owner/admin Storage policy access and application authorization for signed URLs. The new function does not accept a bucket name, expiration, or arbitrary signing options from the client.

## N. Delete authorization

Browser `INSERT`, `UPDATE`, and `DELETE` privileges on `storage.objects` are revoked. No public delete endpoint exists. Trusted service-role cleanup is not implemented, which avoids an unsafe generic deletion surface.

## O. Move/copy authorization

No application move/copy operation exists. Browser write privileges are revoked, so browser move/copy requests cannot be used to move or copy objects. Any future server-side move/copy endpoint must authorize both source and destination tenants.

## P. Orphan-file analysis

Storage and PostgreSQL are not atomic. Upload-before-DB updates can orphan objects on DB failure; DB deletion does not automatically remove Storage objects. No automatic destructive cleanup was added. A future cleanup job should produce an auditable report, use an age threshold, and require a safe ownership/reference check before deletion.

## Q. CORS review

Edge Functions allow `https://abrobiz.com`, `https://www.abrobiz.com`, and local development origins by default, with an environment override. The upload-specific headers are now listed. Supabase Storage project CORS is external configuration and must be verified separately.

## R. Security headers

`vercel.json` includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict referrer policy, permissions policy, and HSTS. There is no CSP in the repository. Supabase Storage response headers require separate verification because Vercel headers do not cover remote Storage URLs.

## S. Abuse controls

Uploads and signed URL generation reuse Phase 3’s database-backed rate limiter. Request bodies are bounded, upload bytes are bounded, and only one file is processed per request. Payment submission retains idempotency/rate controls. No second rate-limit architecture was added.

## T. Static tests

Added `supabase/functions/_shared/phase4_static_security_test.ts`. It checks storage upload authorization/validation, shared active-content allowlists, Telegram hardening, signed URL expiration/ownership, migration write revocation/path policy, and frontend use of the validated functions.

## U. Dynamic tests

Added `supabase/tests/phase4_storage_integration_test.ts`. With staging environment variables, it tests cross-tenant signed URL denial, traversal rejection, malformed content rejection, cross-tenant upload denial, and authorized private access. The test is intentionally environment-gated and does not contain credentials.

## V. Tests passed

- `npm.cmd run typecheck` — passed.
- `npm.cmd audit --omit=dev` — passed with 0 reported vulnerabilities.
- `git diff --check` — passed.
- Source inspection found no privileged secret values; only server-side environment-variable references were present.

## W. Tests not executed

- Deno Edge Function/static tests — not executed because Deno is not installed.
- Live Supabase Storage/RLS integration tests — not executed because no staging test credentials/data were supplied.
- `npm.cmd test -- --run` — blocked by environment `spawn EPERM` while Vite/esbuild loaded its config.
- `npm.cmd run build` — TypeScript phase passed, but Vite/esbuild was blocked by the same environment `spawn EPERM`.
- SQL migration execution/lint against Supabase — not executed; no remote changes were made.

## X. Files changed

Phase 4 files:

- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/fileSecurity.ts`
- `supabase/functions/_shared/requestSecurity.ts`
- `supabase/functions/_shared/phase4_static_security_test.ts`
- `supabase/functions/storage-upload/index.ts`
- `supabase/functions/storage-signed-url/index.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/submit-payment/index.ts`
- `supabase/tests/phase4_storage_integration_test.ts`
- `supabase/config.toml`
- `supabase/migrations/0029_phase4_storage_security.sql`
- `PHASE4_STORAGE_SECURITY_REPORT.md`

The worktree also contains pre-existing Phase 0–3 changes; they were preserved and not reset.

## Y. Migrations created

Created `supabase/migrations/0029_phase4_storage_security.sql`. It does not reset the database, delete data, or modify historical migrations. It revokes browser Storage writes, replaces read policies with safe path checks, tightens payment proof validation, and retains service-role-only managed uploads.

## Z. Remaining HIGH/CRITICAL risks

1. **HIGH — Not deployed:** Until migration `0029` and the two new Edge Functions are applied to the production Supabase project, production still has the previous Storage behavior.
2. **HIGH — No live authorization verification:** Cross-tenant, anonymous, direct Storage, delete, and private-download behavior still require staging tests with Business A/B fixtures.
3. **MEDIUM — No malware scanning:** Accepted files are not malware-free; only dangerous categories and basic signatures are filtered.
4. **MEDIUM — No decoded image-dimension limit:** There is no image parser/processor, so decompression-bomb detection is not implemented. The system does not decode or transform images server-side.
5. **MEDIUM — Orphan cleanup:** Storage/DB failure states are documented but not automatically reconciled.
6. **MEDIUM — External Storage headers/CORS:** Verify project-level Storage CORS and file-delivery headers in staging.
7. **MEDIUM — CSP absent:** Adding a CSP requires an asset audit and staged rollout to avoid breaking the existing storefront.

Phase 4 is not a declaration that AbroBiz is fully production-ready. Review and stage the migration/functions, run the environment-gated tests, then schedule deployment separately.
