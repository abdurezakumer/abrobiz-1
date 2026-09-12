import { supabase } from '../supabaseClient'

export const CURRENT_MARKETING_POLICY_VERSION = '2026-09'

export async function recordMarketingPolicyAcceptance(): Promise<void> {
  const { data, error } = await supabase.rpc('record_marketing_policy_acceptance')
  if (error) throw error
  if (data !== true) throw new Error('Marketing policy acceptance could not be recorded.')
}
