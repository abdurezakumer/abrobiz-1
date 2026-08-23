import type { StorefrontVisualStyle, TemplateConfig, TemplateSlug, WeeklyHours } from '../types'

export interface StorefrontTheme {
  bg: string
  card: string
  text: string
  textDim: string
  border: string
  heroBg: string
  visualStyle: StorefrontVisualStyle
  layout: 'standard' | 'restaurant-cafe'
  headingFont: string
}

export const THEMES: Record<TemplateSlug, StorefrontTheme> = {
  'modern-dark': { bg: '#111318', card: '#191C22', text: '#F5F3EF', textDim: 'rgba(245,243,239,0.55)', border: 'rgba(255,255,255,0.08)', heroBg: '#0A0C10', visualStyle: 'grid', layout: 'standard', headingFont: 'Outfit, sans-serif' },
  'clean-minimal': { bg: '#FBFAF8', card: '#FFFFFF', text: '#161616', textDim: 'rgba(22,22,22,0.55)', border: 'rgba(22,22,22,0.08)', heroBg: '#F6F3EE', visualStyle: 'minimal', layout: 'standard', headingFont: 'Outfit, sans-serif' },
  'traditional-warm': { bg: '#3E2A1C', card: '#4A3323', text: '#F5EDE0', textDim: 'rgba(245,237,224,0.6)', border: 'rgba(245,237,224,0.12)', heroBg: '#2E1F15', visualStyle: 'warm', layout: 'standard', headingFont: 'Outfit, sans-serif' },
  'aurora-glass': { bg: '#07131A', card: 'rgba(18,44,54,0.72)', text: '#E9FBF7', textDim: 'rgba(233,251,247,0.62)', border: 'rgba(164,255,231,0.16)', heroBg: '#041016', visualStyle: 'aurora', layout: 'standard', headingFont: 'Outfit, sans-serif' },
  'luxury-editorial': { bg: '#110F0D', card: '#1D1814', text: '#F7E9D3', textDim: 'rgba(247,233,211,0.62)', border: 'rgba(215,174,104,0.2)', heroBg: '#0A0908', visualStyle: 'luxury', layout: 'standard', headingFont: 'Georgia, serif' },
  'heritage-boutique': { bg: '#2A1B16', card: '#3A251D', text: '#F7EBDD', textDim: 'rgba(247,235,221,0.64)', border: 'rgba(247,206,151,0.18)', heroBg: '#1C110D', visualStyle: 'heritage', layout: 'standard', headingFont: 'Georgia, serif' },
  'restaurant-cafe': { bg: '#FAF8F3', card: '#FFFDF9', text: '#2C1A0E', textDim: 'rgba(44,26,14,0.62)', border: '#EAD9C8', heroBg: '#1A0E07', visualStyle: 'heritage', layout: 'restaurant-cafe', headingFont: "'Playfair Display', Georgia, serif" },
}

export function themeFor(slug: TemplateSlug, config?: TemplateConfig): StorefrontTheme {
  const base = THEMES[slug] ?? THEMES['clean-minimal']
  return {
    ...base,
    ...(config ?? {}),
    visualStyle: config?.visualStyle ?? base.visualStyle,
    layout: config?.layout ?? base.layout,
    headingFont: config?.headingFont ?? base.headingFont,
  }
}

export function currentWeekday(timezone = 'Africa/Addis_Ababa'): keyof WeeklyHours {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(new Date()).toLowerCase()
  const days: Record<string, keyof WeeklyHours> = { sun: 'sun', mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat' }
  return days[weekday.slice(0, 3)] ?? 'mon'
}

export function isOpenNow(hours: WeeklyHours, timezone = 'Africa/Addis_Ababa'): boolean {
  const today = hours[currentWeekday(timezone)]
  if (!today || today.closed) return false
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const nowHours = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const nowMinutes = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  const [oh, om] = today.open.split(':').map(Number)
  const [ch, cm] = today.close.split(':').map(Number)
  const currentMinutes = nowHours * 60 + nowMinutes
  return currentMinutes >= oh * 60 + om && currentMinutes <= ch * 60 + cm
}
