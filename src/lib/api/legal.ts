import { supabase } from '../supabaseClient'

export const CURRENT_LEGAL_VERSION = '2026-01'

function isSessionError(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /jwt expired|invalid jwt|not authenticated/i.test(error.message))
}

function isTransientError(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /failed to fetch|network|timeout|gateway|temporarily unavailable/i.test(error.message))
}

export async function recordLegalAcceptance(): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session) throw refreshError ?? new Error('Not authenticated')
  }

  const call = () => supabase.rpc('record_legal_acceptance', {
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_legal_version: CURRENT_LEGAL_VERSION,
  })

  let { data, error } = await call()

  // A tab can remain open long enough for its access token to expire, or a
  // mobile connection can drop the response after the database committed.
  // Refresh/retry once so a valid acceptance is not lost to a stale session.
  if (error && isSessionError(error)) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError) ({ data, error } = await call())
  } else if (error && isTransientError(error)) {
    ({ data, error } = await call())
  }

  if (error) throw error
  if (data === true) return

  // Treat an already-committed acceptance as success even if an older
  // PostgREST response was transformed unexpectedly.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('terms_accepted_at, privacy_accepted_at, legal_version')
    .maybeSingle()
  if (!profileError && profile?.terms_accepted_at && profile.privacy_accepted_at && profile.legal_version === CURRENT_LEGAL_VERSION) return
  throw new Error('Legal acceptance could not be recorded.')
}
