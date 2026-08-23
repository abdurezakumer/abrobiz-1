import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

/**
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
 * every Supabase Edge Function — you don't need to set them yourself, unlike
 * TELEGRAM_BOT_TOKEN etc. This client intentionally bypasses RLS, so every
 * function that uses it is responsible for its own authorization checks
 * (see notify-payment-submitted for an example of verifying the caller
 * before using this).
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}
