# AbroBiz first-run setup

This project is React + Supabase. It is not a Flask server, so the root `.env`
file is used by Vite locally, while Supabase Edge Functions need their secrets
uploaded separately.

## 1. Fill in `.env`

Open `.env` and fill these values:

```env
MAIL_PASSWORD=your_google_app_password
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

For Gmail, `MAIL_PASSWORD` must be a Google App Password. Do not use the
normal Gmail password.

Use the same Supabase project ref as `VITE_SUPABASE_URL` in `.env`. The
production site is:

```text
https://abrobiz.com
```

## 2. Apply the database migrations

The email/reset/announcement/template tables are not optional. Apply these
files in order from the Supabase Dashboard → SQL Editor:

1. [0013_email_verification.sql](supabase/migrations/0013_email_verification.sql)
2. [0014_google_signin.sql](supabase/migrations/0014_google_signin.sql)
3. [0015_password_reset.sql](supabase/migrations/0015_password_reset.sql)
4. [0016_announcements.sql](supabase/migrations/0016_announcements.sql)
5. [0017_templates.sql](supabase/migrations/0017_templates.sql)
6. [0018_professional_templates.sql](supabase/migrations/0018_professional_templates.sql)
7. [0019_restaurant_cafe_template.sql](supabase/migrations/0019_restaurant_cafe_template.sql)
8. [0020_demo_business_seed.sql](supabase/migrations/0020_demo_business_seed.sql)
9. [0021_role_security_hardening.sql](supabase/migrations/0021_role_security_hardening.sql)
10. [0022_subdomain_rules.sql](supabase/migrations/0022_subdomain_rules.sql)
11. [0023_production_security.sql](supabase/migrations/0023_production_security.sql)
12. [0024_tenant_subdomain_isolation.sql](supabase/migrations/0024_tenant_subdomain_isolation.sql)

Paste and run one file at a time. The first four base migrations must already
be applied; if not, run all files in `supabase/migrations` in filename order.

## 3. Upload email secrets and deploy functions

Install the Supabase CLI, then run these commands from the project folder:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set --env-file .env

supabase functions deploy send-verification-email --project-ref YOUR_PROJECT_REF
supabase functions deploy request-password-reset --project-ref YOUR_PROJECT_REF
supabase functions deploy reset-password --project-ref YOUR_PROJECT_REF
supabase functions deploy send-announcement --project-ref YOUR_PROJECT_REF
supabase functions deploy import-template --project-ref YOUR_PROJECT_REF
```

The previous email failure was caused by these function URLs returning 404:
the functions had not been deployed. The root `.env` alone does not upload
secrets to a deployed Edge Function.

## 4. Turn off Supabase built-in email confirmation

In Supabase Dashboard:

1. Authentication → Providers → Email
2. Turn **Confirm email** off
3. Save

This app sends its own verification email through
`send-verification-email`. Leaving built-in confirmation on prevents the app
from receiving a session immediately after signup.

## 5. Enable Google sign-in

In Supabase Dashboard:

1. Authentication → Providers → Google
2. Switch **Google Enabled** on. It must visibly say **Enabled** after saving.
3. Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `.env` into the
   Supabase Google provider form. Values only in the local `.env` do not
   configure the hosted Supabase Auth server.
4. Save, then refresh the provider page and confirm Google is still enabled.

If the app shows:

```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

then Google is still disabled in Supabase. This error happens before Google
Cloud or redirect URLs are checked; enabling the provider is required first.

In Google Cloud Console, create a Web OAuth client and add:

Authorized JavaScript origins:

```text
https://abrobiz.com
http://127.0.0.1:5173
http://localhost:5173
```

Authorized redirect URI (when `VITE_SUPABASE_AUTH_URL` is not set):

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Replace `YOUR_PROJECT_REF` with the project ref in the active
`VITE_SUPABASE_URL`. Do not use a callback from a different Supabase project
or from the separate empty test project.

If `auth.abrobiz.com` has been activated as the Supabase custom auth domain and
`VITE_SUPABASE_AUTH_URL=https://auth.abrobiz.com` is set in the hosting
environment, use this exact callback instead:

```text
https://auth.abrobiz.com/auth/v1/callback
```

Do not use `http://127.0.0.1:5000/auth/google/callback`; that is a Flask
callback and this project does not use Flask for authentication.

Then in Supabase Dashboard → Authentication → URL Configuration, set:

Site URL:

```text
https://abrobiz.com
```

Additional Redirect URLs:

```text
https://abrobiz.com/dashboard
https://abrobiz.com/setup
http://127.0.0.1:5173/dashboard
http://127.0.0.1:5173/setup
http://localhost:5173/dashboard
http://localhost:5173/setup
```

After activating the custom auth domain, add
`VITE_SUPABASE_AUTH_URL=https://auth.abrobiz.com` to the production frontend
environment and redeploy. Google sign-in will then use AbroBiz's branded auth
hostname.

If Google shows `Error 400: redirect_uri_mismatch`, the callback registered in
Google Cloud does not exactly match the callback generated by the active
Supabase project. Check the callback first; `https://abrobiz.com/dashboard` is
only the app's post-login destination. Also make sure `supabase/config.toml`,
the frontend `VITE_SUPABASE_URL`, Supabase Google provider settings, and CLI
deployments all use the same project.

Google was currently disabled in the project, which is why the Google button
could not complete sign-in.

## 6. Run and test locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the printed local URL and test:

1. Register with a new email. Confirm that the verification email arrives.
2. Log out and log in with email/password.
3. Click **Forgot password?** and confirm the reset email arrives.
4. Click **Continue with Google** and confirm the browser returns to
   `/dashboard` or `/setup`.
5. As an admin, open Admin → Announcements and send a test announcement.

After the first launch, the owner can open **Dashboard -> Settings** to edit
the business name, type, tagline, story, logo, cover, gallery, accent color,
languages, template, opening hours, social links, currency, timezone, and
published status. Image uploads and gallery removals are saved immediately;
the other changes use **Save changes**. **Dashboard -> Catalog** controls every
category and item shown on the public site.

Each account is limited to one website. Signup creates a complete starter demo
for the selected type, including story, gallery, categories and sample items.
Those values are editable from Settings and Catalog, and changes refresh on
the public site automatically.

During signup, choose the subdomain label before `.abrobiz.com` (for example,
`habesha-kitchen.abrobiz.com`). It must be unique, and each account can reserve
only one subdomain.

If you are testing another user, sign out of the current account first and use
a different email or Google account. The setup page is blocked once an account
already owns a website.

## 7. Quick deployment checks

```powershell
Invoke-WebRequest `
  -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/request-password-reset" `
  -Method Options
```

After deployment, this should no longer return 404. A 401/405 response is
normal for a protected function without the correct request body or session.

The frontend fixes also make normal login continue working if the optional
email-verification migration has not yet been applied, but email delivery and
password reset still require the migrations and deployed functions above.

## 8. Enable one subdomain per business

The business slug is now the subdomain. For example, a business with slug
`habesha-kitchen` gets:

```text
https://habesha-kitchen.abrobiz.com
```

The old URL remains available as a fallback:

```text
https://abrobiz.com/r/habesha-kitchen
```

The app automatically loads the business by the first-level subdomain. The
public site is one scrolling page with sticky Home, Menu, About, Contact, and
booking navigation; `/menu`, `/about`, `/contact`, and `/book` remain supported
as deep links and scroll to the matching section. Public business details and
catalog data refresh automatically every 30 seconds.

### Netlify setup (this project has `netlify.toml`)

1. Open Netlify → your site → Domain management.
2. Add `abrobiz.com` as the production custom domain.
3. Use Netlify DNS for `abrobiz.com`, or delegate the domain's nameservers to
   Netlify as instructed in the dashboard. Netlify DNS provides wildcard SSL.
4. Add/enable the wildcard domain `*.abrobiz.com` for the same site if the
   domain panel offers it.
5. If your DNS remains at another provider, create a wildcard DNS record using
   the exact target Netlify shows for your site:

```text
Type:   CNAME
Name:   *
Target: your-site-name.netlify.app
```

Do not guess the target; use the value shown in Netlify Domain management.
You must also have HTTPS/wildcard certificate status marked active before
sharing subdomain links.

### Vercel alternative

If you deploy the same app to Vercel instead, add both `abrobiz.com` and
`*.abrobiz.com` in Vercel Project → Settings → Domains. Vercel requires the
nameservers method for wildcard certificates, so follow the nameservers it
provides rather than adding only a random CNAME.

### Verify

Create or use a business whose slug is `test-business`, then open:

```text
https://test-business.abrobiz.com
```

The dashboard's **View live site**, share link, and QR code now use the
subdomain URL automatically. On local development, the equivalent is:

```text
http://test-business.localhost:5173
```

Wildcard DNS/SSL configuration is a hosting/DNS action and cannot be enabled
by frontend code alone.

Official references:

- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase function secrets](https://supabase.com/docs/guides/functions/secrets)
