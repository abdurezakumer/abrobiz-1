import { supabase } from './supabaseClient'

export class UnverifiedEmailError extends Error {
  constructor() {
    super('Email confirmation is required.')
    this.name = 'UnverifiedEmailError'
  }
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  phone: string,
  termsAccepted: boolean,
  privacyAccepted: boolean,
  turnstileToken?: string | null,
) {
  const { data, error } = await supabase.functions.invoke('signup', {
    body: { email, password, name, phone, termsAccepted, privacyAccepted, ...(turnstileToken ? { turnstileToken } : {}) },
  })
  if (error) throw error
  if (data?.session) {
    const { error: sessionError } = await supabase.auth.setSession(data.session)
    if (sessionError) throw sessionError
  }
  return data as { session: import('@supabase/supabase-js').Session | null; user: { id: string; email?: string } | null; requiresVerification?: boolean }
}

export async function signIn(email: string, password: string, turnstileToken?: string | null) {
  const { data, error } = await supabase.functions.invoke('login', {
    body: { email, password, ...(turnstileToken ? { turnstileToken } : {}) },
  })
  if (error) throw error
  if (!data?.session) throw new Error('Unable to sign in with those credentials.')
  const { error: sessionError } = await supabase.auth.setSession(data.session)
  if (sessionError) throw sessionError
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
  if (/already registered/i.test(msg)) return 'We could not create the account with those details. Please check them or try logging in.'
  if (/invalid login credentials|invalid credentials/i.test(msg)) return 'Incorrect email or password.'
  if (/password must be at least|password should be at least/i.test(msg)) return 'Password must be at least 12 characters.'
  if (/lowercase|uppercase|number|special character|128 characters/i.test(msg)) return msg
  if (/unsupported provider|provider.*not enabled|external_google_enabled/i.test(msg)) return 'Google sign-in is not available yet. Please try again later or contact AbroBiz support.'
  if (/redirect_uri_mismatch|redirect uri/i.test(msg)) return 'Google sign-in is not configured for this AbroBiz environment yet. Please contact AbroBiz support.'
  if (/failed to fetch|network error|404|temporarily unavailable|service unavailable/i.test(msg)) return 'AbroBiz sign-in is temporarily unavailable. Please try again in a moment.'
  if (/rate limit|too many requests/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.'
  if (/confirmation|verification code|expired|invalid.*code/i.test(msg)) return 'That verification code is invalid or expired.'
  return 'We could not complete that request. Please try again.'
}
