import { createClient } from '@supabase/supabase-js'

// Supabase's project URL must remain the base for REST, Storage, Functions,
// and Realtime. A branded auth hostname may proxy only /auth/v1; using it as
// the client base breaks every upload and Edge Function request.
const url = import.meta.env.VITE_SUPABASE_URL
const brandedAuthUrl = import.meta.env.VITE_SUPABASE_AUTH_URL?.replace(/\/$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly and early instead of a confusing runtime error deep in a query.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

function routedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!brandedAuthUrl) return fetch(input, init)

  const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const projectBase = url.replace(/\/$/, '')
  const authPath = '/auth/v1'
  if (!inputUrl.startsWith(`${projectBase}${authPath}`)) return fetch(input, init)

  const brandedUrl = `${brandedAuthUrl}${inputUrl.slice(projectBase.length)}`
  if (typeof input === 'string' || input instanceof URL) return fetch(brandedUrl, init)
  return fetch(new Request(brandedUrl, input), init)
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: routedFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
