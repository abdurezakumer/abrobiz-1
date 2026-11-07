import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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
      customers: [
        {
          attributionId: 'attr-sales', ownerId: 'owner-sales', ownerName: 'Customer One', ownerEmail: 'one@example.com', ownerPhone: '0900000001', ownerPlatformId: 'U00000001',
          businessName: 'Sales Referral Cafe', businessSlug: 'sales-cafe', salesPersonId: 'sales-1', marketingAdminId: 'manager-1', referralCode: 'SA001', source: 'referral_code', attributedAt: new Date().toISOString(),
          paymentStatus: 'unpaid', planName: 'Starter', amountRequired: 1000, paidAmount: 0, qualifyingAmount: 0, paymentId: null, paymentCreatedAt: null, paymentUpdatedAt: null,
          subscriptionStatus: null, daysPending: 0, lastReminderAt: null, salesPersonName: 'Sales Referral Person', marketingAdminName: 'Almaz Bekele',
        },
        {
          attributionId: 'attr-manager', ownerId: 'owner-manager', ownerName: 'Customer Two', ownerEmail: 'two@example.com', ownerPhone: '0900000002', ownerPlatformId: 'U00000002',
          businessName: 'Manager Referral Spa', businessSlug: 'manager-spa', salesPersonId: null, marketingAdminId: 'manager-1', referralCode: 'MA01', source: 'referral_code', attributedAt: new Date().toISOString(),
          paymentStatus: 'unpaid', planName: 'Starter', amountRequired: 1000, paidAmount: 0, qualifyingAmount: 0, paymentId: null, paymentCreatedAt: null, paymentUpdatedAt: null,
          subscriptionStatus: null, daysPending: 0, lastReminderAt: null, salesPersonName: null, marketingAdminName: 'Almaz Bekele',
        },
      ],
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
    const sidebar = screen.getByRole('navigation', { name: 'Marketing dashboard sections' })
    expect(within(sidebar).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(within(sidebar).getByRole('button', { name: 'Referral center' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: 'Team management' })).toBeInTheDocument()
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Customers' }))
    expect(within(sidebar).getByRole('button', { name: 'Customers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('columnheader', { name: 'Referred by' })).toBeInTheDocument()
    expect(screen.getByText('Sales Referral Person')).toBeInTheDocument()
    expect(screen.getByText('Marketing Manager · MA01')).toBeInTheDocument()
    expect(screen.queryByText('Referrer unavailable')).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.getMarketingWorkspace).toHaveBeenCalledTimes(1))
  })
})
