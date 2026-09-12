import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './lib/authContext'
import { RequireAuth, RequireSetup, RequireGuest, RequireOwner, RequireAdmin, RequireAdminPermission, RequireSuperAdmin } from './components/Guards'

import Landing from './pages/Landing'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import { isBusinessSubdomain } from './lib/storefrontUrl'

const Register = lazy(() => import('./pages/Register'))
const Login = lazy(() => import('./pages/Login'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const LegalAcceptance = lazy(() => import('./pages/LegalAcceptance'))
const MarketingPolicy = lazy(() => import('./pages/MarketingPolicy'))
const SetupWizard = lazy(() => import('./pages/SetupWizard'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CatalogEditor = lazy(() => import('./pages/CatalogEditor'))
const BusinessSettings = lazy(() => import('./pages/BusinessSettings'))
const QRPage = lazy(() => import('./pages/QRPage'))
const Billing = lazy(() => import('./pages/Billing'))
const Messages = lazy(() => import('./pages/Messages'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Orders = lazy(() => import('./pages/Orders'))
const Reviews = lazy(() => import('./pages/Reviews'))
const StorefrontHome = lazy(() => import('./pages/storefront/StorefrontHome'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminBusinesses = lazy(() => import('./pages/admin/AdminBusinesses'))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminTelegram = lazy(() => import('./pages/admin/AdminTelegram'))
const AdminMarketing = lazy(() => import('./pages/admin/AdminMarketing'))
const AdminManagement = lazy(() => import('./pages/admin/AdminManagement'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
const TemplateDemo = lazy(() => import('./pages/TemplateDemo'))

function HostStorefront({ page }: { page: ReactNode }) {
  return isBusinessSubdomain() ? page : <Landing />
}

function RouteFallback() {
  return <div role="status" aria-live="polite" style={{ minHeight: '100vh', background: '#0A0C10', color: '#F0EDE7', display: 'grid', placeItems: 'center', fontFamily: 'Inter, sans-serif' }}>Loading AbroBiz…</div>
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/menu" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/about" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/contact" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/book" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/legal-acceptance" element={<RequireAuth><LegalAcceptance /></RequireAuth>} />
        <Route path="/marketing-policy" element={<RequireAuth><MarketingPolicy /></RequireAuth>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/demo/restaurant-cafe" element={<TemplateDemo />} />
        <Route path="/r/:slug" element={<StorefrontHome />} />
        <Route path="/r/:slug/menu" element={<StorefrontHome />} />
        <Route path="/r/:slug/about" element={<StorefrontHome />} />
        <Route path="/r/:slug/contact" element={<StorefrontHome />} />
        <Route path="/r/:slug/book" element={<StorefrontHome />} />

        <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />

        {/* Setup only needs an authenticated user without a business yet — RequireOwner
            handles the "no business -> /setup" redirect from the other pages, and
            SetupWizard itself doesn't need a guard beyond being logged in. */}
        <Route path="/setup" element={<RequireSetup><SetupWizard /></RequireSetup>} />

        <Route path="/dashboard" element={<RequireOwner><Dashboard /></RequireOwner>} />
        <Route path="/dashboard/catalog" element={<RequireOwner><CatalogEditor /></RequireOwner>} />
        <Route path="/dashboard/settings" element={<RequireOwner><BusinessSettings /></RequireOwner>} />
        <Route path="/dashboard/qr" element={<RequireOwner><QRPage /></RequireOwner>} />
        <Route path="/dashboard/billing" element={<RequireOwner><Billing /></RequireOwner>} />
        <Route path="/dashboard/messages" element={<RequireOwner><Messages /></RequireOwner>} />
        <Route path="/dashboard/bookings" element={<RequireOwner><Bookings /></RequireOwner>} />
        <Route path="/dashboard/orders" element={<RequireOwner><Orders /></RequireOwner>} />
        <Route path="/dashboard/reviews" element={<RequireOwner><Reviews /></RequireOwner>} />

        <Route path="/admin" element={<RequireAdmin><AdminOverview /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdminPermission permission="users.read"><AdminUsers /></RequireAdminPermission>} />
        <Route path="/admin/telegram" element={<RequireAdminPermission permission="dashboard.read"><AdminTelegram /></RequireAdminPermission>} />
        <Route path="/admin/marketing" element={<RequireAdminPermission permission="marketing.read"><AdminMarketing /></RequireAdminPermission>} />
        <Route path="/admin/businesses" element={<RequireAdminPermission permission="businesses.read"><AdminBusinesses /></RequireAdminPermission>} />
        <Route path="/admin/payments" element={<RequireAdminPermission permission="payments.read"><AdminPayments /></RequireAdminPermission>} />
        <Route path="/admin/settings" element={<RequireAdminPermission permission="templates.manage"><AdminSettings /></RequireAdminPermission>} />
        <Route path="/admin/announcements" element={<RequireAdminPermission permission="announcements.send"><AdminAnnouncements /></RequireAdminPermission>} />
        <Route path="/admin/management" element={<RequireSuperAdmin><AdminManagement /></RequireSuperAdmin>} />
        <Route path="/admin/audit" element={<RequireSuperAdmin><AdminAudit /></RequireSuperAdmin>} />

        <Route path="*" element={<Landing />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
