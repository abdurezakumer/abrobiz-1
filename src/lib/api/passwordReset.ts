import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'

/** Always resolves without error — the backend deliberately never reveals whether the email matched an account. */
export async function requestPasswordReset(email: string, turnstileToken?: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke('request-password-reset', { body: { email, ...(turnstileToken ? { turnstileToken } : {}) } })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('reset-password', { body: { token, newPassword } })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
}
