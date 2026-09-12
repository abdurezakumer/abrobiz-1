import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Building2, CreditCard, SlidersHorizontal, LogOut, Menu as MenuIcon, ShieldCheck, Megaphone, Users, ClipboardList, Copy } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { hasAdminPermission } from '../lib/api/adminControl'

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard.read' as const },
  { to: '/admin/users', label: 'User directory', icon: Users, permission: 'users.read' as const },
  { to: '/admin/businesses', label: 'Businesses', icon: Building2, permission: 'businesses.read' as const },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, permission: 'payments.read' as const },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcements.send' as const },
  { to: '/admin/settings', label: 'Settings', icon: SlidersHorizontal, permission: 'templates.manage' as const },
  { to: '/admin/management', label: 'Admin management', icon: Users, superOnly: true },
  { to: '/admin/audit', label: 'Audit trail', icon: ClipboardList, superOnly: true },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

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
          {profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(240,237,231,0.35)', padding: '0 8px 16px' }}>Platform control · {profile?.adminRole ?? 'administrator'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 10.5, padding: '0 8px 18px' }}>
        <span style={{ color: '#D4A853', fontWeight: 700 }}>{profile?.platformId ?? 'ABZ—'}</span>
        <button type="button" aria-label="Copy platform ID" onClick={() => profile?.platformId && void navigator.clipboard?.writeText(profile.platformId)} style={{ border: 0, background: 'transparent', color: 'inherit', padding: 0, cursor: 'pointer' }}><Copy size={11} /></button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {navItems.filter(item => item.superOnly ? profile?.role === 'super_admin' || profile?.adminRole === 'super_admin' : !!item.permission && hasAdminPermission(profile, item.permission)).map(item => {
          const active = location.pathname === item.to
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                color: active ? '#0A0C10' : 'rgba(240,237,231,0.7)',
                background: active ? '#D4A853' : 'transparent',
                fontSize: 14, fontWeight: active ? 600 : 500, textDecoration: 'none', flexShrink: 0,
              }}
            >
              <Icon size={17} />
              {item.label}
            </Link>
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
        <span style={{ color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
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
