import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../lib/authContext', () => ({ useAuth: mocks.useAuth }))

import AdminLayout from '../AdminLayout'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminLayout marketing navigation', () => {
  it('shows the manager name and puts marketing sections in the primary sidebar', () => {
    mocks.useAuth.mockReturnValue({
      profile: {
        id: 'manager-1',
        role: 'admin',
        adminRole: 'marketing_admin',
        name: 'Almaz Bekele',
        platformId: 'U12345678',
      },
      signOut: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/marketing']}>
        <AdminLayout><div>Marketing overview content</div></AdminLayout>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Almaz Bekele').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin/marketing?section=overview')
    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/admin/marketing?section=customers')
    expect(screen.getByRole('link', { name: 'Pending payments' })).toHaveAttribute('href', '/admin/marketing?section=payments')
    expect(screen.getByRole('link', { name: 'Commissions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Referral center' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Performance' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My sales team' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Marketing' })).not.toBeInTheDocument()
    expect(screen.getByText('Marketing overview content')).toBeInTheDocument()
  })

  it('shows the sales workspace links but does not expose team management', () => {
    mocks.useAuth.mockReturnValue({
      profile: {
        id: 'sales-1',
        role: 'admin',
        adminRole: 'sales_person',
        name: 'Hana Sales',
        platformId: 'SA001',
      },
      signOut: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/marketing?section=customers']}>
        <AdminLayout><div>Sales workspace content</div></AdminLayout>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Pending payments' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Referral center' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My sales team' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Telegram' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account security' })).toBeInTheDocument()
  })
})
