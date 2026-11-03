const SIGNUP_DRAFT_STORAGE_SLOT = 'abrobiz:signup-form-draft:v1'
const VERIFICATION_DRAFT_STORAGE_SLOT = 'abrobiz:signup-verification-draft:v1'
const SIGNUP_DRAFT_TTL_MS = 30 * 60 * 1000
const VERIFICATION_DRAFT_TTL_MS = 15 * 60 * 1000

export interface SignupFormDraft {
  name: string
  phone: string
  referralCode: string
  email: string
  legalAccepted: boolean
}

export interface SignupVerificationDraft {
  email: string
  code: string
  cooldownUntil: number
}

type StoredDraft<T> = T & { savedAt: number }

function readStored<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !('savedAt' in value)) {
      window.sessionStorage.removeItem(key)
      return null
    }
    const savedAt = Number((value as { savedAt: unknown }).savedAt)
    if (!Number.isFinite(savedAt) || savedAt > Date.now() || Date.now() - savedAt > ttlMs) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return value as T
  } catch {
    return null
  }
}

function writeStored<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ...value, savedAt: Date.now() }))
  } catch {
    // Storage can be unavailable in private browsing or when the device is low on space.
  }
}

export function loadSignupFormDraft(): SignupFormDraft | null {
  const value = readStored<Partial<StoredDraft<SignupFormDraft>>>(SIGNUP_DRAFT_STORAGE_SLOT, SIGNUP_DRAFT_TTL_MS)
  if (!value) return null
  return {
    name: typeof value.name === 'string' ? value.name.slice(0, 120) : '',
    phone: typeof value.phone === 'string' ? value.phone.slice(0, 40) : '',
    referralCode: typeof value.referralCode === 'string' ? value.referralCode.slice(0, 20) : '',
    email: typeof value.email === 'string' ? value.email.slice(0, 254) : '',
    legalAccepted: value.legalAccepted === true,
  }
}

export function saveSignupFormDraft(draft: SignupFormDraft): void {
  writeStored(SIGNUP_DRAFT_STORAGE_SLOT, draft)
}

export function clearSignupFormDraft(): void {
  try { window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_SLOT) } catch { /* Storage may be unavailable. */ }
}

export function loadSignupVerificationDraft(expectedEmail?: string): SignupVerificationDraft | null {
  const value = readStored<Partial<StoredDraft<SignupVerificationDraft>>>(VERIFICATION_DRAFT_STORAGE_SLOT, VERIFICATION_DRAFT_TTL_MS)
  if (!value || typeof value.email !== 'string') return null
  const email = value.email.slice(0, 254)
  if (expectedEmail?.trim() && email.toLowerCase() !== expectedEmail.trim().toLowerCase()) return null
  const code = typeof value.code === 'string' && /^\d{0,6}$/.test(value.code) ? value.code : ''
  const cooldownUntil = Number(value.cooldownUntil)
  return { email, code, cooldownUntil: Number.isFinite(cooldownUntil) ? cooldownUntil : 0 }
}

export function saveSignupVerificationDraft(draft: SignupVerificationDraft): void {
  const email = draft.email.trim().slice(0, 254)
  if (!email) return
  writeStored(VERIFICATION_DRAFT_STORAGE_SLOT, {
    email,
    code: draft.code.replace(/\D/g, '').slice(0, 6),
    cooldownUntil: Number.isFinite(draft.cooldownUntil) ? draft.cooldownUntil : 0,
  })
}

export function clearSignupVerificationDraft(): void {
  try { window.sessionStorage.removeItem(VERIFICATION_DRAFT_STORAGE_SLOT) } catch { /* Storage may be unavailable. */ }
}
