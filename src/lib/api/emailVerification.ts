import { supabase } from '../supabaseClient'
import { edgeFunctionError } from '../errors'

/** Invokes the send-verification-email Edge Function for the currently logged-in user. */
export async function sendVerificationEmail(): Promise<void> {
  const { error } = await supabase.functions.invoke('send-verification-email')
  if (error) throw await edgeFunctionError(error)
}

/** Consumes a token from a verification link — works for anonymous callers, since the token itself is the proof. */
export async function verifyEmailToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('verify_email_token', { p_token: token })
  if (error) throw error
}
