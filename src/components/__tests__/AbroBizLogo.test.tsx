import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AbroBizLogo from '../AbroBizLogo'

describe('AbroBizLogo', () => {
  it('uses the supplied dark-background wordmark when light foreground is requested', () => {
    render(<AbroBizLogo size={30} light />)

    expect(screen.getByRole('img', { name: 'AbroBiz' })).toHaveAttribute('src', '/brand/abrobiz-logo-horizontal-dark.svg')
    expect(screen.getByRole('img', { name: 'AbroBiz' })).toHaveAttribute('width', String(30 * 4502.3 / 880))
  })

  it('uses the matching mark-only variant when the wordmark is hidden', () => {
    render(<AbroBizLogo size={16} showName={false} light />)

    expect(screen.getByRole('img', { name: 'AbroBiz mark' })).toHaveAttribute('src', '/brand/abrobiz-mark-dark.svg')
  })
})
