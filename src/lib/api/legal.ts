import { supabase } from '../supabaseClient'

export const CURRENT_LEGAL_VERSION = '2026-01'

export async function recordLegalAcceptance(): Promise<void> {
  const { data, error } = await supabase.rpc('record_legal_acceptance', {
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_legal_version: CURRENT_LEGAL_VERSION,
  })
  if (error) throw error
  if (data !== true) throw new Error('Legal acceptance could not be recorded.')
}
