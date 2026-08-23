import { useEffect, useState } from 'react'
import { getBusinessBySlug, trackPageView, getBusinessEntitlements } from './api/businesses'
import { listCategories } from './api/categories'
import { listItems } from './api/items'
import { supabase } from './supabaseClient'
import type { Business, Category, Item, Language, TemplateConfig } from '../types'

export interface StorefrontLabels {
  label: string
  itemLabel: string
  categoryLabel: string
  icon: string
}

export interface StorefrontEntitlements {
  bookings: boolean
  ordering: boolean
  reviews: boolean
}

export interface StorefrontData {
  business: Business | null | undefined // undefined = still loading, null = not found
  categories: Category[]
  items: Item[]
  labels: StorefrontLabels
  lang: Language
  setLang: (l: Language) => void
  entitlements: StorefrontEntitlements
  templateConfig: TemplateConfig
}

const DEFAULT_LABELS: StorefrontLabels = { label: 'Business', itemLabel: 'Item', categoryLabel: 'Category', icon: 'Store' }
const DEFAULT_ENTITLEMENTS: StorefrontEntitlements = { bookings: false, ordering: false, reviews: false }

async function loadTemplateConfig(slug: string): Promise<{ data: { config: unknown } | null }> {
  try {
    return await supabase.from('templates').select('config').eq('slug', slug).eq('is_active', true).maybeSingle()
  } catch {
    // Keep existing storefronts working until migration 0017 is deployed.
    return { data: null }
  }
}

export function useStorefrontData(slug: string | undefined, pagePath: string): StorefrontData {
  const [business, setBusiness] = useState<Business | null | undefined>(undefined)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [labels, setLabels] = useState<StorefrontLabels>(DEFAULT_LABELS)
  const [lang, setLang] = useState<Language>('en')
  const [entitlements, setEntitlements] = useState<StorefrontEntitlements>(DEFAULT_ENTITLEMENTS)
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({})

  useEffect(() => {
    if (!slug) {
      setBusiness(null)
      return
    }
    const businessSlug = slug
    let cancelled = false

    async function load(trackView: boolean) {
      try {
        const biz = await getBusinessBySlug(businessSlug)
        if (cancelled) return
        setBusiness(biz)
        if (!biz) return
        setLang(previous => biz.languages.includes(previous) ? previous : (biz.languages[0] ?? 'en'))

        const [cats, its, ent, template] = await Promise.all([
          listCategories(biz.id),
          listItems(biz.id),
          getBusinessEntitlements(biz.id),
          loadTemplateConfig(biz.templateSlug),
        ])
        if (cancelled) return
        setCategories(cats.filter(c => !c.isHidden))
        setItems(its)
        setEntitlements(ent)
        setTemplateConfig((template.data?.config ?? {}) as TemplateConfig)
        setLabels(DEFAULT_LABELS)
        if (trackView) void trackPageView(biz.id, pagePath).catch(() => {})

        if (biz.categoryId) {
          const { data } = await supabase.from('business_categories').select('label, item_label, category_label, icon').eq('id', biz.categoryId).maybeSingle()
          if (data && !cancelled) {
            setLabels({ label: data.label, itemLabel: data.item_label, categoryLabel: data.category_label, icon: data.icon })
          }
        }
      } catch {
        // Keep the last successful storefront visible during a transient poll
        // failure. The next interval will retry automatically.
      }
    }

    void load(true)
    const refreshTimer = window.setInterval(() => { void load(false) }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [slug, pagePath])

  return { business, categories, items, labels, lang, setLang, entitlements, templateConfig }
}
