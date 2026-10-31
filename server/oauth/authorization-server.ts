/* RFC 8414 authorization-server metadata used by MCP OAuth discovery. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { appOrigin, preflight, requestHostAllowed, sendJson } from '../../api/_mcpOAuth.js'

export default function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return sendJson(res, 400, { error: 'invalid_request' })
  if (req.method === 'OPTIONS') { preflight(res); return }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
  const origin = appOrigin()
  return sendJson(res, 200, {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:tools', 'mcp:read', 'mcp:drafts:write'],
    client_id_metadata_document_supported: false,
  })
}
