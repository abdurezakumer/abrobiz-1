import { useEffect, useState } from 'react'
import { getBusinessBySlug, trackPageView, getBusinessEntitlements } from './api/businesses'
import { listCategories } from './api/categories'
import { listItems } from './api/items'
import { supabase } from './supabaseClient'
import type { Business, Category, Item, Language, TemplateConfig } from '../types'
import { retryRead } from './retry'

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
  siteActive: boolean
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
const DEFAULT_ENTITLEMENTS: StorefrontEntitlements = { bookings: false, ordering: false, reviews: false, siteActive: false }
const PUBLIC_CONFIG_TTL = 5 * 60 * 1000
const templateCache = new Map<string, { config: unknown; expiresAt: number }>()
const categoryCache = new Map<string, { labels: StorefrontLabels; expiresAt: number }>()

async function loadTemplateConfig(slug: string): Promise<{ data: { config: unknown } | null }> {
  const cached = templateCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) return { data: { config: cached.config } }
  try {
    const response = await retryRead(async () => {
      const result = await supabase.from('templates').select('config').eq('slug', slug).eq('is_active', true).maybeSingle()
      if (result.error) throw result.error
      return result
    })
    if (response.data) templateCache.set(slug, { config: response.data.config, expiresAt: Date.now() + PUBLIC_CONFIG_TTL })
    return response
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
    let inFlight = false
    let refreshTimer: number | undefined

    function scheduleNextRefresh() {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      if (!document.hidden) refreshTimer = window.setTimeout(() => { void load(false) }, 30_000)
    }

    async function load(trackView: boolean) {
      if (inFlight) return
      inFlight = true
      try {
        const biz = await retryRead(() => getBusinessBySlug(businessSlug))
        if (cancelled) return
        if (!biz) {
          setBusiness(null)
          return
        }

        // Resolve subscription access before loading any catalog data. This
        // keeps an expired storefront from rendering stale menu/order data and
        // gives the owner a clear renewal message instead of a blank page.
        const ent = await retryRead(() => getBusinessEntitlements(biz.id))
        if (cancelled) return
        setBusiness(biz)
        setEntitlements(ent)
        setLang(previous => biz.languages.includes(previous) ? previous : (biz.languages[0] ?? 'en'))

        if (!ent.siteActive) {
          setCategories([])
          setItems([])
          return
        }

        const [cats, its, template] = await retryRead(() => Promise.all([
          listCategories(biz.id),
          listItems(biz.id),
          loadTemplateConfig(biz.templateSlug),
        ]))
        if (cancelled) return
        setCategories(cats.filter(c => !c.isHidden))
        setItems(its)
        setTemplateConfig((template.data?.config ?? {}) as TemplateConfig)
        setLabels(DEFAULT_LABELS)
        if (trackView) void trackPageView(biz.id, pagePath).catch(() => {})

        if (biz.categoryId) {
          const cachedCategory = categoryCache.get(biz.categoryId)
          if (cachedCategory && cachedCategory.expiresAt > Date.now()) {
            setLabels(cachedCategory.labels)
          } else {
            const { data } = await retryRead(async () => {
              const result = await supabase.from('business_categories').select('label, item_label, category_label, icon').eq('id', biz.categoryId!).maybeSingle()
              if (result.error) throw result.error
              return result
            }).catch(() => ({ data: null }))
            if (data && !cancelled) {
              const nextLabels = { label: data.label, itemLabel: data.item_label, categoryLabel: data.category_label, icon: data.icon }
              categoryCache.set(biz.categoryId, { labels: nextLabels, expiresAt: Date.now() + PUBLIC_CONFIG_TTL })
              setLabels(nextLabels)
            }
          }
        }
      } catch {
        // Keep the last successful storefront visible during a transient poll
        // failure. The next interval will retry automatically.
      } finally {
        inFlight = false
        scheduleNextRefresh()
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      } else {
        void load(false)
      }
    }

    void load(true)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [slug, pagePath])

  return { business, categories, items, labels, lang, setLang, entitlements, templateConfig }
}
