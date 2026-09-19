import { supabase } from '../supabaseClient'

export type SupportRequestStatus = 'requested' | 'under_review' | 'completed' | 'rejected'

export interface SupportRequest {
  id: string
  ownerId: string
  businessId: string
  ownerName: string
  ownerEmail: string
  ownerPlatformId: string
  businessName: string
  currentSubdomain: string
  requestedSubdomain: string | null
  message: string
  status: SupportRequestStatus
  resolutionNote: string | null
  createdAt: string
  reviewedAt: string | null
}

function mapRequest(row: any): SupportRequest {
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessId: row.business_id,
    ownerName: row.owner_name ?? row.profiles?.name ?? 'Business owner',
    ownerEmail: row.owner_email ?? row.profiles?.email ?? '',
    ownerPlatformId: row.owner_platform_id ?? row.profiles?.platform_id ?? '—',
    businessName: row.business_name ?? row.businesses?.name ?? 'Business',
    currentSubdomain: row.current_subdomain,
    requestedSubdomain: row.requested_subdomain,
    message: row.message ?? '',
    status: row.status,
    resolutionNote: row.resolution_note ?? null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
  }
}

export async function requestWebsiteAddressChange(businessId: string, requestedSubdomain: string, message: string): Promise<SupportRequest> {
  const { data, error } = await supabase.rpc('request_business_subdomain_change', {
    p_business_id: businessId,
    p_requested_subdomain: requestedSubdomain,
    p_message: message,
  })
  if (error) throw error
  return mapRequest(data)
}

export async function listMySupportRequests(businessId: string): Promise<SupportRequest[]> {
  const { data, error } = await supabase
    .from('support_requests')
    .select('id, owner_id, business_id, current_subdomain, requested_subdomain, message, status, resolution_note, created_at, reviewed_at, profiles(name, email, platform_id), businesses(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(mapRequest)
}

export async function adminListSupportRequests(): Promise<SupportRequest[]> {
  const { data, error } = await supabase.rpc('admin_list_support_requests')
  if (error) throw error
  return (data ?? []).map(mapRequest)
}

export async function adminResolveSubdomainRequest(input: { id: string; approved: boolean; newSubdomain?: string; resolutionNote: string }): Promise<SupportRequest> {
  const { data, error } = await supabase.rpc('admin_resolve_subdomain_request', {
    p_request_id: input.id,
    p_approved: input.approved,
    p_new_subdomain: input.newSubdomain || null,
    p_resolution_note: input.resolutionNote,
  })
  if (error) throw error
  return mapRequest(data)
}
