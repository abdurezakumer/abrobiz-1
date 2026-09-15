import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TemplateFeatured, TemplateHero } from '../TemplateShowcase'
import { TEMPLATE_REGISTRY } from '../../lib/templateRegistry'
import { themeFor } from '../../lib/storefrontTheme'
import type { Business, Item } from '../../types'

const hours = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '09:00', close: '16:00', closed: false },
  sun: { open: '09:00', close: '14:00', closed: true },
}

const labels = { label: 'Business', itemLabel: 'Service', categoryLabel: 'Category', icon: 'utensils' } as const

function business(slug: string, complete: boolean): Business {
  return {
    id: `business-${slug}`,
    ownerId: 'owner-1',
    categoryId: null,
    name: 'Harbor & Hill Studio',
    slug: `harbor-${slug}`,
    description: complete ? 'A considered local business with thoughtful service.' : '',
    aboutContent: complete ? 'Our team creates welcoming experiences for every guest.' : '',
    galleryUrls: complete ? ['https://images.example.test/gallery.webp'] : [],
    logoUrl: complete ? 'https://images.example.test/logo.webp' : undefined,
    coverUrl: complete ? 'https://images.example.test/cover.webp' : undefined,
    phone: complete ? '+251 900 000 000' : '',
    email: complete ? 'hello@example.test' : '',
    address: complete ? 'Bole, Addis Ababa' : '',
    mapsUrl: '',
    templateSlug: slug,
    languages: ['en'],
    accentColor: '#D4A853',
    openingHours: hours,
    social: {},
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
    isPublished: true,
    isBlocked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const item: Item = {
  id: 'item-1',
  businessId: 'business-complete',
  categoryId: 'category-1',
  imageUrl: 'https://images.example.test/item.webp',
  price: 450,
  isAvailable: true,
  isFeatured: true,
  sortOrder: 1,
  translations: { en: { name: 'Signature Session', description: 'A complete experience.' } },
}

describe('storefront template rendering', () => {
  it('contains the complete production catalog', () => {
    expect(TEMPLATE_REGISTRY).toHaveLength(37)
    expect(new Set(TEMPLATE_REGISTRY.map(template => template.slug)).size).toBe(37)
  })

  it.each(TEMPLATE_REGISTRY)('$name renders with complete business data', definition => {
    const completeBusiness = business(definition.slug, true)
    const view = render(
      <>
        <TemplateHero business={completeBusiness} theme={themeFor(definition.slug, definition.config)} labels={labels} lang="en" open todayHours={hours.mon} />
        <TemplateFeatured items={[item]} business={completeBusiness} theme={themeFor(definition.slug, definition.config)} lang="en" />
      </>,
    )
    expect(view.getByRole('heading', { name: /Harbor & Hill Studio/ })).toBeInTheDocument()
    expect(view.getByText('Signature Session')).toBeInTheDocument()
    view.unmount()
  })

  it.each(TEMPLATE_REGISTRY)('$name renders with minimal business data', definition => {
    const minimalBusiness = business(definition.slug, false)
    const view = render(<TemplateHero business={minimalBusiness} theme={themeFor(definition.slug, definition.config)} labels={labels} lang="en" open todayHours={hours.mon} />)
    expect(view.getByRole('heading', { name: /Harbor & Hill Studio/ })).toBeInTheDocument()
    view.unmount()
  })
})
