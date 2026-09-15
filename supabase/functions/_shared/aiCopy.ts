export const COPY_LANGUAGES = ['en', 'am', 'or'] as const
export const COPY_TONES = ['professional', 'premium', 'friendly', 'modern', 'minimal', 'persuasive'] as const
export const COPY_SECTIONS = ['all', 'hero', 'about', 'services', 'contact', 'location', 'seo'] as const

export type CopyLanguage = typeof COPY_LANGUAGES[number]
export type CopyTone = typeof COPY_TONES[number]
export type CopySection = typeof COPY_SECTIONS[number]

export type GeneratedCopy = {
  hero?: { headline: string; subheadline: string; primaryCta?: string; secondaryCta?: string }
  about?: { title: string; description: string; mission?: string; vision?: string; values?: string[] }
  services?: Array<{ sourceId: string; title: string; shortDescription: string; description?: string }>
  contact?: { intro: string }
  location?: { intro: string }
  seo?: { title: string; description: string }
}

const keySets: Record<string, string[]> = {
  hero: ['headline', 'subheadline', 'primaryCta', 'secondaryCta'],
  about: ['title', 'description', 'mission', 'vision', 'values'],
  service: ['sourceId', 'title', 'shortDescription', 'description'],
  contact: ['intro'],
  location: ['intro'],
  seo: ['title', 'description'],
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeText(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= max && !/[<>]/.test(value)
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key))
}

export function validateGeneratedCopy(value: unknown, sourceIds: Set<string>, section: CopySection = 'all'): value is GeneratedCopy {
  if (!isPlainObject(value)) return false
  if (!onlyKeys(value, ['hero', 'about', 'services', 'contact', 'location', 'seo'])) return false
  if (section === 'all' && !value.hero && !value.about && !value.services && !value.contact && !value.location && !value.seo) return false
  if (value.hero !== undefined) {
    if (!isPlainObject(value.hero) || !onlyKeys(value.hero, keySets.hero)) return false
    if (!safeText(value.hero.headline, 120) || !safeText(value.hero.subheadline, 240)) return false
    if (value.hero.primaryCta !== undefined && !safeText(value.hero.primaryCta, 48)) return false
    if (value.hero.secondaryCta !== undefined && !safeText(value.hero.secondaryCta, 48)) return false
  }
  if (value.about !== undefined) {
    if (!isPlainObject(value.about) || !onlyKeys(value.about, keySets.about)) return false
    if (!safeText(value.about.title, 100) || !safeText(value.about.description, 1200)) return false
    for (const key of ['mission', 'vision']) if (value.about[key] !== undefined && !safeText(value.about[key], 500)) return false
    if (value.about.values !== undefined && (!Array.isArray(value.about.values) || value.about.values.length > 6 || !value.about.values.every(item => safeText(item, 100)))) return false
  }
  if (value.services !== undefined) {
    if (!Array.isArray(value.services) || value.services.length > Math.min(sourceIds.size, 50)) return false
    for (const service of value.services) {
      if (!isPlainObject(service) || !onlyKeys(service, keySets.service)) return false
      if (typeof service.sourceId !== 'string' || !sourceIds.has(service.sourceId) || !safeText(service.title, 100) || !safeText(service.shortDescription, 180)) return false
      if (service.description !== undefined && !safeText(service.description, 600)) return false
    }
  }
  for (const key of ['contact', 'location']) {
    const entry = value[key]
    if (entry !== undefined && (!isPlainObject(entry) || !onlyKeys(entry, keySets[key]) || !safeText(entry.intro, 500))) return false
  }
  if (value.seo !== undefined) {
    if (!isPlainObject(value.seo) || !onlyKeys(value.seo, keySets.seo) || !safeText(value.seo.title, 70) || !safeText(value.seo.description, 160)) return false
  }
  return true
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}
