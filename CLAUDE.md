# Project context

Multi-vertical SaaS platform (originally a restaurant-only Figma Make export,
now generalized). Any business type — restaurant, café, salon, retail, hotel,
or admin-defined custom types — gets a QR-ready storefront, digital
catalog, and manual-payment billing with Telegram-assisted admin approval.

## Stack

- React 19 + Vite + TypeScript, Tailwind v4, Framer Motion, lucide-react
- Supabase: Postgres + Auth + Storage + Row Level Security + RPC functions
- No ORM — hand-written SQL migrations in `supabase/migrations/`, run in order
- Telegram Bot API for payment-proof notifications (Phase 3, not yet built)

## Structure

- `src/lib/api/*` — one file per table/domain; all Supabase queries live here,
  never inline in components
- `src/lib/authContext.tsx` — session + profile + (for owners) business +
  subscription, loaded once and shared via `useAuth()`
- `src/components/Guards.tsx` — route guards (`RequireAuth`, `RequireOwner`,
  `RequireAdmin`, `RequireGuest`)
- `src/pages/` — owner-facing pages; `src/pages/admin/` — admin panel;
  `src/pages/storefront/` — the public 4-page site per business (Home / Menu
  / About / Contact), sharing `StorefrontLayout` + `StorefrontPageShell` +
  the `useStorefrontData` hook so none of the four pages duplicate fetch logic
- `supabase/migrations/0001_schema.sql` → `0008_storefront_pages.sql` — run in
  order, idempotent seed only in 0003; `0005` is a standalone patch (safe to
  run even if you already applied the (now-fixed) `0002`)
- `supabase/functions/telegram-webhook/` — bot conversation logic;
  `supabase/functions/notify-payment-submitted/` — pings admins when the web
  Billing form is used instead of the bot; `supabase/functions/subscription-cron/`
  — daily expiry + reminder job (scheduled via pg_cron, see SETUP.md Phase 4);
  `supabase/functions/_shared/` — code shared between them, plus test mocks

## Conventions

- One business per owner account (`businesses.owner_id` is unique)
- Money-affecting writes (payment approve/reject) go through the
  `admin_approve_payment` / `admin_reject_payment` Postgres RPCs — never patch
  `subscriptions` directly from the client, even from the admin panel, so the
  logic stays in one atomic, auditable place
- Business verticals (restaurant/salon/retail/…) are data
  (`business_categories` table, admin-editable), not code branches — labels
  like "Menu" vs "Services" come from that table, not hardcoded per page
- Inline `style={{}}` objects are used throughout (matches the original
  design), not Tailwind utility classes, even though Tailwind is in the stack

## Known next steps

1. Rate limiting on public-facing endpoints (signup, page-view tracking,
   contact form, bookings, orders, reviews, and now request-password-reset
   — that last one especially, since it triggers an email send per request)
2. Custom domains and loyalty/rewards — deferred; custom domains need a
   hosting/routing architecture change (Host-header routing + per-domain
   SSL), loyalty needs a customer-identity concept that doesn't exist yet
   (storefronts are fully anonymous). Revisit once there's real demand.
3. Cart doesn't persist across a page reload (plain React state, no
   localStorage) — fine for v1, worth revisiting if drop-off during
   checkout becomes a real issue
4. Terms/Privacy pages (`src/pages/Terms.tsx`, `Privacy.tsx`) are honest
   starting drafts, clearly labeled as such — need an actual lawyer review
   before going live, not just a Claude pass

## Email verification

Fully custom, not Supabase's built-in confirmation email — see SETUP.md
Phase 5 for the why and the setup steps. `0013_email_verification.sql`
holds the token table + two RPCs (`create_email_verification_token`,
`verify_email_token`); `supabase/functions/send-verification-email/` sends
the actual email over **Gmail SMTP** (via `npm:nodemailer`, not an HTTP API
like Resend — that's what lets the email genuinely come from a real Gmail
address, since only Gmail's own servers may send *as* a gmail.com address).
Non-blocking: `profiles.email_verified_at` drives a dismissible dashboard
banner, not a login gate. If that should change to a hard block, the
natural place is `RequireOwner`/`RequireAdmin` in `Guards.tsx`.

## Email

One shared sender (`supabase/functions/_shared/mailer.ts`) backs all three
outbound emails — signup verification, password reset, and admin
announcements — none of which go through Supabase's built-in system.
`createSenderFromEnv()` auto-picks Resend (if `RESEND_API_KEY` is set —
domain email, `noreply@abrobiz.com`, the recommended production path) or
falls back to Gmail SMTP via `npm:nodemailer` (plus-addressed, capped
around 500/day, fine for getting started). `EMAIL_FROM` always overrides
both. See SETUP.md Phase 5 for the why and setup steps.

- **Verification** (`0013_email_verification.sql`,
  `send-verification-email/`): non-blocking — `profiles.email_verified_at`
  drives a dismissible dashboard banner, not a login gate.
- **Password reset** (`0015_password_reset.sql`,
  `request-password-reset/` + `reset-password/`): replaces
  `supabase.auth.resetPasswordForEmail()` entirely. Split across two
  functions because the actual password change needs the Admin API
  (service role, in `reset-password/`), while requesting a reset is a
  plain anonymous action (`request-password-reset/`, no service role at
  all). `request_password_reset()` always returns the same generic
  response regardless of whether the email matched an account — this is
  deliberate, to prevent using it to enumerate who has an account. Needed
  adding `profiles.email` (previously the app only read email live from
  the session) since an anonymous request-a-reset flow needs a plain,
  RLS-bypassable lookup by email that cross-schema `auth.users` access or
  the admin API don't offer predictably.
- **Announcements** (`0016_announcements.sql`, `send-announcement/`,
  **Admin → Announcements**): admin broadcasts to every business owner.
  Runs entirely on the admin's own session — no service role needed, since
  admins can already read every profile via existing RLS. Logged to
  `announcements` for history. Sends one-by-one in a single request; fine
  at current scale, would need a queue if the owner list grows large (Edge
  Functions have an execution time limit).

## Google sign-in

`0014_google_signin.sql` updates the `handle_new_user` trigger to
auto-verify email for Google sign-ins only, checked via
`raw_app_meta_data->>'provider'` — not via `email_confirmed_at`, which gets
set for every signup once Supabase's "Confirm email" is off and so can't
tell Google apart from a password signup on its own. Frontend:
`GoogleSignInButton` (shared by Login/Register) just calls
`supabase.auth.signInWithOAuth({ provider: 'google' })` — Supabase handles
the whole redirect dance once the provider is configured (SETUP.md Phase 6).

## Testing

Backend (SQL/RLS/RPCs), the Telegram bot, and the subscription cron all have
real automated tests — see the "How it works" section in SETUP.md's Phase 3
for how to run the Deno ones. The frontend now does too:

```bash
cd app
npm test              # vitest run — cart math, entitlement checks, slug
                       # generation, and every route guard's redirect logic
```

`.env.test` has dummy (non-real) Supabase credentials so tests can import
modules that touch `supabaseClient.ts` without needing a live project —
don't put real credentials there, it's committed to the repo.

## Feature gating (Premium plan)

`plans.feature_flags` (jsonb: `{bookings, ordering, reviews}`) drives what a
business can access, admin-editable from **Admin → Settings → Plans** — nothing
is hardcoded to a plan slug in application code. `get_business_entitlements(business_id)`
is a public, security-definer RPC that returns just those three booleans for
a published business, used by:
- the owner dashboard (`hasFeature()` in `src/lib/entitlements.ts`, reading
  the already-loaded `subscription.plan.featureFlags`) to show locked/upsell
  states in the UI
- the public storefront (`useStorefrontData` calls the RPC directly, since
  anonymous visitors have no subscription context of their own) to
  show/hide nav links like "Reserve a Table"

Every gated table's RLS insert policy also checks entitlement directly (see
`bookings_public_insert` in `0010_bookings.sql`) — so gating is enforced at
the database, not just by hiding UI. Verified by testing a real INSERT
attempt against a non-premium business, not just checking the policy SQL is
valid (see the "Fixed bugs" section above for why that distinction matters).

## Fixed bugs worth knowing about

- **Sidebar sign-out unreachable (2026-08-08):** `DashboardLayout`'s sidebar
  is `position: fixed` with a viewport-locked height and no scroll. The nav
  list grew to 9 items over the course of building Bookings/Orders/Reviews/
  etc. without anyone revisiting that container, so on most real viewport
  heights the content overflowed and Sign Out — pushed to the very bottom
  by `flex: 1` on the nav — rendered off-screen with nothing to scroll it
  into view. Fixed by splitting the sidebar into a scrollable nav region
  (`overflowY: auto`, `minHeight: 0`) and a pinned footer (subscription
  card + sign out) that's never part of the scrollable area, so it can't
  disappear again no matter how many nav items get added later. Also added
  a redundant sign-out entry point (an account menu next to the
  notification bell) so there are two independent ways to reach it. Same
  defensive fix applied to `AdminLayout` even though its 4 items don't
  currently overflow anything — cheap insurance against the same class of
  bug as that list grows.

- **Storage upload RLS (2026-08-01):** the write/delete policies on
  `storage.objects` had a column-shadowing bug — inside an `EXISTS` subquery
  over `businesses b`, the unqualified `name` in `storage.foldername(name)`
  resolved to `businesses.name` instead of the intended
  `storage.objects.name`, since both tables have a `name` column. This made
  every logo/cover/item-image/payment-proof upload silently fail RLS,
  including for the rightful owner. Fixed by qualifying as
  `storage.foldername(storage.objects.name)`. Caught by actually exercising
  RLS with `SET ROLE` + a real INSERT as a non-superuser test role — not just
  checking that the SQL was syntactically valid. If you add more storage
  policies with subqueries later, watch for this same shadowing risk with
  any subquery table that also has a `name` (or other overlapping) column.

## Storefront interactivity

`SpotlightHero`, `AnimatedHeading`, and `TiltCard` (in `src/components/`)
give each template real personality beyond a palette swap — a
cursor-reactive glow + per-template ambient backdrop (animated grid for
modern-dark, warm vignette for traditional-warm, drifting soft blobs for
clean-minimal) behind the hero, a staggered word-reveal on the business
name, and a subtle 3D tilt on featured items / gallery photos. All driven
entirely by the business's existing `templateSlug` and `accentColor` — no
new Settings fields needed. Everything respects `prefers-reduced-motion`
(falls back to a static version, not just a slower one).
`StorefrontLayout`'s nav also has a smoothly sliding active-tab indicator
via framer-motion's `layoutId`.

## Sidebar layout

`DashboardLayout` and `AdminLayout`'s sidebars are `position: fixed` with a
viewport-locked height. The nav list (`<nav>`) is the only scrollable part
(`flex: 1, minHeight: 0, overflowY: 'auto'`) — the subscription card, "View
live site" link, and Sign Out button live in a `flexShrink: 0` block below
it, so they're always visible regardless of how many nav items exist above.
This mattered in practice: by the time the sidebar had grown to 9 items,
Sign Out was genuinely scrolling off-screen with no way to reach it. If you
add another nav item, it goes in the scrollable `<nav>` — nothing needs to
move in the pinned footer. There's also a redundant, more discoverable
sign-out in `DashboardLayout`'s top-bar account menu (next to the
notification bell) for exactly this reason.
