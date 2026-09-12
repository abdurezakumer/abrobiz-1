import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { safeInternalPath } from '../lib/safeUrl'
import { daysRemaining } from '../lib/api/subscriptions'
import SubscriptionExpiredGate from './SubscriptionExpiredGate'
import { hasAdminPermission, type AdminPermission } from '../lib/api/adminControl'

function FullScreenSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0C10' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid rgba(212,168,83,0.2)',
          borderTopColor: '#D4A853',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function RequireSetup({ children }: { children: ReactNode }) {
  const { session, profile, business, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile && !profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} state={{ from: { pathname: safeInternalPath(location.pathname) } }} replace />
  if (profile && (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01')) {
    return <Navigate to="/legal-acceptance" state={{ from: location }} replace />
  }
  if (profile?.role === 'admin' || profile?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (profile?.role !== 'owner') return <Navigate to="/login" replace />
  if (business) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const { session, profile, business, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (session && profile) {
    if (!profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} state={{ from: { pathname: safeInternalPath(location.pathname) } }} replace />
    if (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01') return <Navigate to="/legal-acceptance" replace />
    if (profile.role === 'admin' || profile.role === 'super_admin') return <Navigate to="/admin" replace />
    if (business) return <Navigate to="/dashboard" replace />
    return <Navigate to="/setup" replace />
  }
  return <>{children}</>
}

export function RequireOwner({ children }: { children: ReactNode }) {
  const { session, profile, business, subscription, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile && !profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} state={{ from: { pathname: safeInternalPath(location.pathname) } }} replace />
  if (profile && (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01')) return <Navigate to="/legal-acceptance" state={{ from: location }} replace />
  if (profile?.role === 'admin' || profile?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (profile?.role !== 'owner') return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/setup" replace />
  const days = daysRemaining(subscription?.endDate ?? null)
  const expired = subscription?.status === 'expired' || (days !== null && days < 0)
  if (expired && location.pathname !== '/dashboard/billing') return <SubscriptionExpiredGate business={business} subscription={subscription} />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile && !profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} state={{ from: { pathname: safeInternalPath(location.pathname) } }} replace />
  if (profile && (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01')) return <Navigate to="/legal-acceptance" state={{ from: location }} replace />
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function RequireAdminPermission({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile && !profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} replace />
  if (profile && (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01')) return <Navigate to="/legal-acceptance" replace />
  if (!hasAdminPermission(profile, permission)) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile && !profile.emailVerifiedAt) return <Navigate to={'/verify-email?email=' + encodeURIComponent(session.user.email ?? '')} replace />
  if (profile && (!profile.termsAcceptedAt || !profile.privacyAcceptedAt || profile.legalVersion !== '2026-01')) return <Navigate to="/legal-acceptance" replace />
  if (profile?.role !== 'super_admin' && profile?.adminRole !== 'super_admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}
