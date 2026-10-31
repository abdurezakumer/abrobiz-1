/* OAuth 2.1 authorization endpoint and authenticated AbroBiz consent action. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomBytes } from 'node:crypto'
import {
  assuranceLevelFromJwtPayload,
  appOrigin,
  enforceOAuthRateLimit,
  oauthAdminClient,
  preflight,
  readRequestBody,
  requestHostAllowed,
  requestOriginAllowed,
  requestUrl,
  resolveAuthorizationRequest,
  sendJson,
  sha256,
  userIdFromJwtPayload,
  appendAuthorizationResult,
} from '../../api/_mcpOAuth.js'

function bearer(req: any): string | null {
  const value = req.headers?.authorization
  if (typeof value !== 'string') return null
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim())
  return match && match[1].length < 8192 ? match[1] : null
}

export default async function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return sendJson(res, 400, { error: 'invalid_request' })
  if (req.method === 'OPTIONS') { preflight(res); return }
  const db = oauthAdminClient()

  if (req.method === 'GET') {
    try {
      const params = Object.fromEntries(requestUrl(req).searchParams.entries())
      const resolved = await resolveAuthorizationRequest(db, params)
      const consent = new URL('/oauth/consent', appOrigin())
      for (const [key, value] of Object.entries(params)) consent.searchParams.set(key, value)
      res.statusCode = 302
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Location', consent.toString())
      res.end()
      void resolved
      return
    } catch {
      return sendJson(res, 400, { error: 'invalid_authorization_request' })
    }
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
  try {
    const origin = req.headers?.origin
    if (typeof origin === 'string' && !requestOriginAllowed(origin)) return sendJson(res, 403, { error: 'access_denied' })
    if (!String(req.headers?.['content-type'] ?? '').toLowerCase().includes('application/json')) return sendJson(res, 415, { error: 'invalid_request' })
    const accessToken = bearer(req)
    if (!accessToken) return sendJson(res, 401, { error: 'login_required' })
    const { data: authData, error: authError } = await db.auth.getUser(accessToken)
    const jwtUserId = userIdFromJwtPayload(accessToken)
    if (authError || !authData.user || !jwtUserId || authData.user.id !== jwtUserId) return sendJson(res, 401, { error: 'invalid_token' })

    const body = await readRequestBody(req)
    const resolved = await resolveAuthorizationRequest(db, body)
    const { data: profile, error: profileError } = await db.from('profiles')
      .select('id, role, admin_role, email_verified_at, terms_accepted_at, privacy_accepted_at, legal_version, marketing_policy_version')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError || !profile || !profile.email_verified_at || !profile.terms_accepted_at || !profile.privacy_accepted_at || !profile.legal_version) {
      return sendJson(res, 403, { error: 'account_setup_required' })
    }
    const admin = profile.role === 'admin' || profile.role === 'super_admin' || profile.admin_role === 'super_admin'
    if (admin && assuranceLevelFromJwtPayload(accessToken) !== 'aal2') return sendJson(res, 403, { error: 'mfa_required' })
    if (['marketing_admin', 'sales_person'].includes(profile.admin_role) && !profile.marketing_policy_version) {
      return sendJson(res, 403, { error: 'account_setup_required' })
    }

    await enforceOAuthRateLimit(db, req, `consent-${authData.user.id}`, 10, 300)
    const code = `abz_code_${randomBytes(32).toString('base64url')}`
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const { data: authCode, error: codeError } = await db.from('mcp_oauth_authorization_codes').insert({
      code_hash: sha256(code),
      client_id: resolved.clientId,
      user_id: authData.user.id,
      redirect_uri: resolved.redirectUri,
      resource: resolved.resource,
      code_challenge: resolved.codeChallenge,
      scopes: resolved.scopes,
      expires_at: expiresAt,
    }).select('id').single()
    if (codeError || !authCode) return sendJson(res, 503, { error: 'server_error' })
    await db.from('mcp_audit_logs').insert({
      user_id: authData.user.id,
      tool_name: 'mcp_oauth.authorized',
      outcome: 'success',
      metadata: { client_id: resolved.clientId, scopes: resolved.scopes.join(' '), expires_at: expiresAt },
    })
    return sendJson(res, 200, {
      redirectTo: appendAuthorizationResult(resolved.redirectUri, { code, state: resolved.state }),
    })
  } catch {
    return sendJson(res, 400, { error: 'authorization_failed' })
  }
}
