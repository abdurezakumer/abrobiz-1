import { createClient } from '@supabase/supabase-js'

// Use the branded auth/API hostname after the Supabase custom domain is
// activated. The project URL remains the safe fallback before activation.
const url = import.meta.env.VITE_SUPABASE_AUTH_URL || import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly and early instead of a confusing runtime error deep in a query.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
