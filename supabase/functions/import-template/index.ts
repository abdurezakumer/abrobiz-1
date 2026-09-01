import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { enforceRateLimits } from '../_shared/rateLimit.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { isBearerAuthorization, isRecord, readJsonBody } from '../_shared/requestSecurity.ts'
import { fetchWithTimeout, readJsonResponse } from '../_shared/external.ts'
import { logFailure } from '../_shared/observability.ts'

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

function parseGithubUrl(value: string): { owner: string; repo: string; canonical: string } | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0].replace(/[^A-Za-z0-9_.-]/g, '')
    const repo = parts[1].replace(/\.git$/i, '').replace(/[^A-Za-z0-9_.-]/g, '')
    if (!owner || !repo) return null
    return { owner, repo, canonical: `https://github.com/${owner}/${repo}` }
  } catch {
    return null
  }
}

function safeSlug(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.toLowerCase().trim() : ''
  const normalized = candidate.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
  return normalized || fallback
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function themeConfig(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const allowed = ['bg', 'card', 'text', 'textDim', 'border', 'heroBg', 'headingFont']
  const result: Record<string, string> = {}
  for (const key of allowed) {
    const item = (value as Record<string, unknown>)[key]
    if (typeof item === 'string' && item.length <= 120) result[key] = item
  }
  const visualStyle = (value as Record<string, unknown>).visualStyle
  if (visualStyle === 'minimal' || visualStyle === 'grid' || visualStyle === 'warm' || visualStyle === 'aurora' || visualStyle === 'luxury' || visualStyle === 'heritage') {
    result.visualStyle = visualStyle
  }
  const layout = (value as Record<string, unknown>).layout
  if (layout === 'standard' || layout === 'restaurant-cafe') result.layout = layout
  return result
}

if (import.meta.main) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req)

    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!isBearerAuthorization(authHeader)) return json({ error: 'Not authenticated' }, 401, req)

      const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await client.auth.getUser()
      if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401, req)

      const { data: profile } = await client.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile?.role !== 'admin') return json({ error: 'Admins only' }, 403, req)

      const limited = await enforceRateLimits(req, [
        { scope: 'template-import-ip', limit: 30, windowSeconds: 3600 },
        { scope: 'template-import-admin', limit: 20, windowSeconds: 3600, identity: userData.user.id },
      ])
      if (limited) return limited

      const parsedBody = await readJsonBody(req, 8 * 1024)
      if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status ?? 400, req)
      const body = isRecord(parsedBody.data) ? parsedBody.data : {}
      const repoUrl = body.repoUrl
      if (typeof repoUrl !== 'string' || !repoUrl.trim()) return json({ error: 'A GitHub repository link is required' }, 400, req)
      const parsed = parseGithubUrl(repoUrl)
      if (!parsed) return json({ error: 'Use a public https://github.com/owner/repository link' }, 400, req)

      const { data: existing } = await client.from('templates').select('*').eq('repo_url', parsed.canonical).maybeSingle()
      if (existing) return json({ template: existing, existing: true }, 200, req)

      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'abrobiz-template-importer' }
      const repoResponse = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, { headers })
      if (!repoResponse.ok) {
        return json({ error: repoResponse.status === 404 ? 'Repository not found or not public' : 'GitHub could not be reached' }, 400, req)
      }
      const repo = await readJsonResponse(repoResponse, 256 * 1024)

      // A repository may include template.json at its root. It is optional:
      // without it, the repository name is still imported as a safe template
      // entry using the default storefront skin.
      let manifest: Record<string, unknown> = {}
      const manifestResponse = await fetchWithTimeout(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(repo.default_branch ?? 'main')}/template.json`, {}, 8000)
      if (manifestResponse.ok) {
        try {
          const candidate = await readJsonResponse(manifestResponse, 128 * 1024)
          if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) manifest = candidate
        } catch {
          // Invalid optional manifest: continue with repository metadata.
        }
      }

      const fallbackSlug = `${parsed.owner}-${parsed.repo}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
      const row = {
        slug: safeSlug(manifest.slug, fallbackSlug || 'github-template'),
        name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim().slice(0, 120) : String(repo.name ?? parsed.repo).slice(0, 120),
        description: typeof manifest.description === 'string' ? manifest.description.trim().slice(0, 500) : String(repo.description ?? '').slice(0, 500),
        repo_url: parsed.canonical,
        preview_url: safeHttpsUrl(manifest.previewUrl),
        config: themeConfig(manifest.config),
        is_builtin: false,
        is_active: true,
        sort_order: 100,
        created_by: userData.user.id,
      }

      const { data: template, error } = await client.from('templates').insert(row).select('*').single()
      if (error) {
        if (error.code === '23505') return json({ error: 'A template with that slug already exists. Add a unique "slug" in template.json.' }, 409, req)
        logFailure(req, { function_name: 'import-template', operation: 'insert_template', error_category: 'DATABASE_ERROR', error_code: error.code ?? 'unknown', status: 400 })
        return json({ error: 'Could not save that template.' }, 500, req)
      }
      return json({ template }, 200, req)
    } catch (err) {
      logFailure(req, { function_name: 'import-template', operation: 'import_template', error_category: 'INTERNAL_ERROR', error_code: err instanceof Error ? err.name : 'UnknownError', status: 500 })
      return json({ error: 'Could not import that GitHub repository' }, 500, req)
    }
  })
}
