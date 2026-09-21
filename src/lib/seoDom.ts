import type { PlatformSeo, TenantSeo } from './seo'

type SeoDefinition = PlatformSeo | TenantSeo

function setMeta(attribute: 'name' | 'property', key: string, value: string, managed: Set<HTMLElement>) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = value
  element.dataset.abrobizSeo = 'true'
  managed.add(element)
}

function setCanonical(url: string, managed: Set<HTMLElement>) {
  const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')]
  const link = links[0] ?? document.createElement('link')
  link.rel = 'canonical'
  link.href = url
  link.dataset.abrobizSeo = 'true'
  if (!link.parentElement) document.head.appendChild(link)
  managed.add(link)
  links.slice(1).forEach(duplicate => duplicate.remove())
}

export function applySeoDefinition(definition: SeoDefinition): () => void {
  const managed = new Set<HTMLElement>()
  document.title = definition.title
  setMeta('name', 'description', definition.description, managed)
  setMeta('name', 'robots', definition.robots, managed)
  setMeta('property', 'og:title', definition.title, managed)
  setMeta('property', 'og:description', definition.description, managed)
  setMeta('property', 'og:url', definition.canonicalUrl, managed)
  setMeta('property', 'og:type', 'website', managed)
  setMeta('property', 'og:site_name', 'AbroBiz', managed)
  setMeta('name', 'twitter:card', 'summary_large_image', managed)
  setMeta('name', 'twitter:title', definition.title, managed)
  setMeta('name', 'twitter:description', definition.description, managed)
  if ('imageUrl' in definition && definition.imageUrl) {
    setMeta('property', 'og:image', definition.imageUrl, managed)
    setMeta('name', 'twitter:image', definition.imageUrl, managed)
  }
  setCanonical(definition.canonicalUrl, managed)

  const schemas = Array.isArray(definition.schema) ? definition.schema : definition.schema ? [definition.schema] : []
  document.head.querySelectorAll('[data-abrobiz-seo-schema="true"]').forEach(node => node.remove())
  schemas.forEach(schemaValue => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.abrobizSeoSchema = 'true'
    script.textContent = JSON.stringify(schemaValue)
    document.head.appendChild(script)
  })

  return () => {
    managed.forEach(element => {
      if (element.dataset.abrobizSeo === 'true') element.remove()
    })
    document.head.querySelectorAll('[data-abrobiz-seo-schema="true"]').forEach(node => node.remove())
  }
}
