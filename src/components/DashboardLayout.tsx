import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Settings as SettingsIcon, QrCode, CreditCard, LogOut, Menu as MenuIcon, X, Bell, ExternalLink, Mail, CalendarCheck, Lock, ShoppingBag, Star, User,
} from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import { daysRemaining } from '../lib/api/subscriptions'
import { hasFeature } from '../lib/entitlements'
import { sendVerificationEmail } from '../lib/api/emailVerification'
import { categoryIcon } from '../lib/icons'
import { publicStorefrontUrl } from '../lib/storefrontUrl'

interface Notification {
  id: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, business, subscription, signOut } = useAuth()
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [categoryLabel, setCategoryLabel] = useState('Catalog')
  const [icon, setIcon] = useState('Store')

  useEffect(() => {
    if (!business?.categoryId) return
    supabase
      .from('business_categories')
      .select('category_label, icon')
      .eq('id', business.categoryId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCategoryLabel(data.category_label)
          setIcon(data.icon)
        }
      })
  }, [business?.categoryId])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications(data ?? []))
  }, [profile])

  const unreadCount = notifications.filter(n => !n.is_read).length
  const CategoryIcon = categoryIcon(icon)

  const days = daysRemaining(subscription?.endDate ?? null)
  const statusLabel =
    subscription?.status === 'trial'
      ? `Trial · ${days ?? 0}d left`
      : subscription?.status === 'active'
      ? `Active · ${days ?? 0}d left`
      : subscription?.status === 'expired'
      ? 'Expired'
      : ''
  const statusColor =
    subscription?.status === 'expired' || (days !== null && days !== undefined && days <= 3)
      ? '#F87171'
      : '#D4A853'

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard/catalog', label: categoryLabel, icon: CategoryIcon },
    { to: '/dashboard/bookings', label: 'Bookings', icon: CalendarCheck, locked: !hasFeature(subscription, 'bookings') },
    { to: '/dashboard/orders', label: 'Orders', icon: ShoppingBag, locked: !hasFeature(subscription, 'ordering') },
    { to: '/dashboard/reviews', label: 'Reviews', icon: Star, locked: !hasFeature(subscription, 'reviews') },
    { to: '/dashboard/messages', label: 'Messages', icon: Mail },
    { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { to: '/dashboard/qr', label: 'QR Code', icon: QrCode },
    { to: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
  ]

  async function markAllRead() {
    if (!profile) return
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const Sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 28px', flexShrink: 0 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, background: '#D4A853',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0A0C10',
          }}
        >
          A
        </div>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#F0EDE7', fontSize: 17 }}>
          AbroBiz
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {navItems.map(item => {
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
                fontSize: 14, fontWeight: active ? 600 : 500, textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s', flexShrink: 0,
              }}
            >
              <Icon size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {'locked' in item && item.locked && <Lock size={12} style={{ opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Everything below here is pinned — never part of the scrollable nav
          area — so Sign Out (and the renewal prompt) stay reachable no
          matter how many nav items get added above. */}
      <div style={{ flexShrink: 0 }}>
        {business && (
          <div
            style={{
              margin: '12px 8px', padding: '12px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(240,237,231,0.4)', marginBottom: 4 }}>Subscription</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{statusLabel}</div>
            {(subscription?.status === 'expired' || (days !== null && days !== undefined && days <= 3)) && (
              <Link
                to="/dashboard/billing"
                style={{ fontSize: 12, color: '#D4A853', textDecoration: 'underline', display: 'block', marginTop: 4 }}
              >
                Renew now →
              </Link>
            )}
          </div>
        )}

        {business?.isPublished && (
          <a
            href={publicStorefrontUrl(business.slug)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, margin: '0 8px 12px', padding: '9px 12px',
              borderRadius: 10, fontSize: 13, color: 'rgba(240,237,231,0.7)', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ExternalLink size={14} /> View live site
          </a>
        )}

        <button
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
            width: '100%', color: 'rgba(240,237,231,0.5)', background: 'transparent', border: 'none', fontSize: 14,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE' }}>
      {/* Desktop sidebar */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: '#0A0C10',
          display: window.innerWidth >= 900 ? 'block' : 'none',
        }}
        className="dashboard-sidebar-desktop"
      >
        {Sidebar}
      </div>

      {/* Mobile top bar */}
      <div
        className="dashboard-topbar-mobile"
        style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
          background: '#0A0C10', position: 'sticky', top: 0, zIndex: 30,
        }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: '#F0EDE7' }}>
          <MenuIcon size={22} />
        </button>
        <span style={{ color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>AbroBiz</span>
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
              <button
                onClick={() => setMobileOpen(false)}
                style={{ position: 'absolute', top: 20, right: -40, background: 'none', border: 'none', color: '#F0EDE7' }}
              >
                <X size={20} />
              </button>
              {Sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ marginLeft: window.innerWidth >= 900 ? 240 : 0 }} className="dashboard-content-area">
        <div
          style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '16px 24px 0', position: 'relative',
          }}
        >
          <button
            onClick={() => {
              setAccountMenuOpen(v => !v)
              setNotifOpen(false)
            }}
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(10,12,16,0.1)',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <User size={17} color="#0A0C10" />
          </button>

          <AnimatePresence>
            {accountMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{
                  position: 'absolute', top: 60, right: 24, width: 220,
                  background: '#fff', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 20,
                  border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden',
                }}
              >
                {profile?.email && (
                  <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'rgba(10,12,16,0.5)', borderBottom: '1px solid rgba(10,12,16,0.06)', wordBreak: 'break-all' }}>
                    {profile.email}
                  </div>
                )}
                <button
                  onClick={async () => {
                    await signOut()
                    navigate('/login')
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, color: '#DC2626', textAlign: 'left',
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => {
              setNotifOpen(v => !v)
              setAccountMenuOpen(false)
              if (!notifOpen) markAllRead()
            }}
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(10,12,16,0.1)',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <Bell size={17} color="#0A0C10" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute', top: -4, right: -4, background: '#D4A853', color: '#0A0C10',
                  fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{
                  position: 'absolute', top: 60, right: 24, width: 320, maxHeight: 360, overflowY: 'auto',
                  background: '#fff', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 20,
                  border: '1px solid rgba(10,12,16,0.06)',
                }}
              >
                <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid rgba(10,12,16,0.06)' }}>
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 20, fontSize: 13, color: 'rgba(10,12,16,0.4)', textAlign: 'center' }}>
                    Nothing yet
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(10,12,16,0.05)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0C10' }}>{n.title}</div>
                      <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.55)', marginTop: 2 }}>{n.body}</div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ padding: '16px 24px 48px', maxWidth: 1100 }}
        >
          {profile && !profile.emailVerifiedAt && !verifyBannerDismissed && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                background: '#fff', border: '1px solid rgba(212,168,83,0.35)', borderRadius: 12, padding: '10px 16px', marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, color: '#0A0C10' }}>
                Please confirm your email address{profile.email ? ` (${profile.email})` : ''}.
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={async () => {
                    setResendState('sending')
                    setResendError('')
                    try {
                      await sendVerificationEmail()
                      setResendState('sent')
                    } catch (err) {
                      setResendState('error')
                      setResendError(err instanceof Error ? err.message : 'The email could not be sent.')
                    }
                  }}
                  disabled={resendState !== 'idle'}
                  style={{ background: 'none', border: 'none', color: '#D4A853', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? 'Sent — check your inbox' : resendState === 'error' ? 'Try again' : 'Resend link'}
                </button>
                {resendState === 'error' && <span style={{ fontSize: 12, color: '#DC2626' }}>{resendError}</span>}
                <button onClick={() => setVerifyBannerDismissed(true)} style={{ background: 'none', border: 'none', color: 'rgba(10,12,16,0.35)', cursor: 'pointer', padding: 0 }}>
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
          {children}
        </motion.main>
      </div>

      <style>{`
        @media (max-width: 899px) {
          .dashboard-sidebar-desktop { display: none !important; }
          .dashboard-topbar-mobile { display: flex !important; }
          .dashboard-content-area { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
