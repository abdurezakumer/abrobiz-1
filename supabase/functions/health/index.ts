import { createAdminClient } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { instrumentRequest } from '../_shared/observability.ts'

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'GET') return json({ status: 'unhealthy' }, 405, req)

  const check = new URL(req.url).searchParams.get('check') ?? 'readiness'
  if (check === 'liveness') {
    return json({ status: 'healthy', check: 'liveness' }, 200, req)
  }
  if (check !== 'readiness') return json({ status: 'unhealthy' }, 400, req)

  try {
    // A bounded, non-sensitive query confirms database readiness without
    // returning schema, version, host, or credential information.
    const db = createAdminClient()
    const { error } = await db.from('plans').select('id').limit(1)
    if (error) return json({ status: 'degraded', check: 'readiness', checks: { database: 'unavailable' } }, 503, req)
    return json({ status: 'healthy', check: 'readiness', checks: { database: 'ok' } }, 200, req)
  } catch {
    return json({ status: 'unhealthy', check: 'readiness', checks: { database: 'unavailable' } }, 503, req)
  }
}

if (import.meta.main) Deno.serve(instrumentRequest('health', handler))
