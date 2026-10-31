/* AbroBiz remote MCP endpoint for Claude custom connectors. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node'
import { z } from 'zod'
import {
  authenticateMcpRequest,
  consumeMcpRateLimit,
  getAuthorizedBusiness,
  hasMcpPermission,
  hasMcpScope,
  isAdmin,
  isAllowedMcpHost,
  isAllowedMcpOrigin,
  isUuid,
  listAuthorizedBusinesses,
  McpAuthorizationError,
  McpConfigurationError,
  McpRateLimitError,
  recordMcpAudit,
  textResult,
  validateBusinessProfilePatch,
  withMcpTimeout,
  type McpPrincipal,
  type McpRequest,
  validateDraftContent,
} from './_mcp.js'

const MAX_BODY = 64 * 1024
const serverInfo = { name: 'AbroBiz MCP', version: '1.0.0' }
const dateText = z.string().max(40).optional()

function json(res: any, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.headersSent) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  if (status === 204) res.end()
  else res.end(JSON.stringify(body))
}

function publicError(error: unknown): string {
  if (error instanceof McpAuthorizationError) return 'You are not authorized to perform this AbroBiz action.'
  if (error instanceof McpRateLimitError) return 'The AbroBiz MCP request limit has been reached. Please try again shortly.'
  if (error instanceof McpConfigurationError) return 'The AbroBiz MCP service is temporarily unavailable.'
  return 'The AbroBiz action could not be completed.'
}

async function audited<T>(
  principal: McpPrincipal,
  req: McpRequest,
  toolName: string,
  businessId: string | undefined,
  action: () => Promise<T>,
): Promise<any> {
  try {
    const result = await withMcpTimeout(action())
    await recordMcpAudit(principal, toolName, 'success', req, businessId)
    return textResult(result)
  } catch (error) {
    const outcome = error instanceof McpAuthorizationError ? 'denied' : 'error'
    await recordMcpAudit(principal, toolName, outcome, req, businessId, { reason: publicError(error) })
    return textResult({ error: publicError(error) }, true)
  }
}

async function requireBusiness(principal: McpPrincipal, businessId: string): Promise<any> {
  const business = await getAuthorizedBusiness(principal, businessId)
  if (!business) throw new McpAuthorizationError('Business is not accessible')
  return business
}

function requirePermission(principal: McpPrincipal, permission: string) {
  if (!hasMcpPermission(principal, permission)) throw new McpAuthorizationError('Permission is required')
}

function requireDraftWrite(principal: McpPrincipal) {
  if (!hasMcpScope(principal, 'mcp:drafts:write')) throw new McpAuthorizationError('Draft write scope is required')
}

function parseDate(value: string | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date')
  return parsed.toISOString()
}

function createMcpServer(principal: McpPrincipal, req: McpRequest): McpServer {
  const server = new McpServer(serverInfo)

  server.registerTool('get_integration_status', {
    title: 'Get AbroBiz integration status',
    description: 'Return the authenticated AbroBiz MCP connection status, permissions, scopes, and draft-approval boundary. Never returns the secret token.',
  }, async () => audited(principal, req, 'get_integration_status', undefined, async () => ({
    status: 'connected',
    tokenPrefix: principal.tokenPrefix,
    expiresAt: principal.expiresAt,
    scopes: principal.scopes,
    role: principal.adminRole === 'none' ? principal.role : principal.adminRole,
    approvalBoundary: 'AbroBiz MCP can read authorized data, edit limited owner profile fields, and manage marketing drafts. Publishing, approval, billing, deletion, and external sends remain in the AbroBiz human workflow.',
  })))

  server.registerTool('get_platform_overview', {
    title: 'Get platform overview',
    description: 'Return bounded platform counts and recent approved revenue for authorized AbroBiz administrators. Owners cannot use this platform-wide tool.',
  }, async () => audited(principal, req, 'get_platform_overview', undefined, async () => {
    requirePermission(principal, 'dashboard.read')
    if (!isAdmin(principal) || (principal.role !== 'super_admin' && principal.adminRole !== 'super_admin')) throw new McpAuthorizationError('Super administrator access is required')
    const [users, businesses, admins, active, trial, pending, revenue] = await Promise.all([
      principal.db.from('profiles').select('id', { count: 'exact', head: true }),
      principal.db.from('businesses').select('id', { count: 'exact', head: true }),
      principal.db.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
      principal.db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      principal.db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial'),
      principal.db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      principal.db.from('payments').select('amount_etb').eq('status', 'approved').limit(10000),
    ])
    const firstError = [users, businesses, admins, active, trial, pending, revenue].find(row => row.error)?.error
    if (firstError) throw new Error('Overview unavailable')
    return {
      asOf: new Date().toISOString(),
      users: users.count ?? 0,
      businesses: businesses.count ?? 0,
      admins: admins.count ?? 0,
      activeSubscriptions: active.count ?? 0,
      trialSubscriptions: trial.count ?? 0,
      pendingPayments: pending.count ?? 0,
      approvedRevenueEtb: (revenue.data ?? []).reduce((total, row: any) => total + Number(row.amount_etb ?? 0), 0),
    }
  }))

  server.registerTool('list_my_businesses', {
    title: 'List authorized businesses',
    description: 'List only businesses the connected AbroBiz account owns or is authorized to manage through its existing administrator or marketing attribution permissions.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
  }, async ({ limit }) => audited(principal, req, 'list_my_businesses', undefined, async () => {
    const rows = await listAuthorizedBusinesses(principal, limit ?? 50)
    return { businesses: rows.map(row => ({ id: row.id, ownerId: row.owner_id, name: row.name, slug: row.slug, categoryId: row.category_id, description: row.description, logoUrl: row.logo_url, coverUrl: row.cover_url, phone: row.phone, email: row.email, address: row.address, templateSlug: row.template_slug, isPublished: row.is_published, isBlocked: row.is_blocked, createdAt: row.created_at, updatedAt: row.updated_at })) }
  }))

  server.registerTool('get_business_details', {
    title: 'Get business details',
    description: 'Read the selected business profile and public-facing configuration after a server-side tenant authorization check.',
    inputSchema: z.object({ business_id: z.string().uuid() }),
  }, async ({ business_id }) => audited(principal, req, 'get_business_details', business_id, async () => {
    const business = await requireBusiness(principal, business_id)
    const { data: category } = business.category_id ? await principal.db.from('business_categories').select('id, slug, label, item_label, category_label').eq('id', business.category_id).maybeSingle() : { data: null }
    return { id: business.id, ownerId: business.owner_id, name: business.name, slug: business.slug, category, description: business.description, aboutContent: business.about_content, galleryUrls: business.gallery_urls ?? [], logoUrl: business.logo_url, coverUrl: business.cover_url, phone: business.phone, email: business.email, address: business.address, mapsUrl: business.maps_url, templateSlug: business.template_slug, languages: business.languages, accentColor: business.accent_color, openingHours: business.opening_hours, social: business.social, currency: business.currency, timezone: business.timezone, isPublished: business.is_published, isBlocked: business.is_blocked, blockedReason: business.blocked_reason, createdAt: business.created_at, updatedAt: business.updated_at }
  }))

  server.registerTool('update_business_profile', {
    title: 'Update business profile',
    description: 'Update limited public profile fields for a business owned by the connected account. Slugs, templates, publishing, blocking, billing, permissions, and private records cannot be changed through MCP.',
    inputSchema: z.object({
      business_id: z.string().uuid(),
      name: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      about_content: z.string().max(5000).optional(),
      phone: z.string().max(40).optional(),
      email: z.string().max(160).optional(),
      address: z.string().max(500).optional(),
      maps_url: z.string().max(500).optional(),
      social: z.record(z.string(), z.string().max(300)).optional(),
    }),
  }, async ({ business_id, ...input }) => audited(principal, req, 'update_business_profile', business_id, async () => {
    const business = await requireBusiness(principal, business_id)
    if (business.owner_id !== principal.userId) throw new McpAuthorizationError('Only the business owner can update profile fields')
    const validated = validateBusinessProfilePatch(input)
    if (!validated.valid) throw new Error(validated.reason)
    const patch: Record<string, unknown> = { ...validated.patch }
    if (patch.social) patch.social = { ...(business.social ?? {}), ...(patch.social as Record<string, unknown>) }
    const { data, error } = await principal.db.from('businesses').update(patch).eq('id', business_id).eq('owner_id', principal.userId).select('id, name, description, about_content, phone, email, address, maps_url, social, updated_at').single()
    if (error || !data) throw new Error('Business profile could not be updated')
    return { business: data, approvalRequired: false }
  }))

  server.registerTool('list_products_or_services', {
    title: 'List products or services',
    description: 'Read the existing catalog categories and items for an authorized business. Prices and availability come from AbroBiz data.',
    inputSchema: z.object({ business_id: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() }),
  }, async ({ business_id, limit }) => audited(principal, req, 'list_products_or_services', business_id, async () => {
    await requireBusiness(principal, business_id)
    const capped = limit ?? 50
    const [categories, items] = await Promise.all([
      principal.db.from('categories').select('id, name, icon, sort_order, is_hidden, translations').eq('business_id', business_id).order('sort_order').limit(capped),
      principal.db.from('items').select('id, category_id, image_url, price, is_available, is_featured, sort_order, translations').eq('business_id', business_id).order('sort_order').limit(capped),
    ])
    if (categories.error || items.error) throw new Error('Catalog unavailable')
    return { categories: categories.data ?? [], items: items.data ?? [] }
  }))

  server.registerTool('get_marketing_analytics', {
    title: 'Get marketing analytics',
    description: 'Return bounded referral, payment, conversion, and commission aggregates for one authorized business or all businesses visible to the connected marketing account.',
    inputSchema: z.object({ business_id: z.string().uuid().optional(), from: dateText, to: dateText }),
  }, async ({ business_id, from, to }) => audited(principal, req, 'get_marketing_analytics', business_id, async () => {
    const end = parseDate(to, new Date())
    const startDate = new Date(); startDate.setDate(startDate.getDate() - 90)
    const start = parseDate(from, startDate)
    if (new Date(start).getTime() > new Date(end).getTime()) throw new Error('Invalid date range')
    const businesses = business_id ? [await requireBusiness(principal, business_id)] : await listAuthorizedBusinesses(principal, 100)
    const businessIds = businesses.map(row => row.id).filter(isUuid)
    const ownerIds = [...new Set(businesses.map(row => row.owner_id).filter(isUuid))]
    if (!businessIds.length || !ownerIds.length) return { from: start, to: end, referredOwners: 0, registeredOwners: 0, paidBusinesses: 0, conversionRate: 0, qualifyingPayments: 0, commissionGeneratedEtb: 0, commissionPendingEtb: 0 }
    const [attributions, payments, ledger] = await Promise.all([
      principal.db.from('marketing_attributions').select('owner_id, sales_person_id, marketing_admin_id, attributed_at').in('owner_id', ownerIds).gte('attributed_at', start).lte('attributed_at', end).limit(10000),
      principal.db.from('payments').select('business_id, amount_etb, status, created_at').in('business_id', businessIds).gte('created_at', start).lte('created_at', end).limit(10000),
      principal.db.from('marketing_commission_ledger').select('amount_etb, status, created_at').in('owner_id', ownerIds).gte('created_at', start).lte('created_at', end).limit(10000),
    ])
    if (attributions.error || payments.error || ledger.error) throw new Error('Marketing analytics unavailable')
    const paidBusinesses = new Set((payments.data ?? []).filter(row => row.status === 'approved').map(row => row.business_id))
    const qualifyingPayments = (payments.data ?? []).filter(row => row.status === 'approved')
    const commissionGenerated = (ledger.data ?? []).filter(row => !['reversed', 'cancelled'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount_etb ?? 0), 0)
    const commissionPending = (ledger.data ?? []).filter(row => ['pending', 'calculated', 'eligible'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount_etb ?? 0), 0)
    return { from: start, to: end, referredOwners: (attributions.data ?? []).filter(row => row.sales_person_id || row.marketing_admin_id).length, registeredOwners: new Set((attributions.data ?? []).map(row => row.owner_id)).size, paidBusinesses: paidBusinesses.size, conversionRate: ownerIds.length ? Math.round((paidBusinesses.size / ownerIds.length) * 10000) / 100 : 0, qualifyingPayments: qualifyingPayments.length, commissionGeneratedEtb: commissionGenerated, commissionPendingEtb: commissionPending }
  }))

  server.registerTool('get_recent_leads', {
    title: 'Get recent leads',
    description: 'Read recent contact-form leads only for an authorized business. Owner, support, and authorized marketing accounts may use this tool; results are bounded and exclude internal secrets.',
    inputSchema: z.object({ business_id: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() }),
  }, async ({ business_id, limit }) => audited(principal, req, 'get_recent_leads', business_id, async () => {
    await requireBusiness(principal, business_id)
    const canRead = principal.role === 'owner' || hasMcpPermission(principal, 'support.read') || principal.adminRole === 'marketing_admin' || principal.adminRole === 'sales_person'
    if (!canRead) throw new McpAuthorizationError('Lead access is not enabled for this role')
    const { data, error } = await principal.db.from('contact_messages').select('id, name, email, phone, message, is_read, created_at').eq('business_id', business_id).order('created_at', { ascending: false }).limit(limit ?? 25)
    if (error) throw new Error('Lead data unavailable')
    return { leads: data ?? [] }
  }))

  server.registerTool('list_marketing_drafts', {
    title: 'List marketing drafts',
    description: 'List existing AbroBiz AI website-copy drafts for an authorized business. Drafts are presentation content and remain subject to the owner approval workflow.',
    inputSchema: z.object({ business_id: z.string().uuid(), status: z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']).optional(), limit: z.number().int().min(1).max(50).optional() }),
  }, async ({ business_id, status, limit }) => audited(principal, req, 'list_marketing_drafts', business_id, async () => {
    const business = await requireBusiness(principal, business_id)
    const canRead = business.owner_id === principal.userId || hasMcpPermission(principal, 'templates.manage')
    if (!canRead) throw new McpAuthorizationError('Draft access is limited to the owner or content administrator')
    let query = principal.db.from('ai_website_copy_generations').select('id, business_id, owner_id, language, tone, status, content, source_hash, model, generation_version, created_at, updated_at').eq('business_id', business_id).order('created_at', { ascending: false }).limit(limit ?? 25)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw new Error('Drafts unavailable')
    return { drafts: data ?? [] }
  }))

  server.registerTool('create_marketing_draft', {
    title: 'Create a marketing draft',
    description: 'Save an owner-authorized, validated marketing copy draft in the existing AbroBiz AI copy table. This never publishes or approves content.',
    inputSchema: z.object({ business_id: z.string().uuid(), language: z.enum(['en', 'am', 'or']), tone: z.enum(['professional', 'premium', 'friendly', 'modern', 'minimal', 'persuasive']), content: z.record(z.string(), z.unknown()) }),
  }, async ({ business_id, language, tone, content }) => audited(principal, req, 'create_marketing_draft', business_id, async () => {
    requireDraftWrite(principal)
    const business = await requireBusiness(principal, business_id)
    if (business.owner_id !== principal.userId) throw new McpAuthorizationError('Only the business owner can create drafts')
    const validated = await validateDraftContent(principal.db, business_id, content)
    if (!validated.valid) throw new Error(validated.reason)
    const { data, error } = await principal.db.from('ai_website_copy_generations').insert({ business_id, owner_id: principal.userId, language, tone, status: 'DRAFT', content: validated.content, source_hash: validated.sourceHash, model: 'claude-mcp', generation_version: 'mcp-1.0.0' }).select('id, business_id, language, tone, status, content, source_hash, model, generation_version, created_at, updated_at').single()
    if (error) throw new Error('Draft could not be saved')
    return { draft: data, approvalRequired: true }
  }))

  server.registerTool('update_marketing_draft', {
    title: 'Update a marketing draft',
    description: 'Replace content in an existing owner-owned DRAFT after validation. Approved or archived content cannot be changed through MCP.',
    inputSchema: z.object({ draft_id: z.string().uuid(), content: z.record(z.string(), z.unknown()) }),
  }, async ({ draft_id, content }) => audited(principal, req, 'update_marketing_draft', undefined, async () => {
    requireDraftWrite(principal)
    const { data: draft, error: draftError } = await principal.db.from('ai_website_copy_generations').select('id, business_id, owner_id, status').eq('id', draft_id).maybeSingle()
    if (draftError || !draft || draft.owner_id !== principal.userId || draft.status !== 'DRAFT') throw new McpAuthorizationError('Only an owner-owned draft can be updated')
    const business = await requireBusiness(principal, draft.business_id)
    if (business.owner_id !== principal.userId) throw new McpAuthorizationError('Business access is not authorized')
    const validated = await validateDraftContent(principal.db, draft.business_id, content)
    if (!validated.valid) throw new Error(validated.reason)
    const { data, error } = await principal.db.from('ai_website_copy_generations').update({ content: validated.content, source_hash: validated.sourceHash, model: 'claude-mcp', generation_version: 'mcp-1.0.0' }).eq('id', draft_id).eq('owner_id', principal.userId).eq('status', 'DRAFT').select('id, business_id, language, tone, status, content, source_hash, model, generation_version, created_at, updated_at').single()
    if (error) throw new Error('Draft could not be updated')
    return { draft: data, approvalRequired: true }
  }))

  return server
}

export default async function handler(req: any, res: any) {
  const request = req as McpRequest
  const hosts = (process.env.MCP_ALLOWED_HOSTS || 'abrobiz.com,www.abrobiz.com').split(',').map(value => value.trim()).filter(Boolean)
  const localHosts = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'test' ? [...new Set([...hosts, 'localhost', '127.0.0.1'])] : hosts
  const hostGuard = hostHeaderValidation(localHosts)
  const originGuard = originValidation(localHosts)
  if (!isAllowedMcpHost(request)) { hostGuard(request as any, res as any); return }
  if (!hostGuard(request as any, res as any)) return
  if (!isAllowedMcpOrigin(request)) { originGuard(request as any, res as any); return }
  if (!originGuard(request as any, res as any)) return

  if (request.method === 'OPTIONS') {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : ''
    json(res, 204, null, { ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), 'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Accept', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' })
    return
  }

  let principal: McpPrincipal | null
  try {
    principal = await withMcpTimeout(authenticateMcpRequest(request))
    if (!principal) {
      json(res, 401, { error: 'Authentication required' }, {
        'WWW-Authenticate': 'Bearer realm="AbroBiz MCP", resource_metadata="https://abrobiz.com/.well-known/oauth-protected-resource/api/mcp"',
      })
      return
    }
    await withMcpTimeout(consumeMcpRateLimit(principal))
  } catch (error) {
    if (error instanceof McpRateLimitError) {
      json(res, 429, { error: 'Request limit reached' }, { 'Retry-After': '60' })
      return
    }
    if (error instanceof McpConfigurationError) {
      json(res, 503, { error: 'MCP service unavailable' })
      return
    }
    json(res, 500, { error: 'MCP service unavailable' })
    return
  }

  const mcpHandler = createMcpHandler(() => createMcpServer(principal as McpPrincipal, request), {
    legacy: 'stateless',
    responseMode: 'json',
    maxRequestBodySize: MAX_BODY,
    onerror: () => console.error('MCP protocol request failed'),
  })
  const nodeHandler = toNodeHandler(mcpHandler, { maxRequestBodySize: MAX_BODY, onerror: () => console.error('MCP adapter request failed') })
  try {
    const parsedBody = request.body
    if (parsedBody !== undefined) await nodeHandler(request as any, res as any, parsedBody)
    else await nodeHandler(request as any, res as any)
  } catch {
    console.error('MCP request handler failed')
    json(res, 500, { error: 'MCP request failed' })
  } finally {
    await mcpHandler.close().catch(() => console.error('MCP handler close failed'))
  }
}
