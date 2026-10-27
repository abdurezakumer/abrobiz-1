/* OAuth 2.1 authorization-code + rotating refresh-token exchange. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { enforceOAuthRateLimit, newOpaqueToken, oauthAdminClient, oauthResource, preflight, readRequestBody, requestHostAllowed, sendJson, sha256, verifyPkce } from '../../api/_mcpOAuth'

const ACCESS_SECONDS = 60 * 60
const REFRESH_SECONDS = 90 * 24 * 60 * 60

function oauthError(res: any, status: number, error: string) {
  return sendJson(res, status, { error })
}

export default async function handler(req: any, res: any) {
  if (!requestHostAllowed(req)) return oauthError(res, 400, 'invalid_request')
  if (req.method === 'OPTIONS') { preflight(res); return }
  if (req.method !== 'POST') return oauthError(res, 405, 'invalid_request')
  try {
    const db = oauthAdminClient()
    await enforceOAuthRateLimit(db, req, 'token', 120, 3600)
    const body = await readRequestBody(req)
    const grantType = body.grant_type
    const clientId = typeof body.client_id === 'string' ? body.client_id : ''
    if (!clientId || clientId.length > 80) return oauthError(res, 400, 'invalid_client')
    const { data: client, error: clientError } = await db.from('mcp_oauth_clients')
      .select('id, client_name, grant_types, revoked_at')
      .eq('id', clientId)
      .is('revoked_at', null)
      .maybeSingle()
    if (clientError || !client) return oauthError(res, 401, 'invalid_client')

    if (grantType === 'authorization_code') {
      if (body.resource !== oauthResource()) return oauthError(res, 400, 'invalid_target')
      const code = typeof body.code === 'string' ? body.code : ''
      const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : ''
      const verifier = body.code_verifier
      if (!/^abz_code_[A-Za-z0-9_-]{40,64}$/.test(code) || redirectUri.length > 2048 || typeof verifier !== 'string') {
        return oauthError(res, 400, 'invalid_grant')
      }
      const { data: stored, error } = await db.from('mcp_oauth_authorization_codes')
        .select('id, user_id, redirect_uri, resource, code_challenge, scopes, expires_at, consumed_at')
        .eq('code_hash', sha256(code))
        .eq('client_id', client.id)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (error || !stored || stored.redirect_uri !== redirectUri || stored.resource !== oauthResource() || !verifyPkce(verifier, stored.code_challenge)) {
        return oauthError(res, 400, 'invalid_grant')
      }
      const now = new Date().toISOString()
      const { data: consumed } = await db.from('mcp_oauth_authorization_codes').update({ consumed_at: now })
        .eq('id', stored.id).is('consumed_at', null).gt('expires_at', now).select('id').maybeSingle()
      if (!consumed) return oauthError(res, 400, 'invalid_grant')

      const { count, error: countError } = await db.from('mcp_access_tokens').select('id', { count: 'exact', head: true })
        .eq('user_id', stored.user_id).is('revoked_at', null).gt('expires_at', now)
      if (countError) return oauthError(res, 503, 'server_error')
      if ((count ?? 0) >= 10) return oauthError(res, 400, 'access_denied')

      const accessToken = newOpaqueToken()
      const accessExpiry = new Date(Date.now() + ACCESS_SECONDS * 1000).toISOString()
      const scopes = Array.isArray(stored.scopes) ? stored.scopes.filter((scope: unknown) => typeof scope === 'string') : ['mcp:read']
      const { data: tokenRow, error: insertError } = await db.from('mcp_access_tokens').insert({
        user_id: stored.user_id,
        name: `${String(client.client_name).slice(0, 64)} (OAuth)`,
        token_prefix: accessToken.slice(0, 16),
        token_hash: sha256(accessToken),
        scopes,
        expires_at: accessExpiry,
      }).select('id').single()
      if (insertError || !tokenRow) return oauthError(res, 503, 'server_error')
      const response: Record<string, unknown> = { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_SECONDS, scope: scopes.join(' ') }
      if (Array.isArray(client.grant_types) && client.grant_types.includes('refresh_token')) {
        const refreshToken = newOpaqueToken('abz_mcp_refresh_')
        const refreshExpiry = new Date(Date.now() + REFRESH_SECONDS * 1000).toISOString()
        const { error: refreshError } = await db.from('mcp_oauth_refresh_tokens').insert({
          token_hash: sha256(refreshToken), token_id: tokenRow.id, client_id: client.id,
          user_id: stored.user_id, resource: stored.resource, scopes, expires_at: refreshExpiry,
        })
        if (refreshError) {
          await db.from('mcp_access_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tokenRow.id)
          return oauthError(res, 503, 'server_error')
        }
        response.refresh_token = refreshToken
      }
      return sendJson(res, 200, response)
    }

    if (grantType === 'refresh_token') {
      if (!Array.isArray(client.grant_types) || !client.grant_types.includes('refresh_token')) return oauthError(res, 400, 'unauthorized_client')
      if (body.resource !== oauthResource()) return oauthError(res, 400, 'invalid_target')
      const rawRefreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
      if (!/^abz_mcp_refresh_[a-f0-9]{64}$/.test(rawRefreshToken)) return oauthError(res, 400, 'invalid_grant')
      const { data: previous, error } = await db.from('mcp_oauth_refresh_tokens')
        .select('id, token_id, user_id, resource, scopes, expires_at')
        .eq('token_hash', sha256(rawRefreshToken)).eq('client_id', client.id)
        .is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (error || !previous || previous.resource !== oauthResource()) return oauthError(res, 400, 'invalid_grant')
      const { data: revoked } = await db.from('mcp_oauth_refresh_tokens').update({ revoked_at: new Date().toISOString() })
        .eq('id', previous.id).is('revoked_at', null).select('id').maybeSingle()
      if (!revoked) return oauthError(res, 400, 'invalid_grant')
      const { data: tokenRow, error: tokenError } = await db.from('mcp_access_tokens')
        .select('id, user_id, revoked_at').eq('id', previous.token_id).eq('user_id', previous.user_id).is('revoked_at', null).maybeSingle()
      if (tokenError || !tokenRow) return oauthError(res, 400, 'invalid_grant')
      const { data: profile } = await db.from('profiles').select('id').eq('id', previous.user_id).maybeSingle()
      if (!profile) return oauthError(res, 400, 'invalid_grant')

      const accessToken = newOpaqueToken()
      const refreshToken = newOpaqueToken('abz_mcp_refresh_')
      const accessExpiry = new Date(Date.now() + ACCESS_SECONDS * 1000).toISOString()
      const refreshExpiry = new Date(Date.now() + REFRESH_SECONDS * 1000).toISOString()
      const scopes = Array.isArray(previous.scopes) ? previous.scopes.filter((scope: unknown) => typeof scope === 'string') : ['mcp:read']
      const { data: updated, error: updateError } = await db.from('mcp_access_tokens').update({
        token_hash: sha256(accessToken), token_prefix: accessToken.slice(0, 16),
        scopes, expires_at: accessExpiry, last_used_at: null,
      }).eq('id', tokenRow.id).is('revoked_at', null).select('id').maybeSingle()
      if (updateError || !updated) return oauthError(res, 400, 'invalid_grant')
      const { error: refreshError } = await db.from('mcp_oauth_refresh_tokens').insert({
        token_hash: sha256(refreshToken), token_id: tokenRow.id, client_id: client.id,
        user_id: previous.user_id, resource: previous.resource, scopes, expires_at: refreshExpiry,
      })
      if (refreshError) {
        await db.from('mcp_access_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tokenRow.id)
        return oauthError(res, 503, 'server_error')
      }
      return sendJson(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_SECONDS, refresh_token: refreshToken, scope: scopes.join(' ') })
    }
    return oauthError(res, 400, 'unsupported_grant_type')
  } catch (error) {
    const limited = error instanceof Error && error.message.includes('limit')
    return oauthError(res, limited ? 429 : 400, limited ? 'slow_down' : 'invalid_request')
  }
}
