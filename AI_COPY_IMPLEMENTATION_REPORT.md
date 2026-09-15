# AbroBiz AI Website Copy — Implementation Report

## Delivered

- Added a protected `generate-website-copy` Supabase Edge Function.
- Added migration `0048_ai_website_copy.sql` for tenant-scoped, versioned `DRAFT`, `APPROVED`, and `ARCHIVED` copy generations.
- Added an owner-only copy assistant inside Business Settings with language, tone, section selection, draft preview, regeneration, and explicit Apply to website approval.
- Added strict client and server validation for bounded JSON, allowed keys, no HTML/markup, and service IDs tied to the business catalog.
- Added Gemini REST integration with a server-only `GEMINI_API_KEY`; the key is never read by Vite client code.
- Added IP, user, and business rate limits before generation.
- Added approved-copy loading to the existing RLS-backed storefront data hook.
- Applied approved hero, about, service, contact, and SEO copy while preserving existing business data as the fallback/source of truth.
- Added focused validation tests.

## Data and security model

The AI function authenticates the Supabase bearer session and explicitly scopes the requested business to `owner_id = auth.uid()`. It loads only that business's saved profile, category, catalog, and hours. It sends bounded factual data to Gemini with an instruction that all supplied fields are untrusted data, not commands.

AI output is saved as a draft. A security-definer RPC archives the previous approved generation and approves one owner-owned draft atomically. Anonymous visitors can read only approved copy for a published, unblocked business. No service-role key is used for owner reads or writes, and templates never query private data.

The platform does not overwrite `businesses`, `categories`, or `items`. Prices, contact details, item IDs, and owner-managed facts remain outside the generated content. If a generated record is missing, invalid, or unavailable before migration, the storefront falls back to its existing content.

## Required setup

1. Apply migration `supabase/migrations/0048_ai_website_copy.sql` in the production Supabase project using the normal migration process.
2. Create a Gemini API key in Google AI Studio.
3. Store it only as a Supabase Edge Function secret:

   ```bash
   supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY GEMINI_MODEL=gemini-3.5-flash --project-ref YOUR_PROJECT_REF
   ```

4. Deploy the function through the normal controlled Supabase deployment process:

   ```bash
   supabase functions deploy generate-website-copy --project-ref YOUR_PROJECT_REF
   ```

`GEMINI_API_KEY` must not be added as `VITE_GEMINI_API_KEY`, committed to `.env`, or placed in browser/Vercel public variables. The `.env.example` entry is a placeholder for documentation only. Vercel only serves the frontend; Gemini access belongs to the Edge Function.

## Verification

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed: 134 tests across 12 files.
- `npm.cmd run lint` — passed with 9 existing warnings in unrelated files; no new lint errors.
- `npm.cmd run build` — passed.
- Production bundle inspection found no Gemini API key or `VITE_GEMINI_API_KEY` reference. The browser bundle contains only the safe Edge Function name and client-side validation code.
- Deno CLI was not installed in this workspace, so local Edge Function typechecking/deployment was not run.

## Remaining operator checks

- Apply the migration and deploy the function in a staging Supabase project first.
- Test an owner generation, section regeneration, approval, and public storefront refresh with a real configured Gemini key.
- Confirm the configured Gemini model is enabled for the account; `GEMINI_MODEL` is intentionally configurable because model availability can vary.
- Review provider quotas and billing before enabling the feature for all owners.

No production deployment or GitHub push was performed.
