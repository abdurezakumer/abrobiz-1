import { createAdminClient } from './db.ts'
import { corsHeaders } from './cors.ts'

function json(body: unknown, status: number, retryAfter?: number, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
    },
  })
}

function requestAddress(req: Request): string {
  const cloudflare = req.headers.get('cf-connecting-ip')
  if (cloudflare) return cloudflare.trim()
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Returns a 429/503 response when blocked, otherwise null. */
export async function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  identity = '',
): Promise<Response | null> {
  const key = `${scope}:${requestAddress(req)}:${identity}`.slice(0, 200)
  const db = createAdminClient()
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('rate-limit check failed', error)
    return json({ error: 'Service temporarily unavailable. Please try again.' }, 503, undefined, req)
  }
  if (data === false) {
    return json({ error: 'Too many requests. Please try again later.' }, 429, windowSeconds, req)
  }
  return null
}
