import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    unenroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
  signOut: vi.fn(),
}))

vi.mock('../../lib/supabaseClient', () => ({ supabase: { auth: { mfa: mocks.mfa } } }))
vi.mock('../../lib/authContext', () => ({
  useAuth: () => ({ profile: { role: 'super_admin' }, signOut: mocks.signOut }),
}))

import MfaSetup from '../MfaSetup'

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={['/security/mfa']}>
      <Routes>
        <Route path="/security/mfa" element={<MfaSetup />} />
        <Route path="/admin" element={<div>Admin dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MfaSetup mobile recovery', () => {
  it('resumes an unfinished authenticator factor after the setup page is recreated', async () => {
    mocks.mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: 'pending-factor', factor_type: 'totp', status: 'unverified' }] },
      error: null,
    })
    mocks.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })

    renderSetup()

    expect(await screen.findByRole('status')).toHaveTextContent(/resumed your unfinished authenticator setup/i)
    fireEvent.change(screen.getByLabelText(/six-digit authenticator code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }))

    await waitFor(() => expect(mocks.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'pending-factor', code: '123456' }))
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })

  it('lets the user replace a recovered pending factor and display a fresh QR code', async () => {
    mocks.mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: 'pending-factor', factor_type: 'totp', status: 'unverified' }] },
      error: null,
    })
    mocks.mfa.unenroll.mockResolvedValue({ data: { id: 'pending-factor' }, error: null })
    mocks.mfa.enroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: 'data:image/png;base64,AA==', secret: 'new-secret' } },
      error: null,
    })

    renderSetup()
    fireEvent.click(await screen.findByRole('button', { name: /restart setup/i }))

    expect(await screen.findByAltText('Authenticator setup QR code')).toBeInTheDocument()
    expect(mocks.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'pending-factor' })
    expect(mocks.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'AbroBiz administrator' })
  })
})
