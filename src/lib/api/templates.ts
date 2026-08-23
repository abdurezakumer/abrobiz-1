import { supabase } from '../supabaseClient'
import type { Template } from '../../types'

function mapTemplate(row: any): Template {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    repoUrl: row.repo_url ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    config: row.config ?? {},
    isBuiltin: !!row.is_builtin,
    isActive: !!row.is_active,
    sortOrder: row.sort_order ?? 100,
    createdAt: row.created_at,
  }
}

export async function listActiveTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapTemplate)
}

/** Keeps the owner UI usable while a newly-added template migration is being deployed. */
export function mergeTemplateOptions(remote: Template[], fallback: Template[]): Template[] {
  const bySlug = new Map(fallback.map(template => [template.slug, template]))
  remote.forEach(template => bySlug.set(template.slug, template))
  return [...bySlug.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function adminListTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapTemplate)
}

export async function importTemplate(repoUrl: string): Promise<Template> {
  const { data, error } = await supabase.functions.invoke('import-template', { body: { repoUrl } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return mapTemplate(data.template)
}

export async function setTemplateActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('templates').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
