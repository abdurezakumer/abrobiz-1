export function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== 'string') return { valid: false, error: 'Password is required.' }
  if (password.length < 12) return { valid: false, error: 'Password must be at least 12 characters.' }
  if (password.length > 128) return { valid: false, error: 'Password must be 128 characters or fewer.' }
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must include a lowercase letter.' }
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must include an uppercase letter.' }
  if (!/\d/.test(password)) return { valid: false, error: 'Password must include a number.' }
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must include a special character.' }
  return { valid: true }
}
