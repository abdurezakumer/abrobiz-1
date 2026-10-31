/* Dispatch the AbroBiz MCP OAuth endpoints through one Vercel function. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import authorizationServer from '../server/oauth/authorization-server'
import protectedResource from '../server/oauth/protected-resource'
import authorizeResource from '../server/oauth/authorize-resource'
import authorizeInfo from '../server/oauth/authorize-info'
import register from '../server/oauth/register'
import authorize from '../server/oauth/authorize'
import token from '../server/oauth/token'

const routes: Record<string, (req: any, res: any) => unknown> = {
  'authorization-server': authorizationServer,
  'protected-resource': protectedResource,
  'authorize-resource': authorizeResource,
  'authorize-info': authorizeInfo,
  register,
  authorize,
  token,
}

export default function handler(req: any, res: any) {
  const route = req.query?.action
  const endpoint = typeof route === 'string' ? routes[route] : undefined
  if (endpoint) return endpoint(req, res)

  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  return res.end(JSON.stringify({ error: 'not_found' }))
}
