# AbroBiz production deployment

This guide deploys the React storefront, database security, rate limiting,
authentication, and email Edge Functions. Run the steps in order.

## 1. Production requirements

- A Supabase project with the project ref configured in `supabase/config.toml`.
- A production frontend domain: `https://abrobiz.com`.
- DNS access for `abrobiz.com` and `*.abrobiz.com`.
- Node.js 20+ and the Supabase CLI 2+.
- A verified email sender. Resend with `noreply@abrobiz.com` is recommended;
  Gmail SMTP also works for initial launch.

Never commit `.env`, service-role keys, Gmail app passwords, Resend keys, or
Google client secrets. If any secret was copied into a public issue, chat, or
repository, revoke and replace it before launch.

## 2. Build and local checks

From the project directory:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test -- --run --pool=threads --maxWorkers=1 --reporter=dot
npm.cmd run build
```

The output must be in `dist/`. The bundle-size warning is non-blocking; do not
ship if typecheck, tests, or the build fails.

## 3. Configure the frontend environment

Create the production environment variables in Netlify or Vercel. Do not put
server-only email credentials in frontend variables.

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SITE_URL=https://abrobiz.com
VITE_PLATFORM_DOMAIN=abrobiz.com
```

Use the same `YOUR_PROJECT_REF` everywhere: the frontend variables, the
`project_id` in `supabase/config.toml`, the Supabase Dashboard where Google is
enabled, and every CLI deployment command. A redirect mismatch commonly means
the frontend is using one Supabase project while Google or the Edge Functions
are configured in another.

If a Supabase branded custom domain has been activated, use this additional
variable so Auth/API requests use AbroBiz:

```text
VITE_SUPABASE_AUTH_URL=https://auth.abrobiz.com
```

Do not set that variable until `auth.abrobiz.com` is active in Supabase and DNS.

The Edge Functions use this allowlist for browser requests. Set it as a
Supabase secret, not as a Vite variable:

```text
CORS_ORIGINS=https://abrobiz.com,https://www.abrobiz.com,http://localhost:5173,http://127.0.0.1:5173
```

## 4. Apply database migrations

For a new database, apply every migration in filename order:

```text
0001_schema.sql
0002_policies.sql
0003_seed.sql
0004_admin_rpc.sql
0005_fix_storage_policies.sql
0006_telegram.sql
0007_subscription_cron.sql
0008_storefront_pages.sql
0009_plan_features.sql
0010_bookings.sql
0011_ordering.sql
0012_reviews.sql
0013_email_verification.sql
0014_google_signin.sql
0015_password_reset.sql
0016_announcements.sql
0017_templates.sql
0018_professional_templates.sql
0019_restaurant_cafe_template.sql
0020_demo_business_seed.sql
0021_role_security_hardening.sql
0022_subdomain_rules.sql
0023_production_security.sql
```

For the existing AbroBiz project, migrations were previously run manually in
the SQL Editor. In that case, confirm the earlier migrations are already
present and run only any missing migration files, especially
`0023_production_security.sql`, in the SQL Editor. Do not blindly run
`supabase db push` against a database whose migration history was not recorded;
repair the migration history first or use the SQL Editor to avoid duplicate
object errors.

After `0023`, production has:

- RLS tenant checks with `WITH CHECK` protections.
- One owner and one website per account.
- Protected ownership and subdomain fields.
- Database-backed rate limiting for password reset, verification email,
  public contact, bookings, reviews, announcements, template imports, and
  payment notifications.
- A service-role-only rate-limit table and admin cleanup function.

## 5. Configure Supabase secrets

Link the project:

```powershell
supabase.cmd login
supabase.cmd link --project-ref YOUR_PROJECT_REF
```

Set the safe production values. The service role key is injected automatically
inside Edge Functions; never copy it into the browser or `.env` frontend values.

### Recommended: Resend

Verify `abrobiz.com` in Resend first, then run:

```powershell
supabase.cmd secrets set --project-ref YOUR_PROJECT_REF `
  APP_NAME=AbroBiz `
  SITE_URL=https://abrobiz.com `
  CORS_ORIGIN=https://abrobiz.com `
  EMAIL_DOMAIN=abrobiz.com `
  EMAIL_FROM="AbroBiz <noreply@abrobiz.com>" `
  RESEND_API_KEY=YOUR_RESEND_API_KEY
```

### Alternative: Gmail SMTP

Use a Google App Password, not the normal Gmail password:

```powershell
supabase.cmd secrets set --project-ref YOUR_PROJECT_REF `
  APP_NAME=AbroBiz `
  SITE_URL=https://abrobiz.com `
  CORS_ORIGIN=https://abrobiz.com `
  MAIL_SERVER=smtp.gmail.com `
  MAIL_PORT=587 `
  MAIL_USERNAME=YOUR_GMAIL_ADDRESS `
  MAIL_PASSWORD=YOUR_GMAIL_APP_PASSWORD `
  MAIL_USE_TLS=true `
  MAIL_FROM="AbroBiz <YOUR_GMAIL_ADDRESS>"
```

The mailer removes spaces from Gmail app passwords automatically. Gmail SMTP
has daily sending limits; use Resend for production volume.

List names only to confirm secrets exist:

```powershell
supabase.cmd secrets list --project-ref YOUR_PROJECT_REF
```

Never paste the secret values into logs or screenshots.

## 6. Configure authentication

In Supabase Authentication settings:

1. Disable built-in email confirmation because AbroBiz sends its own message.
2. Enable Google and configure the Google client ID and secret in the provider.
3. Set the Site URL to `https://abrobiz.com`.
4. Add these redirect URLs:

```text
https://abrobiz.com/dashboard
https://abrobiz.com/setup
http://localhost:5173/dashboard
http://localhost:5173/setup
http://127.0.0.1:5173/dashboard
http://127.0.0.1:5173/setup
```

For branded OAuth, activate the Supabase custom domain `auth.abrobiz.com`, add
the DNS CNAME/verification records, and add this Google callback:

```text
https://auth.abrobiz.com/auth/v1/callback
```

Keep the old project callback during migration, then remove it after confirming
the branded flow works. Supabase custom domains are a paid feature; see the
[official custom-domain documentation](https://supabase.com/docs/guides/platform/custom-domains).

If the branded auth domain is not active, the Google callback must instead be
the exact callback for the project in `VITE_SUPABASE_URL`:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

`https://abrobiz.com/dashboard` is the post-login redirect used by the app; it
is not the Google OAuth callback. Google requires the callback URL to match
exactly, including scheme, hostname, path, and trailing slash.

## 7. Deploy Edge Functions

Deploy one at a time to avoid the Windows CLI telemetry-file race:

```powershell
supabase.cmd functions deploy send-verification-email --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy request-password-reset --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy reset-password --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy send-announcement --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy import-template --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy notify-payment-submitted --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy telegram-webhook --project-ref YOUR_PROJECT_REF
supabase.cmd functions deploy subscription-cron --project-ref YOUR_PROJECT_REF
```

Confirm the critical functions are active and have the expected JWT mode:

```powershell
supabase.cmd functions list --project-ref YOUR_PROJECT_REF
```

Expected modes:

- `send-verification-email`: JWT required.
- `send-announcement`: JWT required and admin checked in code.
- `import-template`: JWT required and admin checked in code.
- `request-password-reset`: JWT disabled; the function rate-limits requests.
- `reset-password`: JWT disabled; the token and rate limiter protect the flow.

## 8. Deploy the frontend

### Netlify

1. Connect the repository.
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Add the variables from step 3.
5. Add `abrobiz.com` and `*.abrobiz.com` as domains.
6. Keep the included `netlify.toml` so SPA rewrites and security headers are
   applied.

### Vercel

1. Import the project.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add the variables from step 3.
6. Add `abrobiz.com` and `*.abrobiz.com` as domains.
7. Keep the included `vercel.json` for SPA rewrites and security headers.

## 9. DNS and TLS

Configure DNS at the domain provider:

- Root `abrobiz.com`: point to the frontend host using the host's documented
  A/ALIAS record.
- Wildcard `*.abrobiz.com`: point to the same frontend host.
- `auth.abrobiz.com`: use the CNAME/records supplied by Supabase custom-domain
  activation. The explicit auth record must take precedence over the wildcard.

Wait for the frontend host to issue TLS certificates for both the root and
wildcard domains. Test at least two different business subdomains.

## 10. Production verification

Run these checks after deployment:

1. Open `https://abrobiz.com` and confirm the landing page loads over HTTPS.
2. Create a test account and confirm the verification email arrives.
3. Click the verification link and confirm it marks the account verified.
4. Request password reset and confirm the email arrives; use the link once.
5. Test Google login and confirm it returns to `/dashboard` or `/setup`.
6. Create a business with a unique subdomain and open that subdomain.
7. Confirm another account cannot use the same subdomain.
8. Confirm an owner cannot open `/admin` or another owner’s data.
9. Submit contact, booking, review, and order forms from a public site.
10. Send one admin announcement and confirm its recipient count.
11. Open the public site in a private browser window and confirm no dashboard
    data is visible.
12. Confirm response headers include `Strict-Transport-Security`,
    `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.

Rate-limit checks:

- Six password-reset requests from one source within 15 minutes should be
  throttled.
- Four verification-email requests for one user within 15 minutes should be
  throttled.
- Repeated public contact/booking/review submissions using the same contact
  identity should eventually return a rate-limit error.

Google OAuth troubleshooting:

- If `VITE_SUPABASE_AUTH_URL` is unset, add
  `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` to the Google Web
  OAuth client, where `YOUR_PROJECT_REF` is the project in `VITE_SUPABASE_URL`.
- If the branded auth variable is set and `auth.abrobiz.com` is active, add
  `https://auth.abrobiz.com/auth/v1/callback` instead.
- Add `https://abrobiz.com/dashboard` to Supabase Authentication → URL
  Configuration → Redirect URLs, along with `/setup`, then rebuild the frontend because Vite
  embeds `VITE_*` values at build time.

Use function logs without exposing secret values:

```powershell
supabase.cmd functions logs send-verification-email --project-ref YOUR_PROJECT_REF
supabase.cmd functions logs request-password-reset --project-ref YOUR_PROJECT_REF
```

## 11. Operations and rollback

- Keep a database backup before applying a new migration.
- Apply migrations before deploying functions that depend on them.
- Deploy functions one at a time and check `functions list` after each batch.
- If the frontend fails, roll back to the previous hosting deployment.
- If a secret is exposed, revoke it immediately, set a replacement, and
  redeploy affected functions.
- Run `purge_rate_limits()` as an admin/service-role scheduled SQL task at least
  daily so expired limiter buckets do not accumulate indefinitely.
- Monitor Supabase database, Auth, Edge Function, and hosting logs during the
  first production launch.
