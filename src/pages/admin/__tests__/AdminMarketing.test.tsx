import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getMarketingWorkspace: vi.fn(),
}))

vi.mock('../../../lib/authContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../components/AdminLayout', () => ({
  default: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../../lib/api/marketing', () => ({
  assignMarketingTeam: vi.fn(),
  getMarketingWorkspace: mocks.getMarketingWorkspace,
  manageSalesTeam: vi.fn(),
  rotateReferralCode: vi.fn(),
  setCommissionRule: vi.fn(),
  updateCommissionStatus: vi.fn(),
}))

import AdminMarketing from '../AdminMarketing'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Marketing Admin overview', () => {
  it('loads the scoped overview and greets the manager by their profile name', async () => {
    mocks.useAuth.mockReturnValue({
      profile: { id: 'manager-1', role: 'admin', adminRole: 'marketing_admin', name: 'Almaz Bekele' },
    })
    mocks.getMarketingWorkspace.mockResolvedValue({
      customers: [],
      ledger: [],
      activity: [],
      summary: {
        customers: 0,
        paidCustomers: 0,
        pendingCustomers: 0,
        qualifyingPayments: 0,
        commissionTotal: 0,
        commissionPending: 0,
        commissionPaid: 0,
        activeCustomers: 0,
        liveBusinesses: 0,
        conversionRate: 0,
        myCommission: 0,
        teamCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
      },
      team: [],
      managedSalesIds: [],
      salesPool: [],
      referralCodes: [],
      commissionRule: null,
    })

    render(<AdminMarketing />)

    expect(await screen.findByRole('heading', { name: 'Welcome, Almaz Bekele' })).toBeInTheDocument()
    expect(screen.getByText('Live websites')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getMarketingWorkspace).toHaveBeenCalledTimes(1))
  })
})
