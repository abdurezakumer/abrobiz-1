import { describe, expect, it } from 'vitest'
import { hasAdminPermission } from '../api/adminControl'
import type { Profile } from '../../types'

function adminProfile(role: Profile['role'], adminRole: Profile['adminRole']): Profile {
  return { id: 'test-user', role, adminRole, platformId: 'U12345678', name: 'Test Admin', phone: '' }
}

describe('payment account administration permissions', () => {
  it('allows Finance admins to manage payment accounts', () => {
    expect(hasAdminPermission(adminProfile('admin', 'finance'), 'payment_methods.manage')).toBe(true)
  })

  it('keeps payment account management restricted from content and operations admins', () => {
    expect(hasAdminPermission(adminProfile('admin', 'content'), 'payment_methods.manage')).toBe(false)
    expect(hasAdminPermission(adminProfile('admin', 'operations'), 'payment_methods.manage')).toBe(false)
  })

  it('allows Super Admins to manage payment accounts', () => {
    expect(hasAdminPermission(adminProfile('super_admin', 'super_admin'), 'payment_methods.manage')).toBe(true)
  })
})
