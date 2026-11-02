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

export type McpAccessStatus = 'not_requested' | 'pending' | 'approved' | 'rejected' | 'revoked'
export type McpAccessDecision = 'approved' | 'rejected' | 'revoked'

export interface McpAccessRequest {
  user_id: string
  platform_id: string | null
  name: string | null
  email: string | null
  role: string
  admin_role: string | null
  status: Exclude<McpAccessStatus, 'not_requested'>
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export async function getMcpAccessStatus(): Promise<McpAccessStatus> {
  const { data, error } = await supabase.rpc('mcp_get_access_status')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : null
  const status = row?.status
  if (['not_requested', 'pending', 'approved', 'rejected', 'revoked'].includes(status)) return status as McpAccessStatus
  throw new Error('MCP approval status was not returned.')
}

export async function requestMcpAccess(): Promise<McpAccessStatus> {
  const { data, error } = await supabase.rpc('mcp_request_access')
  if (error) throw error
  if (['pending', 'approved', 'rejected', 'revoked'].includes(data)) return data as McpAccessStatus
  throw new Error('MCP access request was not recorded.')
}

export async function listMcpAccessRequests(status: McpAccessStatus | 'all' = 'all'): Promise<McpAccessRequest[]> {
  const { data, error } = await supabase.rpc('mcp_list_access_requests', { p_status: status })
  if (error) throw error
  return Array.isArray(data) ? data as McpAccessRequest[] : []
}

export async function reviewMcpAccessRequest(userId: string, decision: McpAccessDecision): Promise<void> {
  const { error } = await supabase.rpc('mcp_review_access_request', { p_user_id: userId, p_decision: decision })
  if (error) throw error
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
