import { describe, expect, it } from 'vitest'
import handler from '../../../api/oauth'

function responseMock() {
  const headers: Record<string, string> = {}
  let body = ''
  const response = {
    statusCode: 200,
    headers,
    body: () => body,
    setHeader(name: string, value: string) { headers[name] = value },
    status(code: number) { this.statusCode = code; return this },
    json(value: unknown) { body = JSON.stringify(value); return this },
    end(value?: string) { body = value ?? ''; return this },
  }
  return response
}

describe('Vercel OAuth dispatcher', () => {
  it('serves authorization metadata as JSON through the static dispatcher route', () => {
    const res = responseMock()
    handler({ method: 'GET', query: { action: 'authorization-server' }, headers: { host: 'abrobiz.com' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toContain('application/json')
    expect(JSON.parse(res.body())).toMatchObject({
      issuer: 'https://abrobiz.com',
      authorization_endpoint: 'https://abrobiz.com/api/oauth/authorize',
      token_endpoint: 'https://abrobiz.com/api/oauth/token',
    })
  })

  it('returns a bounded 404 for an unknown OAuth action', () => {
    const res = responseMock()
    handler({ method: 'GET', query: { action: 'unknown' }, headers: { host: 'abrobiz.com' } }, res)

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body())).toEqual({ error: 'not_found' })
  })
})
