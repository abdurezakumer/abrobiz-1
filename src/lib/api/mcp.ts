import { supabase } from '../supabaseClient'

export interface McpToken {
  id: string
  user_id: string
  name: string
  token_prefix: string
  scopes: string[]
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface CreatedMcpToken extends McpToken {
  token: string
}

export async function listMcpTokens(): Promise<McpToken[]> {
  const { data, error } = await supabase.rpc('mcp_list_access_tokens')
  if (error) throw error
  return Array.isArray(data) ? data as McpToken[] : []
}

export async function createMcpToken(name: string, expiresAt?: string): Promise<CreatedMcpToken> {
  const { data, error } = await supabase.rpc('mcp_create_access_token', {
    p_name: name,
    p_expires_at: expiresAt ?? null,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || typeof data.token !== 'string') throw new Error('The MCP token was not returned.')
  return data as CreatedMcpToken
}

export async function revokeMcpToken(tokenId: string): Promise<void> {
  const { error } = await supabase.rpc('mcp_revoke_access_token', { p_token_id: tokenId })
  if (error) throw error
}
