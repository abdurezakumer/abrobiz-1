/* Consent-screen validation endpoint. Does not issue credentials. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { oauthAdminClient, preflight, requestHostAllowed, requestUrl, sendJson, resolveAuthorizationRequest } from '../_mcpOAuth'

export default async function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return sendJson(res, 400, { error: 'invalid_request' })
  if (req.method === 'OPTIONS') { preflight(res); return }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
  try {
    const params = Object.fromEntries(requestUrl(req).searchParams.entries())
    const resolved = await resolveAuthorizationRequest(oauthAdminClient(), params)
    return sendJson(res, 200, {
      clientName: resolved.clientName,
      clientUri: resolved.clientUri,
      redirectUri: resolved.redirectUri,
      resource: resolved.resource,
      scopes: resolved.scopes,
    })
  } catch {
    return sendJson(res, 400, { error: 'invalid_authorization_request' })
  }
}
