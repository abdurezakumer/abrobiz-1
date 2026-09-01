import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireOwner, RequireAdmin, RequireGuest } from '../Guards'

const mockUseAuth = vi.fn()
vi.mock('../../lib/authContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRoute(guarded: React.ReactNode, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={guarded} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/setup" element={<div>Setup Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/admin" element={<div>Admin Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => {
  mockUseAuth.mockReset()
})

describe('RequireAuth', () => {
  it('redirects to /login when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false })
    renderWithRoute(<RequireAuth><div>Secret</div></RequireAuth>)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders the protected content once logged in', () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    renderWithRoute(<RequireAuth><div>Secret</div></RequireAuth>)
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })

  it('shows nothing (a spinner) while auth state is still loading, not a premature redirect', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true })
    renderWithRoute(<RequireAuth><div>Secret</div></RequireAuth>)
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })
})

describe('RequireOwner', () => {
  it('sends a logged-out visitor to /login', () => {
    mockUseAuth.mockReturnValue({ session: null, profile: null, business: null, loading: false })
    renderWithRoute(<RequireOwner><div>Owner area</div></RequireOwner>)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('sends an admin account to /admin, not the owner dashboard', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'admin@example.com' } }, profile: { role: 'admin', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, business: null, loading: false,
    })
    renderWithRoute(<RequireOwner><div>Owner area</div></RequireOwner>)
    expect(screen.getByText('Admin Page')).toBeInTheDocument()
  })

  it('sends an owner with no business yet to /setup', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'owner@example.com' } }, profile: { role: 'owner', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, business: null, loading: false,
    })
    renderWithRoute(<RequireOwner><div>Owner area</div></RequireOwner>)
    expect(screen.getByText('Setup Page')).toBeInTheDocument()
  })

  it('renders the owner area once there is a session, an owner profile, and a business', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'owner@example.com' } }, profile: { role: 'owner', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, business: { id: 'biz1' }, loading: false,
    })
    renderWithRoute(<RequireOwner><div>Owner area</div></RequireOwner>)
    expect(screen.getByText('Owner area')).toBeInTheDocument()
  })
})

describe('RequireAdmin', () => {
  it('sends a non-admin owner to the owner dashboard, not the admin panel', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'owner@example.com' } }, profile: { role: 'owner', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, loading: false,
    })
    renderWithRoute(<RequireAdmin><div>Admin area</div></RequireAdmin>)
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('renders the admin area for an actual admin', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'admin@example.com' } }, profile: { role: 'admin', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, loading: false,
    })
    renderWithRoute(<RequireAdmin><div>Admin area</div></RequireAdmin>)
    expect(screen.getByText('Admin area')).toBeInTheDocument()
  })
})

describe('RequireGuest', () => {
  it('lets a logged-out visitor see the guest page (e.g. login form)', () => {
    mockUseAuth.mockReturnValue({ session: null, profile: null, business: null, loading: false })
    renderWithRoute(<RequireGuest><div>Login form</div></RequireGuest>)
    expect(screen.getByText('Login form')).toBeInTheDocument()
  })

  it('bounces an already-logged-in owner away from the login page to their dashboard', () => {
    mockUseAuth.mockReturnValue({
        session: { user: { id: 'u1', email: 'owner@example.com' } }, profile: { role: 'owner', emailVerifiedAt: 'now', termsAcceptedAt: 'now', privacyAcceptedAt: 'now', legalVersion: '2026-01' }, business: { id: 'biz1' }, loading: false,
    })
    renderWithRoute(<RequireGuest><div>Login form</div></RequireGuest>)
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })
})
