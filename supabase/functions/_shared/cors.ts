const defaultOrigins = [
  'https://abrobiz.com',
  'https://www.abrobiz.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function allowedOrigins(): string[] {
  const configured = Deno.env.get('CORS_ORIGINS') ?? Deno.env.get('CORS_ORIGIN')
  const values = configured?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  return values.length ? values : defaultOrigins
}

/** Return a browser-safe CORS policy for the requesting origin. */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin')
  const allowed = allowedOrigins()
  const responseOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
