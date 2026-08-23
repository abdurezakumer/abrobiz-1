# Business Digital Platform — SaaS Architecture & Build Plan

*Prepared as a senior-dev planning pass before implementation. Covers data model, roles, Supabase schema, Telegram payment-approval flow, admin panel, and phased delivery.*

---

## 1. What I found in your draft

Your zip is a **Figma Make export**: React 19 + Vite + Tailwind v4 + React Router, fully client-side, all data in `localStorage` (`src/lib/store.ts`). It's restaurant-only (`Restaurant`, `MenuItem`) with:

- Landing, Register, Login, Setup Wizard, Dashboard, Menu Editor, Settings, QR page, Public menu (`/r/:slug`)
- 3 templates (modern-dark, clean-minimal, traditional-warm), 3 languages (en/am/or)
- A `role: 'owner' | 'admin'` field on `User` that's **never actually used** — no admin UI exists
- No real auth, no payments, no database — everything resets per browser

It's a solid **UI skeleton**. Nothing here is wasted — we're upgrading the plumbing, generalizing the data model, and adding the two big missing systems: **Admin control plane** and **Payments/Telegram**.

---

## 2. Core model change: Restaurant → Business

Since this now serves salons, retail shops, hotels, etc. — not just restaurants — I'm generalizing the entity instead of hardcoding restaurant-specific logic:

- `restaurants` table → **`businesses`** table
- `menu_items` → **`items`** (same shape: image, price, translations, availability — this works identically for a menu item, a service, or a product)
- New **`business_categories`** lookup table (admin-managed, not hardcoded), e.g.:

| slug | label | item_label | category_label | icon |
|---|---|---|---|---|
| restaurant | Restaurant | Menu Item | Menu Category | UtensilsCrossed |
| cafe | Café / Bakery | Menu Item | Menu Category | Coffee |
| salon | Salon & Beauty | Service | Service Category | Scissors |
| retail | Retail Shop | Product | Product Category | ShoppingBag |
| hotel | Hotel | Room / Package | Category | BedDouble |
| other | Other Business | Item | Category | Store |

The dashboard and public storefront pull labels/icons from this table based on `business.category_id` — so "Menu Editor" automatically becomes "Services" for a salon, "Products" for a shop, with zero special-case code. New verticals = one admin-panel row, not a redeploy.

---

## 3. Roles

| Role | Who | Access |
|---|---|---|
| **admin** | You | Everything — all businesses, all payments, plan config, business categories, platform settings, analytics. Seeded directly in the DB, no public admin signup. |
| **owner** | Business owners (any vertical) | Their own business only: profile, catalog, settings, QR, billing/payment submission. |
| *(public)* | Customers | No account. View published storefronts only. |

RLS (Postgres Row Level Security) enforces this at the database level, not just in the UI — an owner literally cannot query another business's rows even via the API.

---

## 4. Data model (Supabase / Postgres)

```
profiles              id (=auth.users.id), role, name, phone, created_at
business_categories   id, slug, label, item_label, category_label, icon, sort_order, is_active
businesses            id, owner_id, category_id, name, slug, description, logo_url, cover_url,
                       phone, email, address, maps_url, template_slug, languages[],
                       accent_color, opening_hours(jsonb), social(jsonb),
                       is_published, is_blocked, blocked_reason, created_at
categories             id, business_id, name, icon, sort_order, is_hidden, translations(jsonb)
items                  id, business_id, category_id, image_url, price, is_available,
                       sort_order, translations(jsonb)
plans                  id, slug, name, price_etb, billing_interval, features(jsonb),
                       is_active, sort_order          -- admin-editable, not hardcoded
subscriptions          id, business_id, plan_id, status, start_date, end_date, auto_renew
payment_methods         id, name, account_name, account_number, instructions, is_active  -- e.g. Telebirr, CBE
payments               id, business_id, plan_id, billing_cycle, amount_etb, payment_method_id,
                       proof_url, owner_note, status(pending/approved/rejected),
                       telegram_message_id, reviewed_by, reviewed_at, rejection_reason, created_at
business_telegram_links id, business_id, telegram_chat_id, telegram_username, linked_at
notifications           id, user_id, type, title, body, link, is_read, created_at
page_views              id, business_id, path, referrer, created_at   -- storefront analytics
admin_logs               id, admin_id, action, target_table, target_id, meta(jsonb), created_at
```

**Storage buckets:** `logos`, `covers`, `item-images` (public-read), `payment-proofs` (private — owner + admin only).

This is the same shape as your original spec's tables, just generalized (`restaurant_id` → `business_id`) plus the new billing/payments/admin layer it didn't have yet.

---

## 5. Subscriptions & billing

- New business → auto-enrolled in a seeded **Trial** plan (14 days, free), same as your spec.
- **Plans are admin-configurable** (not hardcoded "Basic 300 / Business 700") — you can add/edit/retire plans from the admin panel without a code change.
- A daily scheduled job (Supabase cron) flips expired subscriptions to `expired` and can auto-unpublish the storefront (configurable), plus queues a reminder 3 days before expiry.
- Owner's dashboard shows plan, days remaining, and a **Billing** page with upgrade/renew + payment history.

---

## 6. Telegram payment-approval flow (manual, as requested)

```
Owner (Billing page)                 Your Telegram (admin)
──────────────────────               ─────────────────────
1. Picks plan, sees payment
   method details (Telebirr/
   bank account you configure)
2. Sends money manually
3. Uploads proof screenshot
   + note → "Submit"
        │
        ▼
   payments row created (status = pending)
        │
        ▼
   Edge Function sends YOU a Telegram
   message: business name, plan,
   amount, the proof image, and
   inline buttons [✅ Approve] [❌ Reject]
                                       │
                                       ▼
                              4. You tap Approve/Reject
                                 right in Telegram
        ▲
        │
   Webhook verifies it's really you (chat ID check),
   updates payment status, extends subscription end_date,
   edits the Telegram message to show the decision,
   and notifies the owner in-app (+ Telegram if they've
   linked their account via /start deep link)
```

Two entry points are supported so it's flexible: owners submit proof **from the web dashboard** (reliable, keeps records tidy) — but the bot also accepts a photo sent directly in a linked chat, for owners who prefer to just message the bot. Either way, you always approve/reject the same way: one tap in Telegram, no separate admin login needed on your phone.

Built with one Supabase Edge Function as the Telegram webhook (handles `/start` linking, incoming photos, and button callbacks) plus a small "notify admin" function called whenever a payment is submitted from the web.

---

## 7. Admin panel (new)

- **Overview** — total businesses, active subscriptions, MRR, pending payments, recent signups
- **Businesses** — search/filter, view/edit any business, block/unblock, "view as owner"
- **Payments** — pending queue with proof preview, approve/reject with reason, full history
- **Plans** — CRUD pricing & features
- **Payment Methods** — CRUD Telebirr/bank accounts shown to owners
- **Business Categories** — CRUD verticals (restaurant, salon, retail, …)
- **Analytics** — platform-wide growth, revenue, views
- Every admin action (block, approve, edit) is written to `admin_logs` for accountability.

## 8. Business owner dashboard (additions to existing pages)

Keeps your existing Dashboard / Menu-Editor(→Catalog) / Settings / QR pages, generalizes their labels per vertical, and adds:
- **Billing** page (plan status, submit payment proof, history)
- **Notifications** bell (approvals, rejections, expiry reminders)
- Basic **Analytics** (storefront views, QR scans)

---

## 9. Frontend & interactivity

Keeping React 19 + Vite + Tailwind v4 (already scaffolded well). Adding:
`@supabase/supabase-js`, `framer-motion` (animation), `react-hook-form` + `zod` (forms/validation), `sonner` (toasts), `recharts` (admin charts).

For the "interactive and engaged" feel you asked for, I'll apply React-Bits-style motion throughout: animated hero + scroll reveals on the storefront, tilt/hover cards for catalog items, magnetic buttons, animated counters on dashboards, skeleton loaders, and confetti-style micro-feedback on payment approval — while keeping it tasteful per business vertical (a salon shouldn't look like a crypto dashboard).

---

## 10. Important constraint on "building it" here

I can write the **entire codebase**: React app, SQL migrations (schema + RLS + seed data), and the Telegram Edge Functions. What I *can't* do from this sandbox:
- Create your Supabase project or run migrations against it (I have no network access to supabase.com from here, and no credentials)
- Create your Telegram bot or set its webhook (needs your BotFather token)

So the deliverable is production-ready code + a step-by-step `SETUP.md` (create Supabase project → run SQL → create storage buckets → create bot via @BotFather → set secrets → deploy Edge Functions → set webhook → add env vars → run frontend). You paste in your own keys/tokens at the end. Given this is an ongoing multi-file codebase you'll keep iterating on with a live backend, **Claude Code** (desktop or CLI) is genuinely a better home for the rest of this build than this chat — it can run `supabase` CLI, hit real network, and keep the repo on your machine with git history. I'll do the planning and first implementation pass here; happy to hand off from there.

---

## 11. Phased roadmap

| Phase | Scope |
|---|---|
| **1 — Foundation** | Supabase schema + RLS + seed data; Auth wiring; generalize Restaurant→Business across the app; existing pages (register/login/setup/dashboard/catalog/settings/QR/storefront) working end-to-end on real data |
| **2 — Admin panel** | Full admin dashboard: businesses, payments queue, plans, payment methods, categories, analytics, logs |
| **3 — Telegram + billing** | Bot, Edge Functions, webhook, Billing page, proof upload, approve/reject loop, subscription auto-extend, cron expiry |
| **4 — Polish** | Framer Motion pass across storefront/dashboards, notifications, per-vertical theming |
| **5 — Later** | Custom domains, online ordering, reservations, reviews, loyalty (your original Phase 3 ideas) |

---

## 12. Open questions before I start Phase 1

1. **Business verticals at launch** — which do you want live now (I'll pre-seed `business_categories`)?
2. **Brand name** — keep the placeholder "RestaurantDigi" for now, or do you have a real name?
3. Anything about the Telegram flow above you'd change (e.g., you'd rather *only* approve via bot, never submit-via-web)?
