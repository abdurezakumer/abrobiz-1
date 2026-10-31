# AbroBiz MCP + Claude setup

AbroBiz exposes its tenant-aware Model Context Protocol endpoint at:

```text
https://abrobiz.com/api/mcp
```

It uses the official MCP TypeScript SDK and Streamable HTTP in a Vercel API
route. A new server instance is created for every request.

## OAuth connection

Claude connects with OAuth 2.1 authorization code, S256 PKCE, Dynamic Client
Registration, short-lived access tokens, and rotating refresh tokens.

1. In Claude, open **Settings → Connectors → Add custom connector**.
2. Set the remote MCP URL to `https://abrobiz.com/api/mcp`.
3. Choose **Sign in now**.
4. For OAuth client, choose **Register automatically**.
5. Finish adding the connector and choose **Connect**. Sign in to AbroBiz,
   review the requested permissions, and approve them.
6. Verify with `get_integration_status`, then `list_my_businesses`.

No Supabase URL, project ID, API key, or request header is needed. Vercel
reserves `/.well-known/` and does not allow rewrites there, so discovery
metadata is published as static JSON assets under `public/.well-known/`.
The required discovery URLs are:

- `https://abrobiz.com/.well-known/oauth-authorization-server`
- `https://abrobiz.com/.well-known/oauth-protected-resource/api/mcp`

The consent screen identifies the requesting OAuth client and explains each
scope. User identity and role are verified by AbroBiz. Admin accounts must
complete MFA. Every MCP request still checks current account role, business
ownership/attribution, scopes, and rate limits.

## Security and credential lifecycle

- Access tokens expire after one hour; refresh tokens rotate and expire after
  90 days.
- Only SHA-256 hashes of authorization codes and tokens are stored.
- Account Security lists active MCP credentials and can revoke them. Revocation
  disables the access token and its associated refresh tokens.
- A user can have at most ten active MCP credentials across OAuth and legacy
  manual tokens.
- Supabase service-role credentials remain server-side in Vercel. They are not
  given to Claude or placed in browser storage.
- MCP can read authorized business/catalog/marketing data, make limited edits
  to owner-owned public profile fields, and create or update marketing drafts.
  It cannot publish/approve drafts, change billing, delete records, run SQL,
  execute code, make arbitrary HTTP requests, or send campaigns.
- Claude's `mcp:tools` scope is supported as tool access; draft changes still
  require the separately approved `mcp:drafts:write` scope.

Clients without OAuth support can use a legacy bearer token generated in
**Account security → Claude via AbroBiz MCP → Advanced**. It is shown once and
can be revoked from Account Security.

## Deployment

Apply migrations `0063_mcp_access_tokens_and_audit.sql` and
`0065_mcp_oauth_authorization.sql` to the Supabase project. Configure these
server-only Vercel variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
APP_ENV=production
SITE_URL=https://abrobiz.com
MCP_ALLOWED_HOSTS=abrobiz.com,www.abrobiz.com
```

`SUPABASE_SERVICE_ROLE_KEY` must never have a `VITE_` prefix. Do not place
user access tokens, refresh tokens, or authorization codes in environment
variables, GitHub, or logs.

## Available tools

| Tool | Access | Effect |
| --- | --- | --- |
| `get_integration_status` | Authenticated MCP connection | Read connected role, scopes, and approval boundary |
| `get_platform_overview` | Super administrator | Read bounded platform counts and approved-revenue aggregate |
| `list_my_businesses` | Owner, permitted administrator, or scoped marketing role | List only businesses the account is allowed to manage |
| `get_business_details` | Authorized business | Read profile and public-facing configuration |
| `update_business_profile` | Business owner | Update allowlisted public profile fields only |
| `list_products_or_services` | Authorized business | Read current catalog data |
| `get_marketing_analytics` | Authorized business/marketing role | Read bounded referral, payment, conversion, and commission summaries |
| `get_recent_leads` | Owner, support, or authorized marketing role | Read bounded contact-form leads |
| `list_marketing_drafts` | Business owner or content administrator | Read existing website-copy drafts |
| `create_marketing_draft` | Owner + `mcp:drafts:write` | Save validated draft content; does not publish |
| `update_marketing_draft` | Owner + `mcp:drafts:write` | Update an owner-owned draft only |

The existing AbroBiz UI remains the approval path for publishing drafts.
Scheduling and social publishing are not exposed because AbroBiz has no
corresponding data model/API that this adapter can safely reuse.

## Local verification

1. Use a disposable Supabase project and ignored local `.env`; never use a
   production service-role key on a shared computer.
2. Apply the OAuth migration through the project's normal migration workflow.
3. Set `MCP_ALLOWED_HOSTS=localhost,127.0.0.1` and `APP_ENV=development` for
   local API testing.
4. Test metadata discovery, registration, PKCE consent, token exchange, refresh,
   access revocation, and tenant isolation with a disposable MCP client.
5. Run:

   ```powershell
   npm run typecheck
   npm test -- --run
   npm run lint
   npm run build
   npm run security:secrets
   ```

Local tests do not prove production DNS, Vercel configuration, or the external
Claude connector flow.

## Production rollout

1. Review and apply `0065_mcp_oauth_authorization.sql` to Supabase.
2. Confirm the server-only Vercel variables above, including the canonical
   `SITE_URL=https://abrobiz.com`.
3. Deploy the Vercel build through the normal release process.
4. Add the Claude connector with **Sign in now** and **Register automatically**,
   then sign in to AbroBiz and approve the requested permissions.
5. Verify `get_integration_status`, account-level revocation, and cross-tenant
   denial. Inspect logs without printing authorization headers or tokens.

No production deployment or Supabase migration is performed by this change.

## Revocation and rollback

- Revoke a connection from Account Security; revocation applies immediately to
  access and refresh tokens.
- If the endpoint must be disabled, block `/api/mcp` at the edge and revoke
  active credentials.
- Roll back the Vercel release normally but keep OAuth/access-token records and
  audit history. Do not drop these tables as part of an application rollback.
