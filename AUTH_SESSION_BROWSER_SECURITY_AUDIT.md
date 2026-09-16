# AbroBiz Authentication, Session & Browser Storage Security Audit

Date: 2026-09-16
Scope: repository source, installed Supabase Auth client implementation, local configuration/templates, Supabase migration history, and read-only production HTTP checks
Method: static code/configuration review; no production writes, deployment, secret access, credential rotation, OAuth changes, policy changes, or destructive tests

## Exact answers

### Q1. Is login/session information stored in browser local storage or on the server?

**Both, but for different purposes.** The browser persists the Supabase session in `localStorage` under the exact key `abrobiz-auth-token`, because `src/lib/supabaseClient.ts:32-39` sets `persistSession: true` and does not provide a custom storage adapter. The persisted session contains access-token and refresh-token material plus the Supabase user/session metadata needed to restore the session.

Supabase Auth separately maintains the account identity and session/refresh-token state server-side. The application also maintains an authorization profile in `public.profiles`, but that profile is not the authentication session. There is no application-managed HttpOnly session cookie.

### Q2. Is authentication/session information encrypted while exchanged between browser and server?

**Yes in the production deployment paths, provided the configured Supabase and branded auth URLs are HTTPS.** The live `http://abrobiz.com/` endpoint redirects with HTTP 308 to HTTPS, and the live HTTPS response includes HSTS with `includeSubDomains`. `vercel.json` also sends `upgrade-insecure-requests` in the CSP.

The browser-to-Vercel requests use the HTTPS production origin. Supabase REST/Auth/Functions/Storage calls use the configured `VITE_SUPABASE_URL`; the optional `VITE_SUPABASE_AUTH_URL` only rewrites `/auth/v1` requests in `routedFetch`. Edge Functions forward the browser bearer token in an `Authorization` header to Supabase over the function's HTTPS service URL. Google Identity Services is loaded from `https://accounts.google.com/gsi/client`.

TLS protects the connection in transit. It does not protect a token after JavaScript or a browser extension has access to the browser context, and it does not make a bearer token revocable before its JWT expiry.

### Q3. Can a user see their login status/session information through Chrome Developer Tools?

**Yes, for their own browser session.** A legitimate user can inspect:

- the `abrobiz-auth-token` localStorage entry;
- access-token and refresh-token fields in that entry, without revealing any values in this report;
- their Supabase user ID, email, session timestamps, expiry metadata, and JWT claims;
- their own React-visible login/profile state;
- authenticated network requests and their `Authorization: Bearer ...` headers;
- any non-HttpOnly cookies sent by the browser, although this application does not use cookies for its app session.

There are no HttpOnly application auth cookies for the user to inspect or for the application to rely on. A user being able to inspect their own browser is expected for this architecture. Modifying localStorage, React state, or displayed role text does not change the signed JWT, the database profile, Edge Function authorization, or RLS result.

### Q4. What technology authenticates the user?

The implementation uses:

- Supabase Auth (`@supabase/supabase-js` 2.111.0 / `@supabase/auth-js` 2.111.0);
- JWT access tokens and refresh tokens in a Supabase Auth session;
- email/password authentication through the `login` Edge Function and Supabase `signInWithPassword`;
- custom email signup/OTP verification through `signup` and `verify-signup-otp` Edge Functions, followed by `supabase.auth.setSession`;
- Google Identity Services credential flow followed by `supabase.auth.signInWithIdToken`;
- a per-request Google nonce generated in `src/lib/authActions.ts:39-61`.

This is not a custom session-cookie system. The Google implementation inspected here is a GIS credential/ID-token exchange, not the application's `signInWithOAuth` redirect flow. PKCE and an OAuth callback URL are therefore not used by the current frontend Google path.

### Q5. What technology authorizes the user?

Authentication establishes the Supabase identity. Authorization is implemented by:

- React route guards in `src/components/Guards.tsx` for user experience and navigation;
- database-backed roles in `public.profiles.role` and `public.profiles.admin_role`;
- server-side Edge Function checks using the caller's bearer token and `auth.getUser()`;
- PostgreSQL functions such as `is_admin()`, `is_super_admin()`, and `has_admin_permission()`;
- Supabase/PostgreSQL RLS policies using `auth.uid()`, ownership relationships, role/permission functions, and public storefront conditions;
- the local but not-yet-applied final hardening migration `supabase/migrations/0050_full_security_remediation.sql`, which adds privileged MFA (`aal2`) to the permission boundary.

The client role matrix is convenience/UI authorization. The server and RLS boundary is the security boundary. The browser is not trusted.

## 1. Complete authentication flow

### Application bootstrap

1. `src/main.tsx` renders `ErrorBoundary`, `BrowserRouter`, and `App`.
2. `src/App.tsx` places all routes under `AuthProvider`.
3. `src/lib/authContext.tsx` calls `supabase.auth.getSession()` on startup and registers `supabase.auth.onAuthStateChange()`.
4. The provider loads the matching row from `public.profiles`, then the owner's business/subscription data. It uses a generation counter to prevent an older login request from overwriting a newer login/logout state.

### Email/password sign-in

1. `src/pages/Login.tsx` collects email/password and an optional/enforced Turnstile token.
2. `src/lib/authActions.ts:28-34` invokes the `login` Edge Function.
3. `supabase/functions/login/index.ts` validates the body, applies IP/account rate limits and Turnstile policy, then calls Supabase `auth.signInWithPassword` using a non-persisting server-side client.
4. The function returns the Supabase `Session` to the browser. It does not return a custom application cookie.
5. `signIn()` calls `supabase.auth.setSession(data.session)`.
6. Supabase Auth persists the session under `abrobiz-auth-token`, emits the auth event, and `AuthProvider` loads the profile/business state.

### Email signup and OTP verification

1. `src/pages/Register.tsx` calls `signUp()` in `src/lib/authActions.ts`.
2. `supabase/functions/signup/index.ts` validates the request, terms/privacy acceptance, password policy, rate limits, and Turnstile; it creates/generates the Auth signup link/OTP using service-role Auth operations and sends the code through the AbroBiz mailer.
3. The signup function intentionally returns a generic response without user ID or OTP metadata.
4. `src/pages/VerifyEmail.tsx` submits the email and code to `verify-signup-otp`.
5. `supabase/functions/verify-signup-otp/index.ts` verifies the code against Supabase Auth and returns the resulting session.
6. The browser calls `supabase.auth.setSession(data.session)`, then records legal acceptance through the controlled RPC and loads the profile.

### Google sign-in/signup

1. `src/components/GoogleSignInButton.tsx` loads GIS from `https://accounts.google.com/gsi/client`.
2. `src/lib/authActions.ts` generates a random nonce with `crypto.getRandomValues`, initializes GIS in popup mode, and renders the button.
3. Google returns a credential to the browser callback.
4. The browser sends the ID token and nonce to `supabase.auth.signInWithIdToken({ provider: 'google', ... })`.
5. Supabase Auth validates the Google token and creates/restores the Supabase session. If a referral code exists, the existing server-side attribution RPC is called after authentication.
6. No Google access token or Google refresh token is explicitly stored or forwarded by AbroBiz.

### Authenticated requests

- Supabase client requests use the current session's bearer authorization automatically.
- `supabase.functions.invoke(...)` sends the session authorization to protected Edge Functions through the Supabase client.
- `src/lib/api/payments.ts:53-76` obtains the current session and explicitly sets the bearer header for the upload XHR.
- Protected functions validate bearer syntax and, where applicable, call `auth.getUser()` before using service-role database access.
- PostgREST and Storage apply database/storage RLS; Edge Functions apply their own authorization and input checks.

### Logout

1. `src/components/DashboardLayout.tsx`, `src/components/AdminLayout.tsx`, and `src/pages/MfaSetup.tsx` call the context `signOut()` handler.
2. `src/lib/authContext.tsx:209-211` calls `supabase.auth.signOut()` and the layouts navigate to `/login`.
3. Supabase Auth removes the browser session, emits `SIGNED_OUT`, and uses the SDK default global scope. Installed `@supabase/auth-js` source confirms the default scope is `global`, which revokes refresh-token sessions across devices where supported.
4. The application receives the auth event and clears the React session/profile/business state through `loadForSession(null, ...)`.

## 2. Browser storage inventory

| Data | Location | Client-readable? | Server-side? | Security implication |
|---|---|---:|---:|---|
| Access token | `localStorage['abrobiz-auth-token']`, inside Supabase session JSON | Yes | Yes, represented as a signed Supabase JWT and validated by Auth/PostgREST/Functions | XSS can copy it and use it until expiry; signing/expiry/RLS still prevent changing its claims or permissions. |
| Refresh token | `localStorage['abrobiz-auth-token']`, inside Supabase session JSON | Yes | Yes, managed by Supabase Auth session state | XSS can attempt refresh while the refresh session is valid; logout/password/session controls are important. |
| Supabase user ID/email/metadata | Session JSON and React memory | Yes | `auth.users` and Auth-managed identity | Expected user-visible identity data; not an authorization grant. |
| Application role/admin role | React memory from `public.profiles`; not written by AbroBiz to localStorage | In page state and network responses | `public.profiles.role`, `public.profiles.admin_role` | Client changes affect UI only; server/RLS must use the database profile, not this state. |
| Business ID | React/query state and request parameters/headers | Yes | `public.businesses` ownership relationships | Client can change an ID, so every API/RLS path must enforce ownership/permission. The reviewed owner and storage paths do so; integration testing remains required. |
| Session state | React `AuthProvider` memory plus persisted Supabase session | Yes | Supabase Auth session/refresh state | React state can be spoofed visually; backend authorization is the real control. |
| Password | Form memory and HTTPS request body only | Temporarily to page JavaScript and the receiving server | Supabase Auth stores a provider-managed password representation; not in `public.profiles` | Never persisted by AbroBiz; must rely on TLS and server/provider handling. |
| Password reset token | Query string `token` on `/reset-password`, then request body to `reset-password` | Yes while the reset page is open and in browser history/address bar | Hashed/claimed/consumed through protected reset-token RPCs | URL tokens can leak through history/screenshots/extensions or poorly controlled logs; one-time expiry/claim limits blast radius. |
| OTP code | React component state and HTTPS request body | Yes while entered | Supabase Auth verifies the code | Not placed in localStorage by the app; rate limits and expiry apply. |
| UI error marker | `sessionStorage['abrobiz:email-error']` in `SetupWizard.tsx` | Yes | No | Non-authentication UI state; removed after reading. |
| Cookies | No app-auth cookie is created in the reviewed source | Browser may have unrelated provider/site cookies | Not the AbroBiz session mechanism | No HttpOnly/Secure/SameSite cookie protects this SPA session. |
| IndexedDB | No application auth use found; payment-proof cache is memory-only | N/A | No | Sensitive payment proof is not persisted through the app cache. |

Supabase Auth's installed client source confirms that with `persistSession: true` and no custom adapter it selects `globalThis.localStorage` in a browser; it falls back to in-memory storage only when localStorage is unavailable.

## 3. Server/provider state vs application state

| Layer | What it represents | Evidence |
|---|---|---|
| Authentication identity | Supabase Auth `auth.users`, email/provider identity, email-confirmation status, Auth metadata, provider identity | `supabase/functions/login`, `signup`, `verify-signup-otp`, migration `0026_phase1_auth_security.sql` |
| Browser session | Access JWT, refresh token, expiry/session metadata held by Supabase JS and persisted under the browser storage key | `src/lib/supabaseClient.ts`, installed `@supabase/auth-js` source |
| Application profile | Name, phone, email mirror, legal timestamps, platform ID, role/admin role | `public.profiles`, `src/lib/authContext.tsx`, migrations `0001`, `0026`, `0034` |
| Authorization/RBAC | Business ownership and admin permission matrix, enforced by PostgreSQL functions/RLS and Edge Function checks | migrations `0024`, `0027`, `0034`, `0050`; `src/components/Guards.tsx` |
| Business tenant | Business row, owner ID, slug/subdomain, published/block status, content | `public.businesses`, `src/lib/api/businesses.ts`, tenant policies |
| Operational/session events | Auth state changes, storage writes, audit logs, notification/activity rows | Supabase Auth events, `public.admin_logs`, application notifications/activity tables |

The repository does not contain Supabase Auth's internal database schema or provider session TTL configuration. Exact server-side session retention, refresh-token reuse/rotation settings, password-revoke behavior, and provider login timestamps must be verified in the Supabase project settings/logs.

## 4. Token and session behavior

| Item | Finding |
|---|---|
| Access token | Supabase JWT returned in the session and sent as `Authorization: Bearer ...`. Claims are signed by Supabase; the browser can read but cannot validly rewrite them. |
| Refresh token | Supabase session refresh token persisted in the same localStorage session object. The SDK uses it to refresh access tokens automatically. |
| Session | Supabase Auth `Session` object, restored by `getSession()` and observed by `onAuthStateChange()`. |
| Expiration | The exact JWT lifetime is not configured in repository files and could not be read from the local environment because no usable Supabase URL/key pair is present there. Do not assume a numeric lifetime from source. |
| Refresh mechanism | `autoRefreshToken: true` in `src/lib/supabaseClient.ts`; the Supabase client refreshes while the browser session is active and removes the session after refresh failure/expiry. |
| Logout | `supabase.auth.signOut()` default scope is `global` in the installed SDK: local storage is cleared and refresh-token sessions are revoked server-side where supported. An already-issued access JWT cannot be revoked by Supabase before its expiry, according to the installed SDK source. |
| Privileged inactivity | `AuthProvider` signs out privileged browser sessions after 30 minutes without pointer/keyboard/touch activity. This is client-side convenience, not a server-side token lifetime. |

### Important logout residual

Logout is correct for the normal browser session, but a captured access JWT is a bearer credential. Global sign-out revokes refresh sessions; it does not retroactively invalidate an already-issued JWT before its expiry. The practical mitigation is a short provider JWT expiry, reauthentication/MFA for privileged or high-risk actions, and server-side checks for sensitive operations. The exact deployed JWT expiry and endpoint behavior are not verified in this read-only audit.

## 5. Authorization and RBAC audit

### Client-side controls

- `RequireAuth`, `RequireOwner`, `RequireAdmin`, `RequireAdminPermission`, and `RequireSuperAdmin` in `src/components/Guards.tsx` redirect users and hide pages.
- `hasAdminPermission()` in `src/lib/api/adminControl.ts` duplicates the permission matrix for UI navigation.
- `AuthProvider` maps `public.profiles` into React memory and checks MFA assurance for privileged roles.

These checks are not sufficient on their own. A user can edit localStorage, DevTools state, request parameters, and UI code.

### Server/database controls

- Edge Functions require bearer syntax and usually call Supabase `auth.getUser()` before privileged work.
- Owner operations use ownership relationships such as `businesses.owner_id = auth.uid()`.
- Public storefront reads are limited by published/unblocked conditions and public-safe selected data.
- RLS policies use `auth.uid()`, tenant relationships, and server-side role/permission functions.
- Roles are stored in `public.profiles`, not accepted from client-submitted role fields.
- The profile trigger and `super_admin_assign_admin_role` RPC protect role changes.
- Migration `0050` adds `aal2` to privileged functions and replaces broad legacy role checks with explicit permission names.

### Can client role manipulation grant access?

**Not through the reviewed normal data path.** Changing a displayed role, React state, request business ID, or localStorage value can change what the UI shows or requests, but it does not alter the signed access JWT or database `profiles` row. RLS and Edge Function authorization should deny unauthorized records/actions.

This conclusion is conditional on applying and verifying migration `0050`. The repository's linked migration check previously showed production through `0049`, so the new MFA/permission final state is not yet active in the remote project.

## 6. Supabase RLS and tenant isolation

The policy design follows the intended boundary:

```text
authenticated identity (auth.uid())
        |
        +-- public.profiles role/admin_role
        |
        +-- businesses.owner_id
        |
        +-- tenant-owned categories/items/messages/bookings/orders/reviews/payments
        |
        +-- RLS and permission functions
```

Evidence:

- `0024_tenant_subdomain_isolation.sql` scopes business/content access by owner or published/unblocked public visibility.
- `0027_phase2_authorization_hardening.sql` adds `WITH CHECK` conditions to prevent moving an authorized row to another tenant and validates payment submission integrity.
- `0050_full_security_remediation.sql` narrows profiles, content, contacts, bookings, orders, reviews, notifications, page views, Telegram links, and private payment-proof reads.
- Storage functions validate UUID/business paths and check owner or explicit permissions before service-role storage operations.
- Payment-proof access is intended to be private and signed for 600 seconds.
- Commission, attribution, and reminder event direct browser writes are revoked in migration `0050`.

### RLS caveat

Static review is not a substitute for two-user integration tests. The migration `0050` is not applied remotely, and the linked production project could not be authenticated from the local environment for a safe matrix test. Required cases are owner A versus tenant B, normal admin versus unrelated resource, sales/marketing scope, anonymous storefront, payment-proof download, and AAL1 versus AAL2 privileged access.

## 7. Logout, browser Back, and multiple tabs

1. Clicking logout calls the Supabase SDK and then navigates to `/login`.
2. The SDK removes the persisted session and emits `SIGNED_OUT`; `AuthProvider` clears memory state.
3. The SDK global scope revokes refresh sessions across devices where supported.
4. The Back button may display a cached page shell, but protected route guards check the current context and redirect without a session. A cached API response is not evidence of a valid session.
5. The installed Supabase Auth client opens a `BroadcastChannel` named with the storage key when available and broadcasts auth changes, including sign-out, to other tabs. `AuthProvider` listens through `onAuthStateChange()`.
6. If the browser does not support or fails to create `BroadcastChannel`, the installed client warns that multi-tab state changes will not be available. This is a residual compatibility condition; it should be tested in supported production browsers.
7. A token already copied before logout can remain cryptographically valid until expiry. Logout is not an instant revocation guarantee for such a token.

## 8. Session expiration and account changes

Verified from source:

- automatic client refresh is enabled;
- expired/invalid sessions are removed by the Supabase client and auth state is propagated;
- privileged sessions have a 30-minute client inactivity sign-out;
- password reset uses a custom one-time hashed reset token and provider admin password update;
- auth/profile email verification is synchronized through Auth triggers and legal/business creation gates;
- protected pages require a current session/profile and verified/legal status.

Not determinable from the repository/local environment:

- numeric access-token expiry;
- refresh-token absolute lifetime and reuse/rotation settings;
- whether the deployed Supabase project revokes all existing sessions after password/email change;
- account disable/deletion behavior for already-issued JWTs;
- whether provider-level session revocation is enabled beyond the SDK global sign-out call.

These must be confirmed in the Supabase Auth dashboard and a controlled staging account test.

## 9. Google OAuth audit

Current flow: Google Identity Services popup credential -> Google ID token + nonce -> Supabase `signInWithIdToken` -> Supabase session.

- Client ID is `VITE_GOOGLE_CLIENT_ID`, which is public configuration.
- No Google client secret is shipped to the browser.
- Nonce is generated with Web Crypto and passed to both GIS initialization and Supabase ID-token exchange.
- No app OAuth redirect/callback route is used by this flow.
- PKCE is not used by this credential flow; there is no frontend `signInWithOAuth` invocation in the reviewed source.
- No Google access/refresh token is explicitly stored by AbroBiz.
- Supabase provider enablement, Google client configuration, authorized origins, and any provider-side callback settings are external project configuration and were not readable from the local environment.
- `VITE_SUPABASE_AUTH_URL` can route Auth requests to a branded hostname, but it does not change the underlying provider identity or authorization boundary.

Assessment: the local token exchange has nonce protection. Production provider configuration and one real login/logout test remain unverified.

## 10. Password authentication and reset

- Passwords are submitted over the production HTTPS browser-to-Edge Function request.
- `login` receives the password only to call Supabase `signInWithPassword`; it uses `persistSession: false` in the Edge Function client.
- `signup` forwards the password to Supabase Auth admin link generation; it does not return it or store it in `public.profiles`.
- The browser does not write passwords to localStorage, sessionStorage, cookies, IndexedDB, or the payment cache.
- Password policy requires 12-128 characters with lower, upper, number, and special character checks in both client/server-facing validation paths.
- Password reset requests return a generic response to reduce account enumeration.
- Reset tokens are hashed/claimed/consumed by service-role-only database functions and are intended to be single-use and expiry-bound.
- Logging code uses categorical error fields; the static security tests reject password/token logging patterns in the auth functions.

Residual: the reset token is placed in a query parameter by `request-password-reset` and is therefore visible to the current browser URL/history. The app should keep strict referrer policy, avoid analytics/logging of query strings, and consider a fragment or short-lived exchange code in a future hardening phase.

## 11. XSS and token exposure

Observed protections:

- React JSX escaping is the normal rendering path.
- The reviewed production source has no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, or `new Function` sink.
- Server-generated email HTML uses escaping helpers and is not inserted into the browser DOM.
- Vercel sends CSP with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, restricted `script-src`, and `upgrade-insecure-requests`.
- Third-party scripts are limited to Google Identity Services and Cloudflare Turnstile in the current CSP.
- The CSP still uses `style-src 'unsafe-inline'` and broad `img-src https:`/`media-src https:` allowances; Trusted Types is not configured.

Because access and refresh tokens are localStorage-readable, **a successful XSS would have a high impact** even though no XSS sink was found in this review. The correct mitigation is continued prevention and CSP hardening, not assuming that localStorage is safe from XSS.

## 12. CSRF

The main authentication architecture is bearer-token based rather than cookie-ambient. Requests require an `Authorization` header supplied by JavaScript, so a conventional cross-site form cannot automatically attach the AbroBiz session as it could with a session cookie. SameSite cookie defenses are therefore not the primary control, and no CSRF token system is present.

This is **not classified as a current classic CSRF vulnerability** for authenticated API actions. CORS is still important because a malicious allowed origin could issue/read browser requests, and the public unauthenticated submission functions remain vulnerable to abuse/spam in the general sense. Rate limits, Turnstile policy, body limits, and server validation are the relevant controls for those endpoints.

## 13. Network/API inspection

| Traffic | Actual implementation | Transport assessment |
|---|---|---|
| Browser -> Vercel | BrowserRouter SPA and Vercel rewrites | Production HTTP redirects to HTTPS; live HSTS present. |
| Browser -> Supabase Auth | `createClient(VITE_SUPABASE_URL)` plus optional `/auth/v1` rewrite to `VITE_SUPABASE_AUTH_URL` | HTTPS in production configuration; bearer/session data in request headers/body. |
| Browser -> Edge Function | `supabase.functions.invoke(...)`; protected functions receive the current bearer token | Supabase HTTPS service URL; functions validate the token and/or call `auth.getUser()`. |
| Browser -> Storage upload | `storage-upload` function; payment upload explicitly sets `Authorization` | HTTPS; server validates bucket/business/path/file and permission. |
| Browser -> Google | GIS script and popup credential flow | HTTPS to Google; Google ID credential is visible to the browser by design. |
| Edge Function -> Supabase | `SUPABASE_URL`, anon key/service role as appropriate, and forwarded caller bearer where needed | HTTPS when production URL is HTTPS; secrets remain server-side. |
| Edge Function -> mail/Telegram/Gemini | Server-side provider requests | Provider transport depends on configured HTTPS/SMTP TLS; values are not in the browser. |

No production token values were recorded. A local read-only settings request could not be made because `.env` contains no usable Supabase URL/key pair; this prevents confirming the numeric deployed JWT lifetime from the local machine.

## 14. Safe DevTools attack simulation

| Test | Result from source review | Evidence/limitation |
|---|---|---|
| Change localStorage role | UI can be influenced only if a separate UI value is changed; the actual role is loaded from `public.profiles` and server policies | No app role is stored as an authorization source in the session key. A live authenticated test was not run. |
| Change client user/business ID | Request IDs are client-controlled inputs, but owner/permission/RLS checks are required | `getMyBusiness()` scopes by authenticated owner; storage and protected functions validate ownership/permission. Cross-tenant live test remains required. |
| Modify UI auth state | Protected routes may be visually spoofed in a modified client, but protected queries/functions still require valid session and authorization | Client guards are not treated as the security boundary. |
| Call protected endpoint without valid auth | Source returns 401 for missing/malformed bearer and Supabase gateway verification is enabled for protected functions | `supabase/config.toml` sets `verify_jwt = true` for payment/storage and other protected handlers; no live mutation was attempted. |
| Request another tenant's record by ID | Expected denial through RLS/ownership/permission checks | Requires two controlled accounts and applied migration state for conclusive runtime evidence. |
| Use request after logout | Browser session is removed and refresh sessions globally signed out; captured access JWT may remain valid until expiry | This is the known Supabase JWT revocation limitation and must be handled by expiry/step-up controls. |

No destructive requests or production authenticated attack attempts were made.

## 15. Findings and recommendations

### High — browser-readable bearer tokens

- Location: `src/lib/supabaseClient.ts:32-39`.
- Finding: access/refresh tokens are persisted in localStorage key `abrobiz-auth-token`.
- Impact: XSS or a malicious same-origin script can exfiltrate the session.
- Recommendation: retain current XSS/CSP controls; consider a backend-for-frontend with HttpOnly, Secure, SameSite cookies for a future architecture if the threat model requires it. Do not claim that renaming the localStorage key protects tokens.
- Status: **WARNING / High residual**, not a code defect by itself for this SPA.

### Medium — exact token lifetime and revocation settings are not source-controlled

- Location: Supabase project Auth settings; not present in repository or usable local environment.
- Finding: exact JWT expiry, refresh-token policy, and password/session revocation behavior cannot be proven from source.
- Impact: logout and password-change guarantees cannot be stated precisely.
- Recommendation: record approved production settings, set a short access-token lifetime appropriate for the product, test global logout/password reset with a staging account, and document results.
- Status: **WARNING / Medium**.

### Medium — logout cannot revoke already-issued access JWTs before expiry

- Location: installed `@supabase/auth-js` source; `src/lib/authContext.tsx:210` uses default `signOut()`.
- Finding: global sign-out clears local state and revokes refresh sessions, but an existing JWT remains cryptographically valid until expiry.
- Impact: a stolen access JWT may continue to work briefly after logout.
- Recommendation: minimize JWT lifetime, require MFA/reauthentication for high-risk actions, and use server-side session checks for especially sensitive workflows.
- Status: **WARNING / Medium**.

### Medium — reset token in URL query string

- Location: `supabase/functions/request-password-reset/index.ts:47-49`, `src/pages/ResetPassword.tsx`.
- Finding: the one-time reset token is sent as `?token=...`.
- Impact: browser history, screenshots, extensions, proxy/access logs, or accidental referrer propagation can expose it.
- Recommendation: use a short-lived exchange code or URL fragment with a no-referrer reset route, ensure analytics never collect query strings, and keep one-time hashed claim/expiry controls.
- Status: **WARNING / Medium**.

### Medium — final privileged MFA/RBAC hardening is not deployed

- Location: `supabase/migrations/0050_full_security_remediation.sql`; linked migration state previously showed remote through `0049`.
- Finding: local source expects/implements stronger `aal2` permission behavior, but production cannot be assumed to have it.
- Impact: source and live authorization behavior can differ; admins may also be locked out if the migration is applied before enrollment.
- Recommendation: apply through the controlled migration process, enroll admins, and run the AAL1/AAL2/tenant matrix before release.
- Status: **FAIL / High operational blocker**.

### Low — CSP permits inline styles and broad HTTPS media

- Location: `vercel.json` CSP.
- Finding: `style-src 'unsafe-inline'`, `img-src https:`, and `media-src https:` remain.
- Impact: reduced containment if a content injection bug appears; larger external content trust surface.
- Recommendation: migrate to nonce/hash-based styles where practical and allowlist required media origins after inventory.
- Status: **WARNING / Low**.

### Low — multi-tab synchronization depends on BroadcastChannel support

- Location: installed Supabase Auth client; application uses default storage/broadcast behavior.
- Finding: SDK warns that multi-tab changes are unavailable if BroadcastChannel creation fails.
- Impact: one tab may briefly show stale auth state in unusual browser/extension environments.
- Recommendation: verify supported browsers and add an explicit storage-event fallback only if required by the support matrix.
- Status: **WARNING / Low**.

## 16. Security rating

| Area | Rating | Reason |
|---|---|---|
| Authentication | PASS | Supabase Auth, email/password, OTP, Google ID-token flow, password policy, and generic reset responses are implemented. |
| Session Security | WARNING | Auto-refresh and generation guards are good; tokens persist in localStorage and access JWTs cannot be revoked before expiry. |
| Browser Storage | WARNING | No password/provider token persistence, but access/refresh tokens are readable in localStorage by design. |
| Transport Security | PASS | Production HTTP redirects to HTTPS; live HSTS and security headers verified. Exact Supabase deployment URL settings still need operator confirmation. |
| Authorization | WARNING | Server/RLS boundary exists, but final `0050` hardening is not applied remotely. |
| RBAC | WARNING | Explicit matrix and protected role RPC exist locally; deployed state and MFA enrollment are not verified. |
| Tenant Isolation | WARNING | Ownership/RLS design is strong in source; two-tenant runtime matrix and final migration are pending. |
| Logout | WARNING | Local/global sign-out is implemented, but captured access JWTs remain valid until expiry. |
| OAuth | PASS | Google GIS ID-token flow has nonce protection and no client secret; provider-side configuration is unverified. |
| XSS Token Exposure | WARNING | No dangerous production sink found, but localStorage makes any future XSS high impact. |
| CSRF | PASS | Bearer-token API architecture avoids classic ambient-cookie CSRF; public endpoints still need abuse controls. |

## 17. Required verification plan

Before changing the rating to production PASS/GO:

1. Verify the Supabase Auth JWT expiry, refresh-token rotation/reuse, password-change revocation, and account-disable behavior in the production/staging Auth settings.
2. Apply and validate migration `0050_full_security_remediation.sql` in staging first; then enroll all privileged accounts in TOTP and test AAL1 denial/AAL2 success.
3. Run two-user tenant tests for every owner, admin-role, marketing, sales, public, storage, payment-proof, booking, order, review, and notification path.
4. Test logout in the same tab, another tab, another browser/device, and after browser Back navigation.
5. Test a captured test access JWT after global logout and record the exact endpoint behavior until expiry; do not use a real production token.
6. Test Google sign-in with the production client ID, nonce validation, direct signup, referral signup, logout, and account linking behavior.
7. Confirm reset-token URLs are excluded from analytics/proxy logs and that replay, expiry, and concurrent claim tests fail safely.
8. Keep production secrets, OAuth client secrets, and reset/session values out of logs and reports.

## Audit conclusion

The current design follows the intended principle:

```text
Client state = convenience
Server authorization = security
Database RLS = final tenant boundary
```

The browser can see and modify its own state, but that alone does not grant server-side privileges. The principal residual risks are localStorage-readable bearer tokens, non-revocable-before-expiry access JWTs, reset tokens in URLs, and the fact that the final MFA/RBAC migration is not yet confirmed active in production. No code or production behavior was modified during this audit.
