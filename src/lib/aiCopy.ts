import { supabase } from './supabaseClient'
import { edgeFunctionError } from './errors'
import type { Language } from '../types'

export const COPY_TONES = ['professional', 'premium', 'friendly', 'modern', 'minimal', 'persuasive'] as const
export const COPY_SECTIONS = ['all', 'hero', 'about', 'services', 'contact', 'location', 'seo'] as const
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

export interface AICopyGeneration {
  id: string
  businessId: string
  language: Language
  tone: CopyTone
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED'
  content: GeneratedCopy
  sourceHash: string
  generationVersion: string
  createdAt: string
  updatedAt: string
}

const keys: Record<string, string[]> = {
  hero: ['headline', 'subheadline', 'primaryCta', 'secondaryCta'],
  about: ['title', 'description', 'mission', 'vision', 'values'],
  service: ['sourceId', 'title', 'shortDescription', 'description'],
  contact: ['intro'],
  location: ['intro'],
  seo: ['title', 'description'],
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= max && !/[<>]/.test(value)
}

function allowed(value: Record<string, unknown>, values: string[]): boolean {
  return Object.keys(value).every(key => values.includes(key))
}

/** Defense-in-depth for data read from the database or an Edge Function. */
export function isSafeGeneratedCopy(value: unknown, sourceIds: Set<string> = new Set()): value is GeneratedCopy {
  if (!record(value) || !allowed(value, ['hero', 'about', 'services', 'contact', 'location', 'seo'])) return false
  if (value.hero !== undefined) {
    if (!record(value.hero) || !allowed(value.hero, keys.hero) || !text(value.hero.headline, 120) || !text(value.hero.subheadline, 240)) return false
    if (value.hero.primaryCta !== undefined && !text(value.hero.primaryCta, 48)) return false
    if (value.hero.secondaryCta !== undefined && !text(value.hero.secondaryCta, 48)) return false
  }
  if (value.about !== undefined) {
    if (!record(value.about) || !allowed(value.about, keys.about) || !text(value.about.title, 100) || !text(value.about.description, 1200)) return false
    for (const key of ['mission', 'vision']) if (value.about[key] !== undefined && !text(value.about[key], 500)) return false
    if (value.about.values !== undefined && (!Array.isArray(value.about.values) || value.about.values.length > 6 || !value.about.values.every(item => text(item, 100)))) return false
  }
  if (value.services !== undefined) {
    if (!Array.isArray(value.services) || value.services.length > Math.min(sourceIds.size, 50)) return false
    for (const item of value.services) {
      if (!record(item) || !allowed(item, keys.service) || typeof item.sourceId !== 'string' || !sourceIds.has(item.sourceId) || !text(item.title, 100) || !text(item.shortDescription, 180)) return false
      if (item.description !== undefined && !text(item.description, 600)) return false
    }
  }
  for (const key of ['contact', 'location']) {
    const item = value[key]
    if (item !== undefined && (!record(item) || !allowed(item, keys[key]) || !text(item.intro, 500))) return false
  }
  if (value.seo !== undefined && (!record(value.seo) || !allowed(value.seo, keys.seo) || !text(value.seo.title, 70) || !text(value.seo.description, 160))) return false
  return true
}

function mapGeneration(row: any): AICopyGeneration | null {
  const sourceIds = new Set<string>(Array.isArray(row.content?.services) ? row.content.services.map((item: any) => item?.sourceId).filter((id: unknown): id is string => typeof id === 'string') : [])
  if (!isSafeGeneratedCopy(row.content, sourceIds)) return null
  return { id: row.id, businessId: row.business_id, language: row.language, tone: row.tone, status: row.status, content: row.content, sourceHash: row.source_hash, generationVersion: row.generation_version, createdAt: row.created_at, updatedAt: row.updated_at }
}

async function invoke(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('generate-website-copy', { body })
  if (error) throw await edgeFunctionError(error)
  if (data?.error) throw new Error(data.error)
  return data
}

export async function generateWebsiteCopy(input: { businessId: string; language: Language; tone: CopyTone; section: CopySection }): Promise<AICopyGeneration> {
  const data = await invoke({ action: 'generate', ...input })
  const generation = mapGeneration(data?.generation)
  if (!generation) throw new Error('The AI returned an unsafe copy format.')
  return generation
}

export async function approveWebsiteCopy(generationId: string): Promise<AICopyGeneration> {
  const data = await invoke({ action: 'approve', generationId })
  const generation = mapGeneration(data?.generation)
  if (!generation) throw new Error('The approved copy could not be read safely.')
  return generation
}

export async function getApprovedWebsiteCopies(businessId: string, sourceIds: Set<string>): Promise<Partial<Record<Language, GeneratedCopy>>> {
  const { data, error } = await supabase
    .from('ai_website_copy_generations')
    .select('language, content, updated_at')
    .eq('business_id', businessId)
    .eq('status', 'APPROVED')
    .order('updated_at', { ascending: false })
    .limit(6)
  if (error) {
    // Older deployments can render normally until migration 0048 is applied.
    if (/relation .*ai_website_copy_generations.*does not exist/i.test(error.message)) return {}
    throw error
  }
  const result: Partial<Record<Language, GeneratedCopy>> = {}
  for (const row of data ?? []) {
    const language = row.language as Language
    if ((language === 'en' || language === 'am' || language === 'or') && !result[language] && isSafeGeneratedCopy(row.content, sourceIds)) result[language] = row.content
  }
  return result
}
