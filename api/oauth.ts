/* Dispatch the AbroBiz MCP OAuth endpoints through one Vercel function. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import authorizationServer from '../server/oauth/authorization-server.js'
import protectedResource from '../server/oauth/protected-resource.js'
import authorizeResource from '../server/oauth/authorize-resource.js'
import authorizeInfo from '../server/oauth/authorize-info.js'
import register from '../server/oauth/register.js'
import authorize from '../server/oauth/authorize.js'
import token from '../server/oauth/token.js'

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
