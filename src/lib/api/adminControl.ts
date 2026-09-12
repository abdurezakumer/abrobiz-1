import { supabase } from '../supabaseClient'
import type { AdminRole, Profile } from '../../types'

export const ADMIN_ROLES: Array<{ value: AdminRole; label: string; description: string }> = [
  { value: 'none', label: 'Business owner', description: 'Regular owner account with no admin access.' },
  { value: 'operations', label: 'Operations admin', description: 'Businesses, subscriptions, and payment review.' },
  { value: 'finance', label: 'Finance admin', description: 'Payment review and billing visibility.' },
  { value: 'support', label: 'Support admin', description: 'User support and platform assistance.' },
  { value: 'content', label: 'Content admin', description: 'Templates, categories, and announcements.' },
  { value: 'super_admin', label: 'Super administrator', description: 'Full platform control and audit access.' },
]

export type AdminPermission = 'dashboard.read' | 'businesses.read' | 'businesses.manage' | 'payments.read' | 'payments.review' | 'users.read' | 'templates.manage' | 'announcements.send' | 'support.read'

export function hasAdminPermission(profile: Profile | null, permission: AdminPermission): boolean {
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return false
  if (profile.role === 'super_admin' || profile.adminRole === 'super_admin') return true
  const matrix: Record<string, AdminPermission[]> = {
    operations: ['dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read'],
    finance: ['dashboard.read', 'payments.read', 'payments.review'],
    support: ['dashboard.read', 'users.read', 'support.read'],
    content: ['dashboard.read', 'templates.manage', 'announcements.send'],
  }
  return matrix[profile.adminRole]?.includes(permission) ?? false
}

export interface AdminUserRow {
  id: string
  platformId: string
  name: string
  email: string
  phone: string
  role: 'owner' | 'admin' | 'super_admin'
  adminRole: AdminRole
  createdAt: string
  businessName?: string
}

export interface AdminAuditRow {
  id: string
  adminId: string
  adminPlatformId: string
  adminName: string
  action: string
  targetTable: string | null
  targetId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export interface AdminDashboardData {
  users: number
  admins: number
  businesses: number
  activeSubscriptions: number
  trialSubscriptions: number
  expiredSubscriptions: number
  pendingPayments: number
  approvedRevenue: number
  signupsByDay: Array<{ date: string; value: number }>
  revenueByDay: Array<{ date: string; value: number }>
  recentUsers: AdminUserRow[]
  recentAdmins: AdminUserRow[]
  recentPayments: Array<{ id: string; amount: number; status: string; createdAt: string; businessName: string }>
  recentAudit: AdminAuditRow[]
}

function mapUser(row: any): AdminUserRow {
  return {
    id: row.id,
    platformId: row.platform_id,
    name: row.name || 'Unnamed user',
    email: row.email || '—',
    phone: row.phone || '—',
    role: row.role,
    adminRole: row.admin_role ?? 'none',
    createdAt: row.created_at,
    businessName: row.businesses?.[0]?.name ?? row.businesses?.name,
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function emptySeries(days: number): Array<{ date: string; value: number }> {
  const result: Array<{ date: string; value: number }> = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    result.push({ date: dateKey(d), value: 0 })
  }
  return result
}

function makeSeries(rows: any[], value: (row: any) => number): Array<{ date: string; value: number }> {
  const result = emptySeries(14)
  const byDate = new Map(result.map(row => [row.date, row]))
  for (const row of rows) {
    const key = dateKey(new Date(row.created_at))
    const point = byDate.get(key)
    if (point) point.value += value(row)
  }
  return result
}

export async function getAdminDashboard(profile?: Profile | null): Promise<AdminDashboardData> {
  const isSuper = profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
  const canSeeUsers = isSuper || profile?.adminRole === 'support'
  const since = new Date()
  since.setDate(since.getDate() - 13)
  const sinceIso = since.toISOString()
  const [usersCount, adminsCount, businessesCount, activeCount, trialCount, expiredCount, pendingCount, approvedRows, signupRows, revenueRows, recentUsersRows, recentAdminsRows, recentPaymentsRows, auditRows] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('payments').select('amount_etb').eq('status', 'approved').limit(10000),
    supabase.from('profiles').select('created_at').gte('created_at', sinceIso).order('created_at', { ascending: true }).limit(10000),
    supabase.from('payments').select('amount_etb, status, created_at').gte('created_at', sinceIso).eq('status', 'approved').order('created_at', { ascending: true }).limit(10000),
    canSeeUsers ? supabase.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at, businesses(name)').order('created_at', { ascending: false }).limit(8) : supabase.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').eq('id', '00000000-0000-0000-0000-000000000000'),
    isSuper ? supabase.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at').in('role', ['admin', 'super_admin']).order('created_at', { ascending: false }).limit(8) : supabase.from('profiles').select('id').eq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('payments').select('id, amount_etb, status, created_at, businesses(name)').order('created_at', { ascending: false }).limit(8),
    isSuper ? supabase.from('admin_logs').select('id, admin_id, action, target_table, target_id, meta, created_at, profiles!admin_logs_admin_id_fkey(platform_id, name)').order('created_at', { ascending: false }).limit(8) : supabase.from('admin_logs').select('id').eq('id', '00000000-0000-0000-0000-000000000000'),
  ])
  const firstError = [usersCount, adminsCount, businessesCount, activeCount, trialCount, expiredCount, pendingCount, approvedRows, signupRows, revenueRows, recentUsersRows, recentAdminsRows, recentPaymentsRows, auditRows].find(result => result.error)?.error
  if (firstError) throw firstError
  return {
    users: canSeeUsers ? usersCount.count ?? 0 : 0,
    admins: isSuper ? adminsCount.count ?? 0 : 0,
    businesses: businessesCount.count ?? 0,
    activeSubscriptions: activeCount.count ?? 0,
    trialSubscriptions: trialCount.count ?? 0,
    expiredSubscriptions: expiredCount.count ?? 0,
    pendingPayments: pendingCount.count ?? 0,
    approvedRevenue: (approvedRows.data ?? []).reduce((sum, row: any) => sum + Number(row.amount_etb ?? 0), 0),
    signupsByDay: makeSeries(signupRows.data ?? [], () => 1),
    revenueByDay: makeSeries(revenueRows.data ?? [], row => Number(row.amount_etb ?? 0)),
    recentUsers: (recentUsersRows.data ?? []).map(mapUser),
    recentAdmins: (recentAdminsRows.data ?? []).map(mapUser),
    recentPayments: (recentPaymentsRows.data ?? []).map((row: any) => ({ id: row.id, amount: Number(row.amount_etb ?? 0), status: row.status, createdAt: row.created_at, businessName: row.businesses?.name ?? 'Business' })),
    recentAudit: (auditRows.data ?? []).map((row: any) => ({
      id: row.id, adminId: row.admin_id, adminPlatformId: row.profiles?.platform_id ?? '—', adminName: row.profiles?.name ?? 'Administrator',
      action: row.action, targetTable: row.target_table, targetId: row.target_id, meta: row.meta ?? {}, createdAt: row.created_at,
    })),
  }
}

export async function listPlatformUsers(search = ''): Promise<AdminUserRow[]> {
  let query = supabase.from('profiles').select('id, platform_id, name, email, phone, role, admin_role, created_at, businesses(name)').order('created_at', { ascending: false }).limit(100)
  if (search.trim()) {
    const term = search.trim().replace(/[%_,]/g, '')
    query = query.or(`platform_id.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapUser)
}

export async function assignAdminRole(userId: string, adminRole: AdminRole): Promise<AdminUserRow> {
  const { data, error } = await supabase.rpc('super_admin_assign_admin_role', { p_user_id: userId, p_admin_role: adminRole })
  if (error) throw error
  return mapUser(data)
}

export async function listAdminAudit(): Promise<AdminAuditRow[]> {
  const { data, error } = await supabase.from('admin_logs').select('id, admin_id, action, target_table, target_id, meta, created_at, profiles!admin_logs_admin_id_fkey(platform_id, name)').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.id, adminId: row.admin_id, adminPlatformId: row.profiles?.platform_id ?? '—', adminName: row.profiles?.name ?? 'Administrator', action: row.action, targetTable: row.target_table, targetId: row.target_id, meta: row.meta ?? {}, createdAt: row.created_at }))
}
