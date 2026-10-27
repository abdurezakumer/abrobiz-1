import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { appendAuthorizationResult, requestedScopes, validPkceChallenge, validRedirectUri, verifyPkce } from '../../../api/_mcpOAuth'

describe('AbroBiz MCP OAuth security primitives', () => {
  it('accepts only secure callback URLs and loopback development callbacks', () => {
    expect(validRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
    expect(validRedirectUri('https://safe.example/callback')).toBe(false)
    expect(validRedirectUri('javascript:alert(1)')).toBe(false)
    expect(validRedirectUri('https://safe.example/callback#fragment')).toBe(false)
    expect(validRedirectUri('https://user:pass@safe.example/callback')).toBe(false)
    expect(validRedirectUri('http://evil.example/callback')).toBe(false)
    const original = process.env.APP_ENV
    process.env.APP_ENV = 'development'
    expect(validRedirectUri('http://localhost:4455/callback')).toBe(true)
    if (original === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = original
  })

  it('allows only supported, least-privilege MCP scopes', () => {
    expect(requestedScopes(undefined)).toEqual(['mcp:read'])
    expect(requestedScopes('mcp:tools')).toEqual(['mcp:tools'])
    expect(requestedScopes('mcp:read mcp:drafts:write')).toEqual(['mcp:read', 'mcp:drafts:write'])
    expect(requestedScopes('mcp:drafts:write')).toBeNull()
    expect(requestedScopes('admin')).toBeNull()
  })

  it('validates S256 PKCE challenges and verifier pairs', () => {
    const verifier = 'Ab1_'.repeat(12)
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    expect(validPkceChallenge(challenge)).toBe(true)
    expect(verifyPkce(verifier, challenge)).toBe(true)
    expect(verifyPkce(`${verifier}x`, challenge)).toBe(false)
    expect(validPkceChallenge('plain-verifier')).toBe(false)
  })

  it('adds OAuth response values without replacing the callback query', () => {
    expect(appendAuthorizationResult('https://claude.ai/callback?existing=1', { code: 'one-time', state: 'round-trip' }))
      .toBe('https://claude.ai/callback?existing=1&code=one-time&state=round-trip')
  })
})
