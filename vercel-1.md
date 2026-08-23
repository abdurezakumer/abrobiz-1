# AbroBiz deployment guide: GitHub → Vercel → Supabase

This guide takes the current project to `https://abrobiz.com` and keeps
Google sign-in, verification email, password reset, announcements, subdomains,
and Supabase Edge Functions on the same production project.

The repository is a Vite React application. Vercel builds it with `npm run
build` and serves the generated `dist/` directory. Supabase remains the
database, authentication provider, and server-side email/function host.

## 1. Important project choice

Use one Supabase project everywhere. This workspace is configured for the
production project in `.env` and `supabase/config.toml`. Do not switch the
frontend to the separate empty test project.

In PowerShell, confirm the project ref without printing secrets:

```powershell
supabase.cmd projects list
Get-Content .env | Where-Object { $_ -match '^VITE_SUPABASE_URL=' }
```

Set a local variable for the commands below using the ref shown by the active
`VITE_SUPABASE_URL`:

```powershell
$env:SUPABASE_PROJECT_REF = "YOUR_PRODUCTION_PROJECT_REF"
```

## 2. Keep secrets out of GitHub

Already ignored by this project:

- `.env`
- `.env.local`
- `node_modules/`
- `dist/`

Never commit a Gmail App Password, Google Client Secret, Supabase service-role
key, database password, or Resend API key. The browser may contain only the
Supabase URL and publishable/anon key; never put a service-role key in a
`VITE_*` variable.

If a secret has ever been committed or shared publicly, revoke it and create a
replacement before deployment.

## 3. Local production check

From the project directory:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test -- --run --pool=threads --maxWorkers=1 --reporter=dot
npm.cmd run build
```

The build must finish successfully and create `dist/`. The large JavaScript
chunk warning is a performance warning, not a deployment failure.

## 4. Push the cleaned code to GitHub

The requested repository is:

```text
https://github.com/abdurezakumer/abrobiz-1
```

If this folder is not already a Git repository:

```powershell
git init
git branch -M main
git remote add origin https://github.com/abdurezakumer/abrobiz-1.git
```

If `origin` already exists, inspect it instead of adding a second remote:

```powershell
git remote -v
git remote set-url origin https://github.com/abdurezakumer/abrobiz-1.git
```

Review the files before committing:

```powershell
git status --short
git diff -- . ':!.env'
```

Commit and push:

```powershell
git add -A
git commit -m "Prepare AbroBiz for production deployment"
git push -u origin main
```

If GitHub rejects the push because the remote already has a README or another
commit, stop and review the remote before merging:

```powershell
git fetch origin
git log --oneline --all --decorate -10
git pull --rebase origin main
git push -u origin main
```

Do not force-push over an existing repository unless you have explicitly
confirmed that its history can be replaced.

## 5. Apply the Supabase database migrations

The migrations are in `supabase/migrations/` and must be applied in filename
order from `0001_schema.sql` through `0024_tenant_subdomain_isolation.sql`.

For a new database, the safest choices are:

1. Supabase Dashboard → SQL Editor: open and run each migration in order; or
2. Link the CLI to the new project and run the migrations after reviewing the
   migration history.

Check history first:

```powershell
supabase.cmd migration list --project-ref $env:SUPABASE_PROJECT_REF
```

Do not blindly run every migration against an existing database whose schema
was created manually. Take a database backup, compare the existing schema,
and apply only the missing migrations. Migrations `0023` and `0024` are required before
deploying the current rate-limited Edge Functions because it creates the rate
limit table, RPC, and triggers.

After migration, verify in SQL Editor or pgAdmin that these exist:

```sql
select to_regclass('public.profiles');
select to_regclass('public.businesses');
select to_regclass('public.email_verification_tokens');
select to_regclass('public.rate_limits');
select to_regclass('public.businesses');
```

## 6. Configure Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:

Site URL:

```text
https://abrobiz.com
```

Additional Redirect URLs:

```text
https://abrobiz.com/setup
https://abrobiz.com/dashboard
https://www.abrobiz.com/setup
https://www.abrobiz.com/dashboard
http://localhost:5173/setup
http://localhost:5173/dashboard
http://127.0.0.1:5173/setup
http://127.0.0.1:5173/dashboard
```

For the custom verification flow, turn Supabase built-in email confirmation
off. The app sends its own verification message through the
`send-verification-email` Edge Function.

### Google sign-in

1. In Google Cloud Console, create or select a Web OAuth client.
2. Add `https://abrobiz.com` and `http://localhost:5173` as authorized
   JavaScript origins.
3. Add the exact Supabase callback shown on the Supabase Google provider page.
   For the standard project hostname it is:

   ```text
   https://YOUR_PRODUCTION_PROJECT_REF.supabase.co/auth/v1/callback
   ```

4. In Supabase Dashboard → Authentication → Providers → Google, enable Google
   and paste the same Client ID and Client Secret.
5. Save and refresh the provider page. It must remain enabled.

The Google callback above is different from the app destination
`https://abrobiz.com/setup`. Google uses the Supabase callback; Supabase then
returns the user to the app. Both the Google callback and Supabase app redirect
URLs must be configured.

If `auth.abrobiz.com` is later activated as a Supabase custom auth domain, set
`VITE_SUPABASE_AUTH_URL=https://auth.abrobiz.com` in Vercel and use this Google
callback instead:

```text
https://auth.abrobiz.com/auth/v1/callback
```

Do not set that variable before the custom domain is active.

## 7. Configure email and Edge Function secrets

Set these as Supabase Edge Function secrets. Do not put them in Vercel:

```text
APP_NAME=AbroBiz
SITE_URL=https://abrobiz.com
CORS_ORIGINS=https://abrobiz.com,https://www.abrobiz.com,http://localhost:5173,http://127.0.0.1:5173
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=oneabdre@gmail.com
MAIL_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
MAIL_USE_TLS=true
MAIL_FROM=AbroBiz <oneabdre@gmail.com>
```

The Gmail password must be a Google App Password created after enabling
2-Step Verification. It is not the normal Gmail password. For higher volume,
use Resend and set `RESEND_API_KEY` plus `EMAIL_DOMAIN` instead of Gmail SMTP.

Gmail will show the Gmail account as the authenticated sender. For mail that
is actually sent from AbroBiz, verify `abrobiz.com` with Resend or another
authenticated domain provider, then set:

```text
RESEND_API_KEY=YOUR_PROVIDER_KEY
EMAIL_DOMAIN=abrobiz.com
EMAIL_FROM=AbroBiz <noreply@abrobiz.com>
```

Add the provider's SPF, DKIM, and verification DNS records before testing.

CLI form:

```powershell
supabase.cmd secrets set --project-ref $env:SUPABASE_PROJECT_REF `
  APP_NAME="AbroBiz" `
  SITE_URL="https://abrobiz.com" `
  CORS_ORIGINS="https://abrobiz.com,https://www.abrobiz.com,http://localhost:5173,http://127.0.0.1:5173" `
  MAIL_SERVER="smtp.gmail.com" `
  MAIL_PORT="587" `
  MAIL_USERNAME="oneabdre@gmail.com" `
  MAIL_PASSWORD="PASTE_APP_PASSWORD_HERE" `
  MAIL_USE_TLS="true" `
  MAIL_FROM="AbroBiz <oneabdre@gmail.com>"
```

Use the Dashboard Secrets page if you prefer not to put the App Password in a
terminal command. Confirm names only:

```powershell
supabase.cmd secrets list --project-ref $env:SUPABASE_PROJECT_REF
```

The output must contain the names, not values, for `APP_NAME`, `SITE_URL`,
`CORS_ORIGINS`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
`MAIL_USE_TLS`, and `MAIL_FROM`.

Deploy all current Edge Functions after migrations `0023` and `0024` and after setting the
secrets:

```powershell
supabase.cmd functions deploy --project-ref $env:SUPABASE_PROJECT_REF
supabase.cmd functions list --project-ref $env:SUPABASE_PROJECT_REF
```

The list should include at least:

- `send-verification-email`
- `request-password-reset`
- `reset-password`
- `send-announcement`
- `import-template`
- `notify-payment-submitted`

## 8. Create the Vercel project

### Dashboard method

1. Open Vercel and choose **Add New → Project**.
2. Import `abdurezakumer/abrobiz-1` from GitHub.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Install command: `npm ci`.
7. Keep the root directory as the repository root.

### Vercel environment variables

Add these for **Production** and, if you test previews, **Preview**:

```text
VITE_SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_SITE_URL=https://abrobiz.com
VITE_PLATFORM_DOMAIN=abrobiz.com
```

Do not add `MAIL_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, Google Client Secret,
database password, or any other server secret to Vercel. Vercel environment
changes apply only to new deployments, so redeploy after changing them.

Deploy from the Vercel dashboard, or install and use the CLI:

```powershell
npm.cmd install --global vercel
vercel login
vercel link
vercel env ls
vercel --prod
```

Test a preview first when possible, then deploy production:

```powershell
vercel
vercel --prod
```

## 9. Attach `abrobiz.com` and wildcard subdomains

In Vercel → Project → Settings → Domains, add:

```text
abrobiz.com
www.abrobiz.com
*.abrobiz.com
```

For the apex domain, Vercel will show the required A record. For `www`, it
will show the required CNAME. Use the exact values shown by Vercel rather than
copying a stale DNS value from another project.

Wildcard domains require Vercel nameserver configuration. Delegate the domain
to the Vercel nameservers shown in the Domains page, or follow the exact
verification method Vercel displays. Do not create a separate DNS record for
every future business; the wildcard handles them all.

CLI inspection:

```powershell
vercel domains ls
vercel domains inspect abrobiz.com
vercel domains inspect '*.abrobiz.com'
```

Wait until Vercel shows the domain as verified and SSL as active. Then verify:

```powershell
curl.exe -I https://abrobiz.com
curl.exe -I https://www.abrobiz.com
```

## 10. pgAdmin connection to Supabase

Use pgAdmin for database inspection and controlled SQL administration. Never
put the database password in GitHub, Vercel, frontend code, or screenshots.

1. Supabase Dashboard → **Project Settings → Database**.
2. Click **Connect** and choose the **Session pooler** parameters.
3. Download the Supabase SSL certificate from Database Settings.
4. In pgAdmin, right-click **Servers → Register → Server**.
5. On **General**, use a name such as `AbroBiz production`.
6. On **Connection**, copy the host, port, database, username, and password
   from the Supabase Session pooler dialog. Do not guess the hostname.
7. On **SSL**, set SSL mode to `verify-full` when supported and select the
   downloaded certificate as the Root certificate.
8. Save and connect.

Use the pooler values shown in the current Supabase dashboard because host,
port, and username formats can vary by project. The official pgAdmin guide
recommends the Session pooler parameters and SSL certificate.

Before modifying production:

```sql
select current_database(), current_user, now();
select to_regclass('public.profiles');
select to_regclass('public.businesses');
```

For migration work, use a transaction when possible, keep a backup, and run
the numbered SQL files in order. Do not edit or delete user/business data from
pgAdmin unless the change is intentional and recorded.

## 11. End-to-end verification after the site is online

Run these tests in a private browser window:

1. Open `https://abrobiz.com` and confirm the HTTPS lock is present.
2. Register with email/password and confirm the verification email arrives.
3. Open the verification link and confirm the account can continue to setup.
4. Register with Google and confirm Google returns to `/setup`.
5. Choose a business type, unique subdomain, and template; publish the site.
6. Open `https://chosen-subdomain.abrobiz.com`.
7. Request password reset and confirm the email arrives.
8. As an admin, send an announcement and verify the result count.
9. Confirm a second account cannot reserve the same subdomain.
10. Confirm browser requests from localhost and `abrobiz.com` do not fail CORS.
11. Confirm security headers exist:

```powershell
curl.exe -I https://abrobiz.com
```

Look for `Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.

## 12. Troubleshooting

### Google says `redirect_uri_mismatch`

The Google Cloud callback must be the Supabase callback for the same project
used by `VITE_SUPABASE_URL`. It is not `https://abrobiz.com/setup` and it is
not the old Flask callback. Check the Google provider page in Supabase and
copy its callback exactly.

### Email says service unavailable or no email arrives

Check all of these:

```powershell
supabase.cmd functions list --project-ref $env:SUPABASE_PROJECT_REF
supabase.cmd secrets list --project-ref $env:SUPABASE_PROJECT_REF
supabase.cmd functions logs send-verification-email --project-ref $env:SUPABASE_PROJECT_REF
```

Confirm migration `0013_email_verification.sql`, `0023_production_security.sql`,
and `0024_tenant_subdomain_isolation.sql`
are applied, the function is deployed to the same project as the frontend, and
the Gmail App Password has no spaces. A `502` from the function means SMTP
rejected the message; inspect the function log without sharing secrets.

### Vercel works but localhost does not

Confirm `CORS_ORIGINS` contains both localhost origins, redeploy the Supabase
functions, and restart the Vite dev server. Vite reads environment values at
startup/build time.

### `/setup` or `/dashboard` refreshes to a 404

Confirm the repository's `vercel.json` is deployed. Its SPA rewrite sends
unknown browser routes to `index.html`.

### One owner sees another owner's subdomain

Apply migration `0024_tenant_subdomain_isolation.sql` and redeploy the frontend.
The dashboard lookup is explicitly filtered by the signed-in owner; published
storefront reads remain public for customers.

### Subdomain opens the platform landing page

Confirm `*.abrobiz.com` is verified on Vercel, the DNS wildcard is delegated
through Vercel nameservers, and `VITE_PLATFORM_DOMAIN=abrobiz.com` is present
in the latest Vercel production deployment. The app accepts both
`slug.abrobiz.com` and `www.slug.abrobiz.com`; the nested hostname also needs
DNS and TLS coverage from the hosting provider.

## Official references

- [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel CLI deployment](https://vercel.com/docs/projects/deploy-from-cli)
- [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel wildcard domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase pgAdmin](https://supabase.com/docs/guides/database/pgadmin)
