import { supabase } from './supabaseClient'

export async function signUp(email: string, password: string, name: string, phone: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone } },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  // Keep local development on the local origin while production can pin this
  // to https://abrobiz.com through VITE_SITE_URL.
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
  const siteUrl = !isLocal && import.meta.env.VITE_SITE_URL ? import.meta.env.VITE_SITE_URL.replace(/\/$/, '') : window.location.origin
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteUrl}/setup` },
  })
  if (error) throw error
}

/** Supabase's default auth error messages are technical — map the common ones to friendly text. */
export function friendlyAuthError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/already registered/i.test(msg)) return 'An account with this email already exists. Try logging in instead.'
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.'
  if (/password should be at least/i.test(msg)) return 'Password must be at least 6 characters.'
  if (/unsupported provider|provider.*not enabled|external_google_enabled/i.test(msg)) return 'Google sign-in is not available yet. Please try again later or contact AbroBiz support.'
  if (/redirect_uri_mismatch|redirect uri/i.test(msg)) return 'Google sign-in is not configured for this AbroBiz environment yet. Please contact AbroBiz support.'
  if (/failed to fetch|network error|404/i.test(msg)) return 'AbroBiz sign-in is temporarily unavailable. Please try again in a moment.'
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.'
  return msg
}
