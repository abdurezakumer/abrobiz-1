export type PasswordStrength = 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong'

export interface PasswordPolicyResult {
  valid: boolean
  message?: string
  strength: PasswordStrength
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'Very weak'

  const checks = [
    password.length >= 12,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length

  if (password.length < 8 || score <= 1) return 'Very weak'
  if (score === 2) return 'Weak'
  if (score === 3) return 'Fair'
  if (password.length >= 16 && score === 5) return 'Very strong'
  return 'Strong'
}

export function validatePassword(password: string): PasswordPolicyResult {
  const strength = passwordStrength(password)
  if (password.length < 12) return { valid: false, strength, message: 'Password must be at least 12 characters.' }
  if (password.length > 128) return { valid: false, strength, message: 'Password must be 128 characters or fewer.' }
  if (!/[a-z]/.test(password)) return { valid: false, strength, message: 'Password must include a lowercase letter.' }
  if (!/[A-Z]/.test(password)) return { valid: false, strength, message: 'Password must include an uppercase letter.' }
  if (!/\d/.test(password)) return { valid: false, strength, message: 'Password must include a number.' }
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, strength, message: 'Password must include a special character.' }
  return { valid: true, strength }
}
