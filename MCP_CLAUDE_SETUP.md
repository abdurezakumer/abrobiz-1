# AbroBiz MCP + Claude setup

This integration adds a server-side, tenant-aware MCP endpoint at:

```text
https://abrobiz.com/api/mcp
```

It uses the official TypeScript MCP SDK and Streamable HTTP through a Vercel API
route. Each request creates a fresh MCP server instance, so request state and
tool registrations cannot leak between Claude connections.

## Security model

- A signed-in AbroBiz user creates a named connection from **Account security**.
- Each account is limited to ten active connections; expired or revoked tokens
  do not grant access.
- AbroBiz returns a single plaintext `abz_mcp_...` bearer token. The token is
  never stored in plaintext, returned again, placed in the browser bundle, or
  written to logs.
- The token is stored as a SHA-256 hash with an expiry and can be revoked.
- Claude receives only the fixed bearer credential. The Supabase service-role
  key remains a Vercel server environment variable and is never sent to Claude.
- Every tool performs a server-side business ownership, administrator
  permission, or marketing-attribution check. A `business_id` supplied by
  Claude is only a lookup candidate, never an authorization decision.
- Calls are rate-limited through the existing `consume_rate_limit` RPC and
  written to `mcp_audit_logs` without token values, draft content, or secrets.
- MCP can read authorized business/catalog/marketing data, edit limited
  owner-owned public profile fields, and create or edit marketing drafts. It cannot approve/publish drafts, change
  billing or prices, delete records, run SQL, execute code, make arbitrary HTTP
  requests, or send external campaigns.

## Required deployment configuration

Apply migrations `0062_telegram_super_admin_fsm.sql` and
`0063_mcp_access_tokens_and_audit.sql` to the production
Supabase project, then configure these Vercel server environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
APP_ENV=production
MCP_BASE_URL=https://abrobiz.com/api/mcp
MCP_ALLOWED_HOSTS=abrobiz.com,www.abrobiz.com
```

`SUPABASE_SERVICE_ROLE_KEY` must not have a `VITE_` prefix. Rotate it through
the normal secret-rotation process if it has ever been exposed. No token value
belongs in `.env.example`, GitHub, Vercel source, or browser local storage.

## Claude connection

1. Sign in to AbroBiz and open **Account security**.
2. Under **Claude via AbroBiz MCP**, enter a connection name and choose
   **Create Claude connection**.
3. Copy the plaintext token immediately. AbroBiz intentionally does not show
   it again.
4. In Claude, open **Settings → Connectors → Add custom connector**.
5. Use `https://abrobiz.com/api/mcp` as the remote MCP URL.
6. Configure the connector request header:

   ```text
   Authorization: Bearer abz_mcp_YOUR_ONE_TIME_TOKEN
   ```

7. Ask Claude to call `get_integration_status`, then
   `list_my_businesses`. Do not paste the token into a normal Claude chat.

Claude custom connectors support fixed bearer/request headers for remote MCP
servers. This implementation deliberately uses that supported, simpler
credential model instead of adding a second OAuth identity system to AbroBiz.

## Available tools

| Tool | Access | Effect |
| --- | --- | --- |
| `get_integration_status` | Any authenticated MCP token | Read connection scopes and approval boundary |
| `get_platform_overview` | Super administrator | Read bounded platform counts and approved-revenue aggregate |
| `list_my_businesses` | Owner, permitted administrator, or scoped marketing role | List only authorized businesses |
| `get_business_details` | Authorized business | Read business profile and public configuration |
| `update_business_profile` | Business owner only | Update allowlisted public profile fields; cannot publish, change slug/template, or touch billing |
| `list_products_or_services` | Authorized business | Read current catalog categories and items |
| `get_marketing_analytics` | Authorized business/marketing scope | Read referral, payment, conversion, and commission aggregates |
| `get_recent_leads` | Owner, support, or authorized marketing scope | Read bounded contact-form leads |
| `list_marketing_drafts` | Business owner or content administrator | Read existing AI website-copy drafts |
| `create_marketing_draft` | Owner + `mcp:drafts:write` | Create a validated `DRAFT` in the existing AI-copy table |
| `update_marketing_draft` | Owner + `mcp:drafts:write` | Update an owner-owned `DRAFT` only |

The existing AbroBiz UI remains the approval path for making a draft live.
AbroBiz currently has no existing marketing-calendar or social-publishing data
model/API that this adapter can safely reuse, so calendar scheduling and channel
publishing are intentionally not exposed as MCP tools.

## Local testing

1. Copy `.env.example` to a local ignored `.env` and use a disposable Supabase
   project. Never use a production service-role key on a shared computer.
2. Apply the migration with the project’s normal Supabase migration workflow.
3. Use `MCP_ALLOWED_HOSTS=localhost,127.0.0.1` and
   `APP_ENV=development` for a local API test.
4. Start the Vite/Vercel-compatible development environment used by the repo.
5. Create a token in the local Account security page and test the endpoint with
   a real MCP client or a small Streamable HTTP client.
6. Run:

   ```powershell
   npm run typecheck
   npm test -- --run
   npm run lint
   npm run build
   npm run security:secrets
   ```

The repository tests are mocked/local checks. They do not prove a deployed
Claude connection, production DNS, Vercel environment configuration, or
provider quotas.

## Production rollout

1. Review the migration and run it through the existing migration review.
2. Set the server-only Vercel variables above for the production environment.
3. Deploy the Vercel build through the normal release process.
4. Log in to AbroBiz, create a connection token, and connect Claude.
5. Verify `get_integration_status`, business ownership, a cross-tenant denial,
   draft creation, and draft approval through the AbroBiz UI.
6. Inspect Vercel function logs and the `mcp_audit_logs` view without printing
   authorization headers or token fields.

No deployment or Supabase production migration is performed by this change.

## Revocation and rollback

- Revoke a connection from Account security. Revocation is checked on every
  request and takes effect immediately.
- If the endpoint must be disabled, remove/disable its Vercel deployment or
  block `/api/mcp` at the edge, then revoke active tokens.
- Roll back the application release through Vercel’s normal rollback. Keep the
  migration tables in place during rollback; retaining revoked token records is
  safer than dropping audit history. A future cleanup migration should be
  reviewed separately.
