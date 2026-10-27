/* OAuth 2.1 Dynamic Client Registration endpoint for MCP clients. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { enforceOAuthRateLimit, oauthAdminClient, preflight, readRequestBody, requestHostAllowed, sendJson, validRedirectUri } from '../_mcpOAuth'

export default async function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return sendJson(res, 400, { error: 'invalid_request' })
  if (req.method === 'OPTIONS') { preflight(res); return }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })

  try {
    const db = oauthAdminClient()
    await enforceOAuthRateLimit(db, req, 'register', 20, 3600)
    const body = await readRequestBody(req)
    const name = typeof body.client_name === 'string' ? body.client_name.trim() : ''
    const redirectUris = body.redirect_uris
    const authMethod = body.token_endpoint_auth_method ?? 'none'
    const appType = body.application_type
    if (name.toLowerCase() !== 'claude' || name.length > 120 || !Array.isArray(redirectUris) || redirectUris.length !== 1 ||
        redirectUris.some(uri => !validRedirectUri(uri)) || new Set(redirectUris).size !== redirectUris.length ||
        authMethod !== 'none' || (appType !== undefined && !['web', 'native'].includes(String(appType)))) {
      return sendJson(res, 400, { error: 'invalid_client_metadata' })
    }

    const grantTypes = body.grant_types ?? ['authorization_code']
    if (!Array.isArray(grantTypes) || !grantTypes.includes('authorization_code') ||
        grantTypes.some(grant => !['authorization_code', 'refresh_token'].includes(String(grant))) || new Set(grantTypes).size !== grantTypes.length) {
      return sendJson(res, 400, { error: 'invalid_client_metadata' })
    }
    const responseTypes = body.response_types
    if (responseTypes !== undefined && (!Array.isArray(responseTypes) || !responseTypes.includes('code'))) {
      return sendJson(res, 400, { error: 'invalid_client_metadata' })
    }

    let clientUri: string | null = null
    if (typeof body.client_uri === 'string' && body.client_uri.length <= 2048) {
      try {
        const parsed = new URL(body.client_uri)
        if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) clientUri = parsed.toString()
      } catch { /* optional display metadata is ignored if malformed */ }
    }
    const { data, error } = await db.from('mcp_oauth_clients').insert({
      client_name: 'Claude',
      client_uri: clientUri,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      token_endpoint_auth_method: 'none',
    }).select('id').single()
    if (error || !data) return sendJson(res, 503, { error: 'server_error' })

    return sendJson(res, 201, {
      client_id: data.id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: 'Claude',
      ...(clientUri ? { client_uri: clientUri } : {}),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: grantTypes,
      response_types: ['code'],
      application_type: appType === 'native' ? 'native' : 'web',
    })
  } catch (error) {
    const limited = error instanceof Error && error.message.includes('limit')
    return sendJson(res, limited ? 429 : 400, { error: limited ? 'slow_down' : 'invalid_request' })
  }
}
