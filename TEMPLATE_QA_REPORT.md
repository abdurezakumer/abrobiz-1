# AbroBiz Template QA Report

## Scope

This QA pass preserved the existing template architecture, database schema, authentication, and deployment configuration. No GitHub push or deployment was performed.

## Results

- Template registry: 37 unique templates verified.
- Complete-data rendering: 37/37 templates rendered successfully.
- Minimal-data rendering: 37/37 templates rendered successfully without requiring optional images, contact data, or catalog content.
- Existing automated suite: 11 test files, 129 tests passed.
- TypeScript: passed.
- ESLint: passed with 0 errors and 9 pre-existing warnings.
- Production build: passed.
- Local storefront smoke test: `/demo/restaurant-cafe` returned HTTP 200 on the available Vite servers.
- `git diff --check`: no whitespace errors.

## Changes made

- Added the ESLint flat configuration and `npm run lint` script.
- Added automated rendering coverage for every registry template with complete and minimal business data.
- Added a jsdom IntersectionObserver test shim for scroll-reveal components.
- Removed unused imports and dead fallback template lists from settings/setup screens.
- Moved Google and Turnstile callback-ref updates into effects to avoid render-time ref mutation.
- Hardened hostname control-character validation without a control-character regex.
- Improved template cards with category/feature metadata and corrected preview modal positioning.
- Prevented inactive/deprecated remote templates from appearing in owner selection lists.
- Added accessible labels and expanded state to storefront mobile navigation controls.

## Security and isolation checks

- No `console.log`, `eval`, `innerHTML`, or `dangerouslySetInnerHTML` usage was found in `src` during this pass.
- Templates remain presentation layers and consume the existing business/storefront data path.
- No database, RLS, authentication, or authorization changes were made.
- Existing Vercel security headers and CSP configuration were reviewed and left intact.

## Performance findings

- The build succeeds and template metadata is isolated into its own chunk (`templateRegistry`, about 17.4 kB minified / 4.8 kB gzip).
- The storefront home chunk is about 67.9 kB minified / 18.0 kB gzip.
- The main application chunk remains about 708 kB minified / 210 kB gzip, triggering Vite's warning. This is the primary remaining performance item and should be addressed with route/vendor chunking in a separate controlled task.
- The storefront uses one shared renderer rather than downloading separate component implementations for all templates.

## Remaining issues

1. ESLint reports 9 warnings from existing fast-refresh exports and effect dependency patterns in billing/admin screens. They do not block lint or originate from the template renderer, but should be cleaned up in a focused hooks-maintenance task.
2. `npm audit` reports 2 moderate development-only Vitest/@vitest-mocker advisories. The available remediation may update the test toolchain and was intentionally not applied during this production-code QA pass.
3. Automated tests verify responsive-safe markup and mobile navigation semantics, but interactive viewport screenshots at 320–1920px were not completed because the in-app browser connector was unavailable in this environment.

## Recommended follow-up

1. Run manual or CI browser checks at 320, 375, 390, 414, 768, 1024, 1280, 1440, and 1920px.
2. Clean the nine existing hook/fast-refresh warnings without changing runtime behavior.
3. Upgrade the development test dependencies after reviewing the Vitest advisory and lockfile impact.
4. Add controlled route/vendor chunking to reduce the 708 kB main bundle.
