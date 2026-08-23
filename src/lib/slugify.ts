export const RESERVED_BUSINESS_SLUGS = new Set([
  'www', 'app', 'admin', 'api', 'mail', 'smtp', 'auth', 'dashboard',
  'login', 'register', 'setup', 'support', 'status', 'static', 'cdn',
])

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** A slug is the one DNS label used before `.abrobiz.com`. */
export function isValidBusinessSlug(slug: string): boolean {
  return slug.length >= 3
    && slug.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug)
    && !RESERVED_BUSINESS_SLUGS.has(slug)
}
