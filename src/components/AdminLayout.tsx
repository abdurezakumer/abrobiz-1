import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Activity, BadgeDollarSign, Building2, CreditCard, SlidersHorizontal, LogOut, Menu as MenuIcon, ShieldCheck, Megaphone, Users, ClipboardList, Copy, Send, TrendingUp, Link2, WalletCards, Lock, LifeBuoy, Bot } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { hasAdminPermission, type AdminPermission } from '../lib/api/adminControl'

type AdminNavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission?: AdminPermission
  superOnly?: boolean
  section?: string
  group?: string
}

const navItems: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard.read' as const },
  { to: '/admin/users', label: 'User directory', icon: Users, permission: 'users.read' as const },
  { to: '/admin/telegram', label: 'Telegram', icon: Send, permission: 'dashboard.read' as const },
  { to: '/admin/marketing', label: 'Marketing', icon: TrendingUp, permission: 'marketing.read' as const },
  { to: '/admin/businesses', label: 'Businesses', icon: Building2, permission: 'businesses.read' as const },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, permission: 'payments.read' as const },
  { to: '/admin/pricing', label: 'Plan pricing', icon: CreditCard, permission: 'plans.manage' as const },
  { to: '/admin/payment-methods', label: 'Payment accounts', icon: CreditCard, permission: 'payment_methods.manage' as const },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcements.send' as const },
  { to: '/admin/support', label: 'Support requests', icon: LifeBuoy, permission: 'support.manage' as const },
  { to: '/admin/settings', label: 'Settings', icon: SlidersHorizontal, permission: 'templates.manage' as const },
  { to: '/admin/management', label: 'Admin management', icon: Users, superOnly: true },
  { to: '/admin/mcp-access', label: 'MCP access', icon: Bot, superOnly: true },
  { to: '/admin/audit', label: 'Audit trail', icon: ClipboardList, superOnly: true },
  { to: '/security/account', label: 'Account security', icon: Lock, permission: 'dashboard.read' as const },
]

const marketingWorkspaceItems: AdminNavItem[] = [
  { to: '/admin/marketing?section=overview', section: 'overview', label: 'Overview', icon: LayoutDashboard, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=customers', section: 'customers', label: 'Customers', icon: Users, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=payments', section: 'payments', label: 'Pending payments', icon: WalletCards, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=commissions', section: 'commissions', label: 'Commissions', icon: BadgeDollarSign, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=referral', section: 'referral', label: 'Referral center', icon: Link2, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=performance', section: 'performance', label: 'Performance', icon: TrendingUp, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=activity', section: 'activity', label: 'Activity', icon: Activity, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=payouts', section: 'payouts', label: 'Payouts', icon: CreditCard, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=policy', section: 'policy', label: 'Marketing policy', icon: ClipboardList, permission: 'marketing.read', group: 'MARKETING WORKSPACE' },
  { to: '/admin/marketing?section=team', section: 'team', label: 'My sales team', icon: ShieldCheck, permission: 'marketing.manage', group: 'MARKETING WORKSPACE' },
  { to: '/admin/telegram', label: 'Telegram', icon: Send, permission: 'dashboard.read', group: 'TOOLS' },
  { to: '/security/account', label: 'Account security', icon: Lock, permission: 'dashboard.read', group: 'ACCOUNT' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMarketingWorkspace = profile?.adminRole === 'sales_person' || profile?.adminRole === 'marketing_admin'
  const currentSection = new URLSearchParams(location.search).get('section') || 'overview'
  const adminLabel = isMarketingWorkspace
    ? profile.name?.trim() || (profile.adminRole === 'sales_person' ? 'Sales Person' : 'Marketing Manager')
    : profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'
  const visibleNavItems = isMarketingWorkspace
    ? marketingWorkspaceItems.filter(item => !!item.permission && hasAdminPermission(profile, item.permission))
    : navItems.filter(item => {
      if (item.superOnly) return profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
      return !!item.permission && hasAdminPermission(profile, item.permission)
    })

  const Sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 6px' }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, background: '#0A0C10',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ShieldCheck size={17} color="#D4A853" />
        </div>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#F0EDE7', fontSize: 17 }}>
          {adminLabel}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(240,237,231,0.48)', padding: '0 8px 16px' }}>{isMarketingWorkspace ? 'Marketing workspace' : 'Platform control'} · {profile?.adminRole ?? 'administrator'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 10.5, padding: '0 8px 18px' }}>
        <span style={{ color: '#D4A853', fontWeight: 700 }}>{profile?.platformId ?? 'ABZ—'}</span>
        <button type="button" aria-label="Copy platform ID" onClick={() => profile?.platformId && void navigator.clipboard?.writeText(profile.platformId)} style={{ border: 0, background: 'transparent', color: 'inherit', padding: 0, cursor: 'pointer' }}><Copy size={11} /></button>
      </div>

      <nav aria-label={isMarketingWorkspace ? 'Marketing workspace navigation' : 'Admin navigation'} style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {visibleNavItems.map((item, index) => {
          const active = location.pathname === item.to
            || (!!item.section && location.pathname === '/admin/marketing' && currentSection === item.section)
          const showGroupLabel = !!item.group && item.group !== visibleNavItems[index - 1]?.group
          const Icon = item.icon
          return (
            <div key={item.to}>
              {showGroupLabel && <div style={{ padding: index === 0 ? '3px 11px 7px' : '17px 11px 7px', color: 'rgba(240,237,231,0.4)', fontSize: 10, fontWeight: 750, letterSpacing: 1.15 }}>{item.group}</div>}
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, padding: '11px 12px', borderRadius: 11,
                  color: active ? '#0A0C10' : 'rgba(240,237,231,0.78)',
                  background: active ? '#D4A853' : 'transparent',
                  fontSize: 14.5, fontWeight: active ? 700 : 550, textDecoration: 'none', flexShrink: 0,
                  transition: 'background .16s ease, color .16s ease',
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
                {item.label}
              </Link>
            </div>
          )
        })}
      </nav>

      <button
        onClick={async () => {
          await signOut()
          navigate('/login')
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
          width: '100%', flexShrink: 0, color: 'rgba(240,237,231,0.5)', background: 'transparent', border: 'none', fontSize: 14,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <LogOut size={17} /> Sign out
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: '#0A0C10' }} className="admin-sidebar-desktop">
        {Sidebar}
      </div>

      <div
        className="admin-topbar-mobile"
        style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
          background: '#0A0C10', position: 'sticky', top: 0, zIndex: 30,
        }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: '#F0EDE7' }}>
          <MenuIcon size={22} />
        </button>
        <span style={{ color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{adminLabel}</span>
        <div style={{ width: 22 }} />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
            />
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'tween', duration: 0.2 }}
              style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: '#0A0C10', zIndex: 41 }}
            >
              {Sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="admin-content-area" style={{ marginLeft: 240 }}>
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ padding: '24px', maxWidth: 1200 }}
        >
          {children}
        </motion.main>
      </div>

      <style>{`
        @media (max-width: 899px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-topbar-mobile { display: flex !important; }
          .admin-content-area { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
