import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'

export async function resendVerificationOtp(email: string, turnstileToken?: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke('resend-signup-otp', { body: { email, ...(turnstileToken ? { turnstileToken } : {}) } })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
}

export async function verifySignupOtp(email: string, token: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('verify-signup-otp', { body: { email, token } })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
  if (!data?.session) throw new Error('That verification code is invalid or expired.')
  const { error: sessionError } = await supabase.auth.setSession(data.session)
  if (sessionError) throw sessionError
}
