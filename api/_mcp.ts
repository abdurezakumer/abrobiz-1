/* Server-only MCP authentication, authorization, validation, and audit helpers. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type McpRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  [key: string]: unknown
}

export type McpPrincipal = {
  userId: string
  tokenId: string
  tokenPrefix: string
  scopes: string[]
  expiresAt: string
  role: string
  adminRole: string
  platformId: string
  name: string
  email: string
  db: SupabaseClient<any, 'public', any>
}

export class McpConfigurationError extends Error {}
export class McpRateLimitError extends Error {}
export class McpAuthorizationError extends Error {}
export const MCP_REQUEST_TIMEOUT_MS = 15_000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN = /^abz_mcp_[a-f0-9]{64}$/
const MCP_PERMISSIONS: Record<string, string[]> = {
  operations: ['dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read', 'support.manage'],
  finance: ['dashboard.read', 'payments.read', 'payments.review', 'plans.manage'],
  support: ['dashboard.read', 'users.read', 'support.read', 'support.manage'],
  content: ['dashboard.read', 'templates.manage', 'announcements.send'],
  marketing_admin: ['dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders'],
  sales_person: ['dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions'],
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

export function parseBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^Bearer[ \t]+([^ \t]+)$/i.exec(value.trim())
  if (!match || match[1].length > 128 || !TOKEN.test(match[1])) return null
  return match[1]
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function hasMcpScope(principal: Pick<McpPrincipal, 'scopes'>, scope: string): boolean {
  return principal.scopes.includes(scope) || (scope === 'mcp:read' && principal.scopes.includes('mcp:tools'))
}

export function hasMcpPermission(principal: Pick<McpPrincipal, 'role' | 'adminRole'>, permission: string): boolean {
  if (principal.role === 'super_admin' || principal.adminRole === 'super_admin') return true
  return principal.role === 'admin' && (MCP_PERMISSIONS[principal.adminRole] ?? []).includes(permission)
}

export async function withMcpTimeout<T>(promise: Promise<T>, timeoutMs = MCP_REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('MCP operation timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function isAdmin(principal: Pick<McpPrincipal, 'role' | 'adminRole'>): boolean {
  return principal.role === 'admin' || principal.role === 'super_admin' || principal.adminRole === 'super_admin'
}

export function adminClient(): SupabaseClient<any, 'public', any> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new McpConfigurationError('MCP server is not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function requestId(req: McpRequest): string {
  const candidate = headerValue(req.headers['x-request-id'])
  return /^[A-Za-z0-9._:-]{1,120}$/.test(candidate) ? candidate : randomUUID()
}

export function requestHost(req: McpRequest): string {
  return headerValue(req.headers.host).toLowerCase().split(':')[0].replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

export function allowedMcpHosts(): string[] {
  const configured = (process.env.MCP_ALLOWED_HOSTS || 'abrobiz.com,www.abrobiz.com')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  if (process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test') return [...new Set([...configured, 'localhost', '127.0.0.1'])]
  return configured
}

export function isAllowedMcpHost(req: McpRequest): boolean {
  return allowedMcpHosts().includes(requestHost(req))
}

export function isAllowedMcpOrigin(req: McpRequest): boolean {
  const origin = headerValue(req.headers.origin)
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return allowedMcpHosts().includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export async function authenticateMcpRequest(req: McpRequest): Promise<McpPrincipal | null> {
  const token = parseBearerToken(req.headers.authorization)
  if (!token) return null
  const db = adminClient()
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')
  const { data: tokenRow, error: tokenError } = await db
    .from('mcp_access_tokens')
    .select('id, user_id, token_prefix, scopes, expires_at, revoked_at, last_used_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (tokenError) throw new McpConfigurationError('MCP authentication is unavailable')
  if (!tokenRow) return null

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, role, admin_role, platform_id, name, email')
    .eq('id', tokenRow.user_id)
    .maybeSingle()
  if (profileError) throw new McpConfigurationError('MCP authentication is unavailable')
  if (!profile) return null

  const lastUsed = tokenRow.last_used_at ? Date.parse(tokenRow.last_used_at) : 0
  if (!lastUsed || Date.now() - lastUsed > 5 * 60 * 1000) {
    void db.from('mcp_access_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)
  }
  return {
    userId: profile.id,
    tokenId: tokenRow.id,
    tokenPrefix: tokenRow.token_prefix,
    scopes: Array.isArray(tokenRow.scopes) ? tokenRow.scopes.filter((scope: unknown): scope is string => typeof scope === 'string') : [],
    expiresAt: tokenRow.expires_at,
    role: profile.role,
    adminRole: profile.admin_role ?? 'none',
    platformId: profile.platform_id ?? '',
    name: profile.name ?? '',
    email: profile.email ?? '',
    db,
  }
}

export async function consumeMcpRateLimit(principal: McpPrincipal): Promise<void> {
  const { data, error } = await principal.db.rpc('consume_rate_limit', {
    p_key: `mcp:user:${principal.userId}`,
    p_limit: 120,
    p_window_seconds: 60,
  })
  if (error) throw new McpConfigurationError('MCP rate limiting is unavailable')
  if (data !== true) throw new McpRateLimitError('MCP request limit reached')
}

function metadataSafe(metadata: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(key)) continue
    if (typeof value === 'string' && value.length <= 200) result[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
    else if (typeof value === 'boolean') result[key] = value
  }
  return result
}

export async function recordMcpAudit(
  principal: McpPrincipal,
  toolName: string,
  outcome: 'success' | 'denied' | 'error',
  req: McpRequest,
  businessId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await principal.db.from('mcp_audit_logs').insert({
    user_id: principal.userId,
    token_id: principal.tokenId,
    tool_name: toolName.slice(0, 120),
    business_id: isUuid(businessId) ? businessId : null,
    outcome,
    request_id: requestId(req),
    metadata: metadataSafe(metadata),
  })
  if (error) {
    // Never expose provider/database details or a token through logs/errors.
    console.error('MCP audit write failed')
  }
}

export function textResult(value: unknown, isError = false): { content: [{ type: 'text'; text: string }]; isError?: boolean } {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], ...(isError ? { isError: true } : {}) }
}

export async function getAuthorizedBusiness(
  principal: McpPrincipal,
  businessId: string,
): Promise<any | null> {
  if (!isUuid(businessId)) return null
  const { data: business, error } = await principal.db
    .from('businesses')
    .select('id, owner_id, category_id, name, slug, description, about_content, gallery_urls, logo_url, cover_url, phone, email, address, maps_url, template_slug, languages, accent_color, opening_hours, social, currency, timezone, is_published, is_blocked, blocked_reason, created_at, updated_at')
    .eq('id', businessId)
    .maybeSingle()
  if (error || !business) return null
  if (business.owner_id === principal.userId) return business
  if (isAdmin(principal) && hasMcpPermission(principal, 'businesses.read')) return business
  if (principal.adminRole !== 'marketing_admin' && principal.adminRole !== 'sales_person') return null

  const { data: attribution } = await principal.db
    .from('marketing_attributions')
    .select('sales_person_id, marketing_admin_id')
    .eq('owner_id', business.owner_id)
    .maybeSingle()
  if (principal.adminRole === 'sales_person') return attribution?.sales_person_id === principal.userId ? business : null
  if (attribution?.marketing_admin_id === principal.userId) return business
  if (isUuid(attribution?.sales_person_id)) {
    const { data: membership } = await principal.db
      .from('marketing_team_memberships')
      .select('id')
      .eq('sales_person_id', attribution.sales_person_id)
      .eq('marketing_admin_id', principal.userId)
      .is('ended_at', null)
      .maybeSingle()
    if (membership) return business
  }
  return null
}

export async function listAuthorizedBusinesses(principal: McpPrincipal, limit = 100): Promise<any[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 100)
  if (principal.role === 'owner' || principal.adminRole === 'none') {
    const { data } = await principal.db
      .from('businesses')
      .select('id, owner_id, category_id, name, slug, description, logo_url, cover_url, phone, email, address, template_slug, is_published, is_blocked, created_at, updated_at')
      .eq('owner_id', principal.userId).limit(cappedLimit)
    return data ?? []
  }
  if (isAdmin(principal) && hasMcpPermission(principal, 'businesses.read')) {
    const { data } = await principal.db
      .from('businesses')
      .select('id, owner_id, category_id, name, slug, description, logo_url, cover_url, phone, email, address, template_slug, is_published, is_blocked, created_at, updated_at')
      .order('created_at', { ascending: false }).limit(cappedLimit)
    return data ?? []
  }
  const ownerIds = new Set<string>()
  const { data: direct } = await principal.db.from('marketing_attributions').select('owner_id').or(`sales_person_id.eq.${principal.userId},marketing_admin_id.eq.${principal.userId}`).limit(cappedLimit)
  for (const row of direct ?? []) if (isUuid(row.owner_id)) ownerIds.add(row.owner_id)
  if (principal.adminRole === 'marketing_admin') {
    const { data: team } = await principal.db.from('marketing_team_memberships').select('sales_person_id').eq('marketing_admin_id', principal.userId).is('ended_at', null).limit(100)
    const salesIds = (team ?? []).map(row => row.sales_person_id).filter(isUuid)
    if (salesIds.length) {
      const { data: teamAttributions } = await principal.db.from('marketing_attributions').select('owner_id').in('sales_person_id', salesIds).limit(cappedLimit)
      for (const row of teamAttributions ?? []) if (isUuid(row.owner_id)) ownerIds.add(row.owner_id)
    }
  }
  if (!ownerIds.size) return []
  const { data } = await principal.db
    .from('businesses')
    .select('id, owner_id, category_id, name, slug, description, logo_url, cover_url, phone, email, address, template_slug, is_published, is_blocked, created_at, updated_at')
    .in('owner_id', [...ownerIds].slice(0, cappedLimit)).order('created_at', { ascending: false }).limit(cappedLimit)
  return data ?? []
}

export async function validateDraftContent(db: SupabaseClient<any, 'public', any>, businessId: string, value: unknown): Promise<{ valid: true; content: any; sourceHash: string } | { valid: false; reason: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, reason: 'Draft content must be an object.' }
  const content = value as Record<string, any>
  const allowed = new Set(['hero', 'about', 'services', 'contact', 'location', 'seo'])
  const text = (input: unknown, max: number, required = true) => typeof input === 'string' && input.length <= max && (!required || input.trim().length > 0) && !/[<>]/.test(input)
  const object = (input: unknown): input is Record<string, any> => Boolean(input && typeof input === 'object' && !Array.isArray(input))
  const keys = (input: Record<string, any>, expected: string[]) => Object.keys(input).every(key => expected.includes(key))
  if (Object.keys(content).some(key => !allowed.has(key))) return { valid: false, reason: 'Draft contains an unsupported section.' }
  if (content.hero !== undefined && (!object(content.hero) || !keys(content.hero, ['headline', 'subheadline', 'primaryCta', 'secondaryCta']) || !text(content.hero.headline, 120) || !text(content.hero.subheadline, 240) || (content.hero.primaryCta !== undefined && !text(content.hero.primaryCta, 48, false)) || (content.hero.secondaryCta !== undefined && !text(content.hero.secondaryCta, 48, false)))) return { valid: false, reason: 'Invalid hero copy.' }
  if (content.about !== undefined && (!object(content.about) || !keys(content.about, ['title', 'description', 'mission', 'vision', 'values']) || !text(content.about.title, 100) || !text(content.about.description, 1200) || (content.about.mission !== undefined && !text(content.about.mission, 500, false)) || (content.about.vision !== undefined && !text(content.about.vision, 500, false)) || (content.about.values !== undefined && (!Array.isArray(content.about.values) || content.about.values.length > 6 || !content.about.values.every((item: unknown) => text(item, 100)) )))) return { valid: false, reason: 'Invalid about copy.' }
  if (content.contact !== undefined && (!object(content.contact) || !keys(content.contact, ['intro']) || !text(content.contact.intro, 500))) return { valid: false, reason: 'Invalid contact copy.' }
  if (content.location !== undefined && (!object(content.location) || !keys(content.location, ['intro']) || !text(content.location.intro, 500))) return { valid: false, reason: 'Invalid location copy.' }
  if (content.seo !== undefined && (!object(content.seo) || !keys(content.seo, ['title', 'description']) || !text(content.seo.title, 70) || !text(content.seo.description, 160))) return { valid: false, reason: 'Invalid SEO copy.' }
  if (content.services !== undefined) {
    if (!Array.isArray(content.services) || content.services.length > 50) return { valid: false, reason: 'Invalid service list.' }
    const { data: items, error } = await db.from('items').select('id').eq('business_id', businessId).limit(1000)
    if (error) return { valid: false, reason: 'The business catalog could not be verified.' }
    const sourceIds = new Set((items ?? []).map(row => row.id))
    if (content.services.length > Math.min(sourceIds.size, 50)) return { valid: false, reason: 'The service list contains too many entries.' }
    for (const item of content.services) {
      if (!object(item) || !keys(item, ['sourceId', 'title', 'shortDescription', 'description']) || !isUuid(item.sourceId) || !sourceIds.has(item.sourceId) || !text(item.title, 100) || !text(item.shortDescription, 180) || (item.description !== undefined && !text(item.description, 600, false))) return { valid: false, reason: 'Invalid service copy or source item.' }
    }
  }
  const sourceHash = createHash('sha256').update(JSON.stringify(content), 'utf8').digest('hex')
  return { valid: true, content, sourceHash }
}

export function validateBusinessProfilePatch(value: unknown): { valid: true; patch: Record<string, unknown> } | { valid: false; reason: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, reason: 'Profile update must be an object.' }
  const input = value as Record<string, unknown>
  const allowed = new Set(['name', 'description', 'about_content', 'phone', 'email', 'address', 'maps_url', 'social'])
  if (Object.keys(input).some(key => !allowed.has(key))) return { valid: false, reason: 'Profile update contains an unsupported field.' }
  if (Object.keys(input).length === 0) return { valid: false, reason: 'Profile update is empty.' }
  const text = (field: string, max: number, required = false) => {
    const fieldValue = input[field]
    return fieldValue === undefined || (typeof fieldValue === 'string' && fieldValue.length <= max && (!required || fieldValue.trim().length > 0) && !/[<>]/.test(fieldValue))
  }
  if (!text('name', 120, true) || !text('description', 2000) || !text('about_content', 5000) || !text('address', 500) || !text('phone', 40) || !text('email', 160) || !text('maps_url', 500)) return { valid: false, reason: 'Profile text is invalid or too long.' }
  if (typeof input.phone === 'string' && input.phone.trim() && !/^[+0-9()\- .]{3,40}$/.test(input.phone.trim())) return { valid: false, reason: 'Phone number format is invalid.' }
  if (typeof input.email === 'string' && input.email.trim() && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email.trim())) return { valid: false, reason: 'Email format is invalid.' }
  if (typeof input.maps_url === 'string' && input.maps_url.trim()) {
    try { if (new URL(input.maps_url.trim()).protocol !== 'https:') return { valid: false, reason: 'Maps URL must use HTTPS.' } } catch { return { valid: false, reason: 'Maps URL is invalid.' } }
  }
  if (input.social !== undefined) {
    if (!input.social || typeof input.social !== 'object' || Array.isArray(input.social)) return { valid: false, reason: 'Social links must be an object.' }
    const social = input.social as Record<string, unknown>
    const socialKeys = new Set(['facebookUrl', 'instagramUrl', 'tiktokUrl', 'telegramHandle'])
    if (Object.keys(social).some(key => !socialKeys.has(key))) return { valid: false, reason: 'Unsupported social link.' }
    for (const [key, link] of Object.entries(social)) {
      if (typeof link !== 'string' || link.length > 300 || /[<>\r\n]/.test(link)) return { valid: false, reason: 'Social link is invalid.' }
      if (!link.trim()) continue
      if (key === 'telegramHandle') {
        if (!/^@?[A-Za-z0-9_]{5,32}$/.test(link.trim())) return { valid: false, reason: 'Telegram username is invalid.' }
      } else {
        try { if (new URL(link.trim()).protocol !== 'https:') return { valid: false, reason: 'Social links must use HTTPS.' } } catch { return { valid: false, reason: 'Social link is invalid.' } }
      }
    }
  }
  return { valid: true, patch: input }
}
