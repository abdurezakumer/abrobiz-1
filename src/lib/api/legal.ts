import { supabase } from '../supabaseClient'

export const CURRENT_LEGAL_VERSION = '2026-01'

export async function recordLegalAcceptance(): Promise<void> {
  const call = () => supabase.rpc('record_legal_acceptance', {
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_legal_version: CURRENT_LEGAL_VERSION,
  })

  let { data, error } = await call()

  // A tab can remain open long enough for its access token to expire. Refresh
  // once and retry so a valid acceptance is not lost to a stale session.
  if (error && /jwt expired|invalid jwt|not authenticated/i.test(error.message)) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError) ({ data, error } = await call())
  }

  if (error) throw error
  if (data !== true) throw new Error('Legal acceptance could not be recorded.')
}
