/* RFC 9728 protected-resource metadata for the AbroBiz MCP endpoint. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { appOrigin, oauthResource, preflight, requestHostAllowed, sendJson } from '../../api/_mcpOAuth.js'

export default function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return sendJson(res, 400, { error: 'invalid_request' })
  if (req.method === 'OPTIONS') { preflight(res); return }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
  return sendJson(res, 200, {
    resource: oauthResource(),
    authorization_servers: [appOrigin()],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp:tools', 'mcp:read', 'mcp:drafts:write'],
  })
}
