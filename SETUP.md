# Setup Guide — Phase 1 (Foundation)

This gets your real backend running: Supabase database + auth + storage, wired to the
full app (owner side + admin panel). Telegram bot payment notifications are Phase 3 —
for now, approving/rejecting payments works fully from the **web admin panel**, so
nothing here is blocked on the bot.

> **Already ran the migrations before?** There was a bug in the storage upload
> policies (logo/cover/payment-proof uploads silently failed for everyone,
> including the rightful owner). Just run `supabase/migrations/0005_fix_storage_policies.sql`
> in the SQL Editor — that's the only thing that changed. No need to redo anything else.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Once it's ready, go to **Settings → API** and copy:
   - `Project URL`
   - `anon public` key

## 2. Configure the app

```bash
cd app
cp .env.example .env
```

Paste your URL and anon key into `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run the database migrations

In Supabase, open **SQL Editor** and run these four files **in order** (each one
depends on the last). Copy-paste the contents of each and hit Run:

1. `supabase/migrations/0001_schema.sql` — tables, triggers, indexes
2. `supabase/migrations/0002_policies.sql` — Row Level Security + storage buckets
3. `supabase/migrations/0003_seed.sql` — starter business categories, plans, payment methods
4. `supabase/migrations/0004_admin_rpc.sql` — atomic payment approve/reject functions
5. `supabase/migrations/0006_telegram.sql` — Telegram linking tables (skip if not using Phase 3 yet, but it's harmless to run either way)
6. `supabase/migrations/0008_storefront_pages.sql` — About page content, photo gallery, featured items, and the Contact form's inbox
7. `supabase/migrations/0009_plan_features.sql` — adds the Premium plan (1000
   ETB) and per-plan feature flags for Bookings/Ordering/Reviews
8. `supabase/migrations/0010_bookings.sql` — table reservations / appointments
   / room bookings, gated to Premium at the database level
9. `supabase/migrations/0011_ordering.sql` — online ordering: cart, checkout,
   an atomic `submit_order()` RPC that re-prices every line server-side
10. `supabase/migrations/0012_reviews.sql` — public reviews, owner-moderated
    before they're visible
11. `supabase/migrations/0013_email_verification.sql` — the platform's own
    email verification (see Phase 5 below) — safe to run even if you're not
     setting up Phase 5 yet
12. `supabase/migrations/0014_google_signin.sql` through
    `supabase/migrations/0018_professional_templates.sql` — Google
    verification, password reset, announcements, and professional templates
13. `supabase/migrations/0019_restaurant_cafe_template.sql` — warm editorial
    Restaurant & Café template based on the local reference design

(If you prefer the CLI: `supabase link` then `supabase db push` runs all four for you.)

After this, check **Storage** in the sidebar — you should see 4 buckets: `logos`,
`covers`, `item-images`, `payment-proofs`.

## 4. Install and run

```bash
npm install
npm run dev
```

Open the printed local URL.

## 5. Create your admin account

1. Go to `/register` and sign up with the email you want as platform admin.
   (If your Supabase project has "Confirm email" on, check your inbox and click
   the link first — or turn it off in **Authentication → Providers → Email**
   while you're testing.)
2. Back in the Supabase **SQL Editor**, run:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

3. Log out and back in — you'll land on `/admin` instead of the setup wizard.

## 6. Try the owner flow

Sign up with a second email (or use an incognito window) to go through:
`/register` → setup wizard (pick a business type, name, template) → dashboard →
add some catalog items → Billing → submit a payment proof.

Then log back in as the admin and go to **Admin → Payments** to approve it —
watch the owner's subscription extend automatically.

## 7. Make confirmation emails come from you, not "Supabase"

> **Superseded by Phase 5 below**, which replaces Supabase's confirmation
> email entirely with one this app sends itself. The dashboard-only approach
> below is still valid if you'd rather keep using Supabase's built-in system
> with just the branding changed — but if you're setting up Phase 5, skip
> straight there instead.

By default, Supabase sends the signup confirmation email through its own
shared mail service, from a generic Supabase address — that's what you're
seeing. Two settings fix this, both in **Supabase Dashboard → Authentication**:

1. **Email Templates** → "Confirm signup" — rewrite the subject and body in
   your own voice/branding. This changes the *content*, not the sender.
2. **Settings → SMTP Settings** (a.k.a. "Custom SMTP") — this is the one that
   changes the actual **From address**. Without it, every project shares
   Supabase's default sender and a low rate limit (a handful of emails per
   hour) meant only for testing — not something you want in production
   anyway. Connect your own SMTP provider (Resend, Postmark, SES, Mailgun,
   etc. all work) and set the From address to something like
   `noreply@yourdomain.com`. Once that's set, every auth email — signup
   confirmation, password reset — comes from your domain.

This is a dashboard configuration step, not application code, so it's on the
Supabase side regardless of which frontend hits it. If you'd like, tell me
which email provider you want to use and I'll draft the exact template text.

## What's already working

- Real Supabase auth, database, and file storage (no more localStorage)
- Any business type — restaurant, café, salon, retail, hotel, or your own custom
  ones added from **Admin → Settings → Categories**
- Owner: dashboard, catalog editor (with a "featured" flag for the homepage),
  business settings (branding, About content, photo gallery, hours), QR code,
  billing/payment submission, a Messages inbox, and three Premium-gated pages
  — Bookings, Orders, and Reviews — each showing an upgrade prompt instead of
  the feature if the business isn't on Premium
- Admin: overview stats, business management (block/unblock), payment approval
  queue, plan/payment-method/category configuration, and per-plan feature
  toggles (Bookings/Ordering/Reviews) — Premium (1000 ETB) has all three by
  default, Basic/Business have none, and it's all editable from **Admin →
  Settings → Plans**, not hardcoded
- Public storefront at `/r/your-slug` — Home / Menu / About / Contact always,
  plus Book (if Premium) and a cart + checkout right on the Menu page (if
  Premium) and reviews on Home (if Premium). 3 templates, animated and
  mobile-friendly, with a working contact form that lands in the owner's
  dashboard
- Automated tests throughout: SQL/RLS policies, the Telegram bot, the
  subscription cron, the verification email, and the frontend (`npm test` —
  cart math, entitlement checks, slug generation, every route guard)
- The platform's own marketing page is a proper hub — how-it-works, FAQ,
  live pricing, and a real footer with Terms/Privacy pages (clearly labeled
  drafts — have a lawyer review them before relying on them)
- Fully custom email verification — your own Edge Function + Resend, not
  Supabase's built-in confirmation email (see Phase 5 below)

## What's next (Phase 3)

The Telegram bot (submit proof or approve from your phone, instant notifications)
plugs into the exact same `admin_approve_payment` / `admin_reject_payment`
functions the web panel already uses — so it's additive, not a rework. Say the
word when you're ready and I'll build the bot + Edge Functions next.

## Notes

- Update the placeholder Telebirr/bank details in **Admin → Settings → Payment
  methods** before going live.
- The platform branding is AbroBiz. Update the logo/colors in the frontend if
  you want a different brand presentation.

---

# Setup Guide — Phase 3 (Telegram bot)

Approving payments from the web admin panel already works — this adds a
Telegram bot on top so you (and owners) can act from your phone, with instant
push notifications.

## 1. Create the bot

Message [@BotFather](https://t.me/BotFather) on Telegram:

```
/newbot
```

Follow the prompts (pick a name and a unique @username ending in `bot`).
BotFather gives you a **token** that looks like `123456789:AAF...` — save it.

## 2. Deploy the Edge Functions

From the `app/` folder, with the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked to your project:

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy notify-payment-submitted
```

`telegram-webhook` needs `--no-verify-jwt` because Telegram calls it directly,
not through your app's auth — it's protected instead by the secret token set
up in the next step. `notify-payment-submitted` is called by your logged-in
frontend, so it keeps normal JWT verification.

## 3. Set secrets

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123456789:AAF...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 20)
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every
function automatically — don't set those yourself.)

## 4. Point Telegram at your webhook

Replace the placeholders and run this once (swap in your token, project ref,
and the exact same webhook secret from step 3):

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR_PROJECT_REF>.functions.supabase.co/telegram-webhook" \
  -d "secret_token=<YOUR_WEBHOOK_SECRET>"
```

You should get back `{"ok":true,"result":true,...}`.

## 5. Tell the frontend the bot's username

In `.env`:

```
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

(no `@`, no `bot` link prefix — just the username). Restart `npm run dev` /
redeploy.

## 6. Connect your own chat as admin

Log into the app as your admin account, go to **Admin → Settings**, and tap
**Connect** on the Telegram card. It opens Telegram with `/start <token>`
prefilled — just hit send. You'll get a confirmation message, and from then
on every submitted payment shows up there with **Approve / Reject** buttons.

## 7. Try it end-to-end

As a business owner, go to **Billing** and tap **Connect** on the Telegram
card too. Then either submit a payment from the web form as before (you'll
now also get pinged on Telegram automatically), or message the bot directly
with `/pay` to pick a plan, pick a payment method, and send your proof photo
right in the chat.

## How it works (if you want to modify it)

- `supabase/functions/telegram-webhook/index.ts` — all bot conversation logic
  (`/start`, `/pay`, photo handling, Approve/Reject buttons)
- `supabase/functions/notify-payment-submitted/index.ts` — called by the web
  Billing page right after a proof upload, to ping admins
- `supabase/functions/_shared/notify.ts` — the actual "send to every linked
  admin" logic, shared by both entry points above
- Both entry points call the same `admin_approve_payment` /
  `admin_reject_payment` RPCs the web admin panel uses — there's exactly one
  place that logic lives
- Tests: `cd app/supabase/functions && deno test --node-modules-dir=none _shared/webhook_test.ts`
  runs the bot's conversation-flow tests against a mocked Telegram + database
  (no real bot token or live project needed)

---

# Setup Guide — Phase 4 (Go live)

Two things: put the frontend somewhere public, and set up the daily job that
expires overdue subscriptions.

## 1. Host the frontend

**Vercel** (simplest for a Vite app):
```bash
npm i -g vercel
cd app
vercel
```
When prompted, add your three env vars (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT_USERNAME`) in the Vercel
dashboard under **Settings → Environment Variables**, then redeploy.
`vercel.json` is already in the repo so client-side routes
(`/dashboard`, `/r/your-slug`, etc.) don't 404 on refresh.

**Netlify** works the same way — `netlify.toml` is already included. Connect
the repo in the Netlify dashboard, or `netlify deploy --prod` via their CLI,
and set the same three env vars there.

Either way: once it's live, go back to Supabase **Authentication → URL
Configuration** and set your real deployed URL as the Site URL (and add it
to Redirect URLs) — otherwise password-reset and email-confirmation links
will point at `localhost`.

## 2. Deploy the subscription-expiry job

```bash
cd app
supabase functions deploy subscription-cron --no-verify-jwt
supabase secrets set CRON_SECRET=$(openssl rand -hex 20)
```

Run migration `0007_subscription_cron.sql` in the SQL Editor if you haven't
already (adds a `reminder_sent_at` column and enables the `pg_cron`/`pg_net`
extensions).

Then schedule it — in the SQL Editor, run this once with your own project
ref and the exact `CRON_SECRET` value from above:

```sql
select cron.schedule(
  'daily-subscription-check',
  '0 3 * * *',  -- 03:00 UTC every day; adjust to your timezone as you like
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/subscription-cron',
    headers := jsonb_build_object('Authorization', 'Bearer <YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

What it does daily: flips any trial/active subscription past its `end_date`
to `expired` (in-app + Telegram notification to the owner), and sends a
one-time reminder to anyone expiring in exactly 3 days. **It does not
unpublish the storefront on expiry** — that's a deliberate choice, since
enforcement should probably be a human decision given payments are reviewed
manually, not an automatic one. If you'd rather it auto-unpublish, that's a
small change to `supabase/functions/subscription-cron/index.ts` — say the
word and I'll add it.

Tests: `cd app/supabase/functions && deno test --node-modules-dir=none _shared/cron_test.ts`

---

# Setup Guide — Phase 5 (Your own email — verification, password reset, announcements)

Three emails this app sends on its own, never through Supabase's built-in
system: signup confirmation, password reset, and admin announcements. All
three go through one shared sender (`supabase/functions/_shared/mailer.ts`),
which picks a provider automatically:

- **`RESEND_API_KEY` set → sends via [Resend](https://resend.com)** using
  your domain (`noreply@abrobiz.com`). This is the recommended path now
  that you have a real domain — no daily sending cap, no "via gmail.com"
  concerns, and it's the one way to make `noreply@abrobiz.com` a real,
  properly-authenticated sender rather than a spoofed one.
- **No Resend key → falls back to Gmail SMTP**, authenticated as a real
  Gmail account, sender read as `youraddress+noreply@gmail.com`
  (plus-addressing — same inbox, reads as no-reply). Fine for getting
  started, but personal Gmail SMTP caps out around 500 sends/day and isn't
  meant for production app traffic.

You don't have to choose one forever — set `RESEND_API_KEY` later and every
function switches over automatically, no code changes.

Verification is **non-blocking by design**: people can use the app
immediately after signing up, with a dismissible "please confirm your
email" banner in the dashboard until they do.

## 1. Turn off Supabase's built-in confirmation email

**Authentication → Providers → Email** in the Supabase dashboard → turn off
**"Confirm email"**. This makes `signUp()` return a working session
immediately instead of waiting on Supabase's own email.

## 2. Set up Resend with your domain (recommended)

1. Sign up at [resend.com](https://resend.com).
2. **Domains → Add Domain** → enter `abrobiz.com`.
3. Resend gives you a handful of DNS records (SPF, DKIM, and usually a
   tracking/return-path CNAME) — add these at wherever `abrobiz.com`'s DNS
   is managed (your registrar, or Cloudflare/etc. if you use one). This is
   the one manual step outside of Supabase — I can't do it for you since it
   needs access to your domain's DNS settings.
4. Wait for Resend to show the domain as **Verified** (usually minutes, DNS
   propagation can occasionally take longer).
5. Grab your API key from Resend's dashboard.

```bash
cd app
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set EMAIL_DOMAIN=abrobiz.com
supabase secrets set SITE_URL=https://abrobiz.com
supabase secrets set APP_NAME=AbroBiz
```

That's it — every email now sends as `"AbroBiz" <noreply@abrobiz.com>`.
Want a different display name or address? Set `EMAIL_FROM` explicitly (e.g.
`supabase secrets set EMAIL_FROM="Abdre <hello@abrobiz.com>"`) — it always
overrides the automatic domain-based default.

### Alternative: Gmail SMTP (skip if you did step 2 above)

Needs 2-Step Verification on the Gmail account, then a Google Account →
**Security → 2-Step Verification → App passwords** entry for "Mail" (a
16-character password — not the account's regular login password).

```bash
supabase secrets set MAIL_SERVER=smtp.gmail.com
supabase secrets set MAIL_PORT=587
supabase secrets set MAIL_USERNAME=oneabdre@gmail.com
supabase secrets set MAIL_PASSWORD=your16charapppassword
supabase secrets set MAIL_USE_TLS=true
supabase secrets set 'MAIL_FROM=Abdre <oneabdre@gmail.com>'
supabase secrets set SITE_URL=https://abrobiz.com
supabase secrets set APP_NAME=AbroBiz
```

`MAIL_PASSWORD` must be a Google App Password, not your regular Gmail
password. These settings power signup verification, forgot-password, and
admin-announcement emails. Gmail sends them as `oneabdre@gmail.com`; owning
`abrobiz.com` does not authorize Gmail to send as `@abrobiz.com`. For a
domain sender such as `hello@abrobiz.com`, verify the domain with an SMTP
provider and set `MAIL_FROM` to that verified address.

## 3. Deploy the functions

```bash
supabase functions deploy send-verification-email
supabase functions deploy request-password-reset
supabase functions deploy reset-password
supabase functions deploy send-announcement
supabase functions deploy import-template
```

Run migrations `0013_email_verification.sql` through `0023_production_security.sql`
if you haven't already (in order — each depends on the last).

## Try it

- **Signup:** land in the dashboard immediately, confirm via the banner at
  the top (or its **Resend link** button if the email doesn't arrive).
- **Forgot password:** from the login page, "Forgot password?" → check
  inbox → the link opens `/reset-password` to set a new one. The response
  is deliberately identical whether or not the email matched an account, so
  this can't be used to discover who has an account here.
- **Announcements:** **Admin → Announcements** — compose a subject + message,
  send to every business owner, see delivery history below the form.

Tests: `cd app/supabase/functions && deno test --node-modules-dir=none --allow-net --allow-env _shared/mailer_test.ts`
(`--allow-env`/`--allow-net` are needed because nodemailer touches both
internally — harmless in tests, which inject a fake sender rather than
actually connecting anywhere.)

**One limitation worth knowing:** announcements send one-by-one in a single
request, which is fine for the platform's current size but would need a
proper queue if the owner list grows into the thousands (Edge Functions
have an execution time limit). Not a concern yet — just flagging it as a
"revisit later" rather than something silently broken.

---

# Setup Guide — Phase 6 (Google sign-in)

For the current signup and security behavior, also run
`0020_demo_business_seed.sql`, `0021_role_security_hardening.sql`, and
`0022_subdomain_rules.sql` after
`0019_restaurant_cafe_template.sql`. New owners receive one complete editable
demo website for their selected business type; owners edit the content from
Dashboard → Settings and Dashboard → Catalog.

## Admin-managed GitHub templates

After applying `0017_templates.sql`, `0018_professional_templates.sql`, and
`0019_restaurant_cafe_template.sql`, deploy the importer:

```bash
supabase functions deploy import-template
```

Open **Admin → Settings → Templates** and paste a public GitHub repository
URL. The importer reads repository metadata and an optional root
`template.json` manifest. It stores safe theme configuration; it never runs
arbitrary GitHub code in the app.

Example `template.json`:

```json
{
  "slug": "blue-ocean",
  "name": "Blue Ocean",
  "description": "A calm blue storefront.",
  "previewUrl": "https://example.com/preview.png",
  "config": {
    "bg": "#071A2B",
    "card": "#0E2A40",
    "text": "#F5FBFF",
    "textDim": "rgba(245,251,255,0.62)",
    "border": "rgba(255,255,255,0.12)",
    "heroBg": "#04111D"
  }
}
```

The imported template becomes available in the owner setup wizard and
business settings. Built-in templates remain available as fallbacks.

## 1. Create a Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
1. Create a project (or use an existing one).
2. **Create Credentials → OAuth client ID** → Application type: **Web application**.
3. Under **Authorized redirect URIs**, add the callback for the same Supabase
   project used by `VITE_SUPABASE_URL`:
   `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Save, then copy the **Client ID** and **Client Secret**.

## 2. Enable Google in Supabase

If the Supabase custom auth domain is active, you can keep the OAuth hostname
branded as AbroBiz. Activate `auth.abrobiz.com`, add its DNS CNAME and
verification records, then set this production frontend variable:

```text
VITE_SUPABASE_AUTH_URL=https://auth.abrobiz.com
```

Use `https://auth.abrobiz.com/auth/v1/callback` as the Google OAuth callback
only after that custom domain is active and the variable above is deployed.
Otherwise keep using the project callback from step 3. The two callback URLs
must not be mixed with a different Supabase project.

**Authentication → Providers → Google** in the Supabase dashboard → toggle
it on, paste in the Client ID and Client Secret from above, save.

## 3. Nothing else to deploy

The "Continue with Google" button is already on both Login and Register —
it calls `supabase.auth.signInWithOAuth({ provider: 'google' })`, which
Supabase handles end-to-end once the provider above is configured. No new
secrets, no new functions.

**One thing worth knowing:** Google already verifies the account's email,
so Google sign-ins skip this app's own verification flow automatically —
`profiles.email_verified_at` gets set the moment the account is created,
and they'll never see the confirmation banner. Only email/password signups
go through Phase 5's flow. This is handled by
`0014_google_signin.sql`, which checks *how* the account signed up
(`raw_app_meta_data->>'provider'`) rather than just whether Supabase
marked the email confirmed — the latter gets set for every signup once
"Confirm email" is off, so it can't tell Google sign-ins apart from regular
ones on its own.

## Try it

From the login or register page, tap **Continue with Google**. First-time
sign-ins land in the setup wizard (no business yet); returning ones go
straight to the dashboard — same as password login.
