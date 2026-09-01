/** Browser-side URL guards for values that originated outside the bundle.
 * These are defense-in-depth only; server validation and RLS remain the
 * authority for stored business data. */

export function safeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback
  try {
    const parsed = new URL(candidate, window.location.origin)
    if (parsed.origin !== window.location.origin) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const candidate = value.trim()
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) return candidate
  return safeHttpsUrl(candidate)
}

export function safeMailto(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const candidate = email.trim()
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) || /[\r\n]/.test(candidate)) return null
  return `mailto:${encodeURIComponent(candidate)}`
}

export function safeTel(phone: unknown): string | null {
  if (typeof phone !== 'string') return null
  const candidate = phone.trim()
  if (!candidate || !/^[+0-9()\- .]{3,40}$/.test(candidate)) return null
  return `tel:${encodeURIComponent(candidate)}`
}

export function safeTelegramUrl(handle: unknown): string | null {
  if (typeof handle !== 'string') return null
  const username = handle.trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) return null
  return `https://t.me/${username}`
}
