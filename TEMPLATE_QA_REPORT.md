# AbroBiz Template QA Report

## Scope

This QA pass preserved the existing template architecture, database schema, authentication, and deployment configuration. No GitHub push or deployment was performed.

## Results

- Template registry: 37 unique templates verified.
- Complete-data rendering: 37/37 templates rendered successfully.
- Minimal-data rendering: 37/37 templates rendered successfully without requiring optional images, contact data, or catalog content.
- Automated suite: 11 test files, 131 tests passed.
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
- Added one shared `BusinessLocation` component and one shared adaptive footer for all storefront templates.
- Added business identity, category, contact, hours, social, legal, navigation, and AbroBiz attribution fields to the shared footer.
- Added a deferred map preview with safe external map/directions actions and no map SDK dependency.
- Extended the CSP only for the Google Maps frame hosts used by the deferred preview.

## Security and isolation checks

- No `console.log`, `eval`, `innerHTML`, or `dangerouslySetInnerHTML` usage was found in `src` during this pass.
- Templates remain presentation layers and consume the existing business/storefront data path.
- No database, RLS, authentication, or authorization changes were made.
- Existing Vercel security headers were reviewed; CSP was extended only for the deferred Google Maps frame.

## Storefront completeness matrix

All 37 templates use the same shared storefront shell, so the following shared checks apply to 37/37:

| Area | Result | Notes |
| --- | --- | --- |
| Footer | PASS | Shared footer includes available identity, contact, navigation, legal, social, and AbroBiz attribution data. |
| Contact | PASS | Existing contact form and safe phone/email links remain available. |
| Business hours | PASS | Existing stored hours and closed days render; the section hides when no hour value exists. |
| Location | PASS | Existing address and configured map URL render when present. |
| Map preview | PASS | Deferred click-to-load Google Maps iframe; no initial map SDK load. |
| Social links | PASS | Existing Facebook, Instagram, TikTok, and Telegram values only; empty values are hidden. |
| CTA behavior | PASS | Existing template/category labels and entitlement-controlled booking/order links remain in use. |
| Empty-data handling | PASS | Optional logo, description, contact, social, hours, gallery, and address content is conditionally hidden or adapted. |

Business category-specific content continues to be driven by existing category labels, catalog items, entitlements, and template composition. No business or customer data was hardcoded.

## Map performance

- Implementation: shared `src/components/BusinessLocation.tsx`.
- Initial JavaScript impact: lightweight React component and Lucide icons only; no map SDK or new dependency.
- Loading: static map-like preview renders first; the iframe is created only after the visitor selects “Load map”; the iframe also uses `loading="lazy"`.
- Actions: configured HTTPS map URL is preferred for “View on map”; address-based Google Maps search and directions URLs are used as safe fallbacks.
- Responsive behavior: the preview uses a fluid width, fixed aspect-safe height, wrapping actions, and no unbounded content width. Automated rendering coverage passes; manual viewport screenshots remain unavailable.

## Shared components

- Footer: `StorefrontLayout` renders one `StorefrontFooter` for every public storefront route.
- Location/map: `BusinessLocation` is rendered once from the shared footer and is not duplicated across templates.
- Contact: existing `StorefrontContact` remains the shared contact implementation.
- Duplication: no template-specific footer or map implementation was added.

## Accessibility

- Semantic footer, heading, navigation, section, link, and iframe title markup is present.
- Social icons have accessible labels; map actions have visible text and accessible labels.
- Mobile navigation has explicit open/close labels and expanded state.
- Keyboard/focus and contrast should receive the remaining manual browser pass; `Browser viewport testing unavailable.`

## Addendum security confirmation

- Tenant resolution and public storefront data loading remain unchanged.
- Templates and shared footer do not query private owner/admin, commission, referral, or authentication data.
- Existing RLS and public/private separation were preserved.
- External links are HTTPS-validated or generated from a fixed Google Maps provider; new tabs use `noopener noreferrer`.
- No service-role credentials or session secrets are included in storefront output.

## Performance findings

- The build succeeds and template metadata is isolated into its own chunk (`templateRegistry`, about 17.4 kB minified / 4.8 kB gzip).
- The storefront home chunk is about 67.9 kB minified / 18.0 kB gzip.
- The main application chunk remains about 708 kB minified / 210 kB gzip, triggering Vite's warning. This is the primary remaining performance item and should be addressed with route/vendor chunking in a separate controlled task.
- The storefront uses one shared renderer rather than downloading separate component implementations for all templates.

## Remaining issues

1. ESLint reports 9 warnings from existing fast-refresh exports and effect dependency patterns in billing/admin screens. They do not block lint or originate from the template/footer/location work, but should be cleaned up in a focused hooks-maintenance task.
2. `npm audit` reports 2 moderate development-only Vitest/@vitest-mocker advisories. The available remediation may update the test toolchain and was intentionally not applied during this production-code QA pass.
3. Automated tests verify responsive-safe markup and mobile navigation semantics, but interactive viewport screenshots at 320–1920px were not completed because the in-app browser connector was unavailable in this environment. Browser viewport testing unavailable.

## Recommended follow-up

1. Run manual or CI browser checks at 320, 375, 390, 414, 768, 1024, 1280, 1440, and 1920px.
2. Clean the nine existing hook/fast-refresh warnings without changing runtime behavior.
3. Upgrade the development test dependencies after reviewing the Vitest advisory and lockfile impact.
4. Add controlled route/vendor chunking to reduce the 708 kB main bundle.
