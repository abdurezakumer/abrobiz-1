import { supabase } from '../supabaseClient'
import type { Business, WeeklyHours } from '../../types'
import { isValidBusinessSlug } from '../slugify'
import { edgeFunctionError } from '../errors'
import { prepareImageForUpload } from '../fileUpload'

const DEFAULT_HOURS: WeeklyHours = {
  mon: { open: '08:00', close: '22:00', closed: false },
  tue: { open: '08:00', close: '22:00', closed: false },
  wed: { open: '08:00', close: '22:00', closed: false },
  thu: { open: '08:00', close: '22:00', closed: false },
  fri: { open: '08:00', close: '22:00', closed: false },
  sat: { open: '08:00', close: '22:00', closed: false },
  sun: { open: '08:00', close: '22:00', closed: false },
}

function mapBusiness(row: any): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    aboutContent: row.about_content ?? '',
    galleryUrls: row.gallery_urls ?? [],
    logoUrl: row.logo_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    mapsUrl: row.maps_url ?? '',
    templateSlug: row.template_slug ?? 'clean-minimal',
    languages: row.languages ?? ['en'],
    accentColor: row.accent_color ?? '#D4A853',
    openingHours: (row.opening_hours && Object.keys(row.opening_hours).length ? row.opening_hours : DEFAULT_HOURS) as WeeklyHours,
    social: row.social ?? {},
    currency: row.currency ?? 'ETB',
    timezone: row.timezone ?? 'Africa/Addis_Ababa',
    isPublished: row.is_published,
    isBlocked: row.is_blocked,
    blockedReason: row.blocked_reason ?? undefined,
    createdAt: row.created_at,
  }
}

export async function getMyBusiness(): Promise<Business | null> {
  // Published businesses are intentionally public. Always scope the owner
  // dashboard lookup explicitly, otherwise maybeSingle() can see another
  // published tenant and every account may appear to share its subdomain.
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return null
  const { data, error } = await supabase.from('businesses').select('*').eq('owner_id', authData.user.id).maybeSingle()
  if (error) throw error
  return data ? mapBusiness(data) : null
}

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? mapBusiness(data) : null
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapBusiness(data) : null
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!isValidBusinessSlug(slug)) return false
  const { data, error } = await supabase.from('businesses').select('id').eq('slug', slug).maybeSingle()
  if (error) throw error
  return !data
}

/** Creates the business row + its seven-day trial subscription atomically via RPC. */
export async function createBusinessWithTrial(input: { name: string; slug: string; categoryId: string }): Promise<Business> {
  const { data, error } = await supabase.rpc('create_business_with_trial', {
    p_name: input.name,
    p_slug: input.slug,
    p_category_id: input.categoryId,
  })
  if (error) throw error
  return mapBusiness(data)
}

export async function updateBusiness(id: string, patch: Partial<{
  name: string
  description: string
  aboutContent: string
  galleryUrls: string[]
  logoUrl: string
  coverUrl: string
  phone: string
  email: string
  address: string
  mapsUrl: string
  templateSlug: string
  languages: string[]
  accentColor: string
  openingHours: WeeklyHours
  social: Business['social']
  currency: string
  timezone: string
  isPublished: boolean
  categoryId: string | null
}>): Promise<void> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.aboutContent !== undefined) dbPatch.about_content = patch.aboutContent
  if (patch.galleryUrls !== undefined) dbPatch.gallery_urls = patch.galleryUrls
  if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl
  if (patch.coverUrl !== undefined) dbPatch.cover_url = patch.coverUrl
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.email !== undefined) dbPatch.email = patch.email
  if (patch.address !== undefined) dbPatch.address = patch.address
  if (patch.mapsUrl !== undefined) dbPatch.maps_url = patch.mapsUrl
  if (patch.templateSlug !== undefined) dbPatch.template_slug = patch.templateSlug
  if (patch.languages !== undefined) dbPatch.languages = patch.languages
  if (patch.accentColor !== undefined) dbPatch.accent_color = patch.accentColor
  if (patch.openingHours !== undefined) dbPatch.opening_hours = patch.openingHours
  if (patch.social !== undefined) dbPatch.social = patch.social
  if (patch.currency !== undefined) dbPatch.currency = patch.currency
  if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone
  if (patch.isPublished !== undefined) dbPatch.is_published = patch.isPublished
  if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId

  const { error } = await supabase.from('businesses').update(dbPatch).eq('id', id)
  if (error) throw error
}

/** Uploads to a public bucket under `{businessId}/{filename}` and returns the public URL. */
export async function uploadBusinessImage(
  bucket: 'logos' | 'covers',
  businessId: string,
  file: File
): Promise<string> {
  const uploadFile = await prepareImageForUpload(file, 5 * 1024 * 1024)
  const uploadBytes = await uploadFile.arrayBuffer()
  const { data, error } = await supabase.functions.invoke('storage-upload', {
    body: uploadBytes,
    headers: { 'X-Upload-Bucket': bucket, 'X-Business-Id': businessId, 'Content-Type': uploadFile.type },
  })
  if (error) throw await edgeFunctionError(error)
  if (!data?.path) throw new Error('Upload did not return a file path.')
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return publicData.publicUrl
}

export async function trackPageView(businessId: string, path: string): Promise<void> {
  await supabase.functions.invoke('track-page-view', {
    body: { businessId, path, referrer: document.referrer || '' },
  })
}

export async function getBusinessEntitlements(businessId: string): Promise<{ bookings: boolean; ordering: boolean; reviews: boolean; siteActive: boolean }> {
  const { data, error } = await supabase.rpc('get_business_entitlements', { p_business_id: businessId })
  if (error) throw error
  return { bookings: !!data?.bookings, ordering: !!data?.ordering, reviews: !!data?.reviews, siteActive: data?.siteActive !== false }
}

// ── Admin ────────────────────────────────────────────────────────────────

export interface AdminBusinessRow extends Business {
  ownerName: string
  ownerEmail: string
  ownerPlatformId: string
  subscriptionStatus: string | null
  subscriptionEndDate: string | null
}

export async function adminListBusinesses(): Promise<AdminBusinessRow[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, profiles!businesses_owner_id_fkey(name, email, platform_id), subscriptions(status, end_date)')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...mapBusiness(row),
    ownerName: row.profiles?.name ?? '—',
    ownerEmail: row.profiles?.email ?? '',
    ownerPlatformId: row.profiles?.platform_id ?? '—',
    subscriptionStatus: row.subscriptions?.[0]?.status ?? null,
    subscriptionEndDate: row.subscriptions?.[0]?.end_date ?? null,
  }))
}

export async function adminSetBlocked(id: string, isBlocked: boolean, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({ is_blocked: isBlocked, blocked_reason: isBlocked ? reason ?? 'Blocked by admin' : null })
    .eq('id', id)
  if (error) throw error
}
