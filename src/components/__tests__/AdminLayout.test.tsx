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
  it('shows the manager name and links Overview to the scoped marketing workspace', () => {
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
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin/marketing')
    expect(screen.queryByRole('link', { name: 'Marketing' })).not.toBeInTheDocument()
    expect(screen.getByText('Marketing overview content')).toBeInTheDocument()
  })
})
