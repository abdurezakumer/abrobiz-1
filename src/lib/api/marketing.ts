import { supabase } from '../supabaseClient'
import type { AdminRole, Profile } from '../../types'

export interface MarketingCustomer {
  attributionId: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  ownerPlatformId: string
  businessName: string
  businessSlug: string
  salesPersonId: string | null
  marketingAdminId: string | null
  referralCode: string | null
  source: string
  attributedAt: string
  paymentStatus: 'pending' | 'approved' | 'rejected' | 'unpaid'
  planName: string
  amountRequired: number
  paidAmount: number
}

export interface MarketingLedgerEntry {
  id: string
  paymentId: string
  ownerId: string
  recipientType: 'sales_person' | 'marketing_admin' | 'abrobiz'
  rate: number
  amountEtb: number
  status: string
  entryType: string
  note: string
  createdAt: string
}

export interface MarketingSummary {
  customers: number
  paidCustomers: number
  pendingCustomers: number
  qualifyingPayments: number
  commissionTotal: number
  commissionPending: number
  commissionPaid: number
}

export interface MarketingWorkspace {
  customers: MarketingCustomer[]
  ledger: MarketingLedgerEntry[]
  summary: MarketingSummary
  team: Array<{ id: string; name: string; email: string; platformId: string; role: AdminRole }>
  referralCodes: Array<{ id: string; salesPersonId: string; code: string; label: string; isActive: boolean }>
  commissionRule: { id: string; name: string; salesPersonRate: number; marketingAdminRate: number; abrobizRate: number } | null
}

function scopedAttributions(profile: Profile) {
  let query = supabase.from('marketing_attributions').select('id, owner_id, sales_person_id, marketing_admin_id, referral_code_snapshot, source, attributed_at').order('attributed_at', { ascending: false }).limit(1000)
  if (profile.adminRole === 'sales_person') query = query.eq('sales_person_id', profile.id)
  if (profile.adminRole === 'marketing_admin') query = query.eq('marketing_admin_id', profile.id)
  return query
}

export async function getMarketingWorkspace(profile: Profile): Promise<MarketingWorkspace> {
  const [{ data: attributionRows, error: attributionError }, { data: teamRows, error: teamError }, { data: codeRows, error: codeError }, { data: ruleRows, error: ruleError }] = await Promise.all([
    scopedAttributions(profile),
    supabase.from('profiles').select('id, name, email, platform_id, admin_role').in('admin_role', ['marketing_admin', 'sales_person']).order('name').limit(500),
    supabase.from('marketing_referral_codes').select('id, sales_person_id, code, label, is_active').order('created_at', { ascending: false }).limit(500),
    supabase.from('marketing_commission_rules').select('id, name, sales_person_rate, marketing_admin_rate, abrobiz_rate').eq('is_active', true).limit(1),
  ])
  if (attributionError) throw attributionError
  if (teamError) throw teamError
  if (codeError) throw codeError
  if (ruleError) throw ruleError

  const attributions = attributionRows ?? []
  const ownerIds = attributions.map((row: any) => row.owner_id)
  const { data: ownerRows, error: ownerError } = ownerIds.length
    ? await supabase.from('profiles').select('id, name, email, platform_id').in('id', ownerIds)
    : { data: [], error: null }
  if (ownerError) throw ownerError
  const { data: businessRows, error: businessError } = ownerIds.length
    ? await supabase.from('businesses').select('id, owner_id, name, slug').in('owner_id', ownerIds)
    : { data: [], error: null }
  if (businessError) throw businessError

  const businessIds = (businessRows ?? []).map((row: any) => row.id)
  const { data: paymentRows, error: paymentError } = businessIds.length
    ? await supabase.from('payments').select('id, business_id, plan_id, amount_etb, status, plans(name, price_etb)').in('business_id', businessIds).order('created_at', { ascending: false }).limit(2000)
    : { data: [], error: null }
  if (paymentError) throw paymentError

  const { data: ledgerRows, error: ledgerError } = ownerIds.length
    ? await supabase.from('marketing_commission_ledger').select('id, payment_id, owner_id, recipient_type, rate, amount_etb, status, entry_type, note, created_at').in('owner_id', ownerIds).order('created_at', { ascending: false }).limit(2000)
    : { data: [], error: null }
  if (ledgerError) throw ledgerError

  const ownerById = new Map((ownerRows ?? []).map((row: any) => [row.id, row]))
  const businessByOwner = new Map((businessRows ?? []).map((row: any) => [row.owner_id, row]))
  const paymentsByBusiness = new Map<string, any[]>()
  for (const payment of paymentRows ?? []) paymentsByBusiness.set(payment.business_id, [...(paymentsByBusiness.get(payment.business_id) ?? []), payment])

  const customers: MarketingCustomer[] = attributions.map((row: any) => {
    const owner = ownerById.get(row.owner_id) ?? {}
    const business = businessByOwner.get(row.owner_id) ?? {}
    const payments = paymentsByBusiness.get(business.id) ?? []
    const approved = payments.find(payment => payment.status === 'approved')
    const pending = payments.find(payment => payment.status === 'pending')
    const latest = approved ?? pending ?? payments[0]
    return {
      attributionId: row.id,
      ownerId: row.owner_id,
      ownerName: owner.name || 'Unnamed owner',
      ownerEmail: owner.email || '—',
      ownerPlatformId: owner.platform_id || '—',
      businessName: business.name || 'Business not set up',
      businessSlug: business.slug || '',
      salesPersonId: row.sales_person_id,
      marketingAdminId: row.marketing_admin_id,
      referralCode: row.referral_code_snapshot,
      source: row.source,
      attributedAt: row.attributed_at,
      paymentStatus: approved ? 'approved' : pending ? 'pending' : latest?.status ?? 'unpaid',
      planName: latest?.plans?.name ?? 'No plan selected',
      amountRequired: Number(latest?.plans?.price_etb ?? 0),
      paidAmount: approved ? Number(approved.amount_etb ?? 0) : 0,
    }
  })

  const ledger: MarketingLedgerEntry[] = (ledgerRows ?? []).map((row: any) => ({
    id: row.id,
    paymentId: row.payment_id,
    ownerId: row.owner_id,
    recipientType: row.recipient_type,
    rate: Number(row.rate ?? 0),
    amountEtb: Number(row.amount_etb ?? 0),
    status: row.status,
    entryType: row.entry_type,
    note: row.note ?? '',
    createdAt: row.created_at,
  }))
  const partnerLedger = ledger.filter(entry => entry.recipientType !== 'abrobiz' && entry.entryType === 'original')
  return {
    customers,
    ledger,
    summary: {
      customers: customers.length,
      paidCustomers: customers.filter(customer => customer.paymentStatus === 'approved').length,
      pendingCustomers: customers.filter(customer => customer.paymentStatus === 'pending').length,
      qualifyingPayments: customers.reduce((sum, customer) => sum + customer.paidAmount, 0),
      commissionTotal: partnerLedger.reduce((sum, entry) => sum + entry.amountEtb, 0),
      commissionPending: partnerLedger.filter(entry => ['pending', 'calculated', 'eligible'].includes(entry.status)).reduce((sum, entry) => sum + entry.amountEtb, 0),
      commissionPaid: partnerLedger.filter(entry => entry.status === 'paid').reduce((sum, entry) => sum + entry.amountEtb, 0),
    },
    team: (teamRows ?? []).map((row: any) => ({ id: row.id, name: row.name || 'Unnamed', email: row.email || '—', platformId: row.platform_id || '—', role: row.admin_role })),
    referralCodes: (codeRows ?? []).map((row: any) => ({ id: row.id, salesPersonId: row.sales_person_id, code: row.code, label: row.label, isActive: row.is_active })),
    commissionRule: ruleRows?.[0] ? { id: ruleRows[0].id, name: ruleRows[0].name, salesPersonRate: Number(ruleRows[0].sales_person_rate), marketingAdminRate: Number(ruleRows[0].marketing_admin_rate), abrobizRate: Number(ruleRows[0].abrobiz_rate) } : null,
  }
}

export async function rotateReferralCode(salesPersonId: string): Promise<void> {
  const { error } = await supabase.rpc('super_admin_rotate_marketing_referral_code', { p_sales_person_id: salesPersonId })
  if (error) throw error
}

export async function assignMarketingTeam(salesPersonId: string, marketingAdminId: string): Promise<void> {
  const { error } = await supabase.rpc('super_admin_assign_marketing_team', { p_sales_person_id: salesPersonId, p_marketing_admin_id: marketingAdminId })
  if (error) throw error
}

export async function setCommissionRule(name: string, salesPersonRate: number, marketingAdminRate: number, abrobizRate: number): Promise<void> {
  const { error } = await supabase.rpc('super_admin_set_commission_rule', { p_name: name, p_sales_person_rate: salesPersonRate, p_marketing_admin_rate: marketingAdminRate, p_abrobiz_rate: abrobizRate })
  if (error) throw error
}

export async function updateCommissionStatus(ledgerId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('super_admin_update_commission_status', { p_ledger_id: ledgerId, p_status: status })
  if (error) throw error
}

export async function reassignMarketingAttribution(ownerId: string, salesPersonId: string | null, reason: string): Promise<void> {
  const { error } = await supabase.rpc('super_admin_reassign_marketing_attribution', { p_owner_id: ownerId, p_sales_person_id: salesPersonId, p_reason: reason })
  if (error) throw error
}
