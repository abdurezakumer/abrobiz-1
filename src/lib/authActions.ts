import { supabase } from './supabaseClient'
import { edgeFunctionError } from './errors'

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

export async function requestLoginOtp(email: string, turnstileToken?: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke('login', {
    body: { mode: 'send-otp', email, ...(turnstileToken ? { turnstileToken } : {}) },
  })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
}

export async function verifyLoginOtp(email: string, token: string) {
  const { data, error } = await supabase.functions.invoke('login', {
    body: { mode: 'verify-otp', email, token },
  })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
  if (!data?.session) throw new Error('That verification code is invalid or expired.')
  const { error: sessionError } = await supabase.auth.setSession(data.session)
  if (sessionError) throw sessionError
  return data
}

export async function signInWithGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) throw new Error('Google sign-in is not configured for AbroBiz yet.')
  await loadGoogleIdentityServices()

  await new Promise<void>((resolve, reject) => {
    const google = window.google
    if (!google?.accounts?.id) {
      reject(new Error('Google sign-in is temporarily unavailable.'))
      return
    }

    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      error ? reject(error) : resolve()
    }

    google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: async response => {
        if (!response.credential) {
          finish(new Error('Google did not return a sign-in credential.'))
          return
        }
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: response.credential })
        finish(error ?? undefined)
      },
    })

    google.accounts.id.prompt(notification => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        finish(new Error('Google sign-in was cancelled.'))
      }
    })
  })
}

let googleIdentityPromise: Promise<void> | null = null

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleIdentityPromise) return googleIdentityPromise

  googleIdentityPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => window.google?.accounts?.id ? resolve() : reject(new Error('Google sign-in is temporarily unavailable.')), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google sign-in is temporarily unavailable.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google sign-in is temporarily unavailable.'))
    script.onerror = () => reject(new Error('Google sign-in is temporarily unavailable.'))
    document.head.appendChild(script)
  })
  return googleIdentityPromise
}

/** Supabase's default auth error messages are technical — map the common ones to friendly text. */
export function friendlyAuthError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/already registered/i.test(msg)) return 'We could not create the account with those details. Please check them or try logging in.'
  if (/invalid login credentials|invalid credentials/i.test(msg)) return 'Incorrect email or password.'
  if (/password must be at least|password should be at least/i.test(msg)) return 'Password must be at least 12 characters.'
  if (/lowercase|uppercase|number|special character|128 characters/i.test(msg)) return msg
  if (/unsupported provider|provider.*not enabled|external_google_enabled/i.test(msg)) return 'Google sign-in is not available yet. Please try again later or contact AbroBiz support.'
  if (/google sign-in is not configured/i.test(msg)) return 'Google sign-in is not configured for AbroBiz yet. Please contact support.'
  if (/redirect_uri_mismatch|redirect uri/i.test(msg)) return 'Google sign-in is not configured for this AbroBiz environment yet. Please contact AbroBiz support.'
  if (/failed to fetch|network error|404|temporarily unavailable|service unavailable/i.test(msg)) return 'AbroBiz sign-in is temporarily unavailable. Please try again in a moment.'
  if (/rate limit|too many requests/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.'
  if (/confirmation|verification code|expired|invalid.*code/i.test(msg)) return 'That verification code is invalid or expired.'
  return 'We could not complete that request. Please try again.'
}
