import { Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from './lib/authContext'
import { RequireSetup, RequireGuest, RequireOwner, RequireAdmin } from './components/Guards'

import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import VerifyEmail from './pages/VerifyEmail'
import ResetPassword from './pages/ResetPassword'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import SetupWizard from './pages/SetupWizard'
import Dashboard from './pages/Dashboard'
import CatalogEditor from './pages/CatalogEditor'
import BusinessSettings from './pages/BusinessSettings'
import QRPage from './pages/QRPage'
import Billing from './pages/Billing'
import Messages from './pages/Messages'
import Bookings from './pages/Bookings'
import Orders from './pages/Orders'
import Reviews from './pages/Reviews'
import StorefrontHome from './pages/storefront/StorefrontHome'
import AdminOverview from './pages/admin/AdminOverview'
import AdminBusinesses from './pages/admin/AdminBusinesses'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSettings from './pages/admin/AdminSettings'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import TemplateDemo from './pages/TemplateDemo'
import { isBusinessSubdomain } from './lib/storefrontUrl'

function HostStorefront({ page }: { page: ReactNode }) {
  return isBusinessSubdomain() ? page : <Landing />
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/menu" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/about" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/contact" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/book" element={<HostStorefront page={<StorefrontHome />} />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
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
        <Route path="/admin/businesses" element={<RequireAdmin><AdminBusinesses /></RequireAdmin>} />
        <Route path="/admin/payments" element={<RequireAdmin><AdminPayments /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="/admin/announcements" element={<RequireAdmin><AdminAnnouncements /></RequireAdmin>} />

        <Route path="*" element={<Landing />} />
      </Routes>
    </AuthProvider>
  )
}
