import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getAdminDashboard: vi.fn(),
}))

vi.mock('../../../lib/authContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/api/adminControl', () => ({ getAdminDashboard: mocks.getAdminDashboard }))
vi.mock('../../../components/AdminLayout', () => ({
  default: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
}))

import AdminOverview from '../AdminOverview'

function renderAdminOverview() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/marketing" element={<div>Attribution-scoped marketing workspace</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminOverview marketing role scope', () => {
  it.each(['sales_person', 'marketing_admin'])('routes %s away from global platform totals', async adminRole => {
    mocks.useAuth.mockReturnValue({ profile: { role: 'admin', adminRole } })

    renderAdminOverview()

    expect(await screen.findByText('Attribution-scoped marketing workspace')).toBeInTheDocument()
    expect(mocks.getAdminDashboard).not.toHaveBeenCalled()
  })
})
