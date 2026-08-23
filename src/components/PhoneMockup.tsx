import { AnimatePresence, motion } from 'framer-motion'
import { UtensilsCrossed, Coffee, Scissors, ShoppingBag } from 'lucide-react'

interface Preview {
  name: string
  icon: typeof UtensilsCrossed
  bg: string
  card: string
  text: string
  accent: string
  cta: string
}

const PREVIEWS: Preview[] = [
  { name: 'Your Restaurant', icon: UtensilsCrossed, bg: '#111318', card: '#1B1E25', text: '#F5F3EF', accent: '#D4A853', cta: 'View Menu' },
  { name: 'Your Café', icon: Coffee, bg: '#3E2A1C', card: '#4A3323', text: '#F5EDE0', accent: '#E8B04B', cta: 'View Menu' },
  { name: 'Your Salon', icon: Scissors, bg: '#FBFAF8', card: '#FFFFFF', text: '#161616', accent: '#C77D4E', cta: 'View Services' },
  { name: 'Your Shop', icon: ShoppingBag, bg: '#14171C', card: '#1E222A', text: '#F5F3EF', accent: '#6FCF97', cta: 'Shop Products' },
]

export default function PhoneMockup({ activeIndex }: { activeIndex: number }) {
  const preview = PREVIEWS[activeIndex % PREVIEWS.length]
  const Icon = preview.icon

  return (
    <div
      style={{
        width: 240, borderRadius: 34, padding: 10, background: '#0A0C10',
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ borderRadius: 24, overflow: 'hidden', height: 440, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, background: preview.bg }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 14px 10px' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: preview.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={12} color="#0A0C10" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: preview.text, fontFamily: 'Outfit, sans-serif' }}>{preview.name}</span>
            </div>

            {/* Hero block */}
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: preview.accent, margin: '0 auto 10px' }} />
              <div style={{ height: 8, width: '60%', background: preview.text, opacity: 0.9, borderRadius: 4, margin: '0 auto 6px' }} />
              <div style={{ height: 6, width: '40%', background: preview.text, opacity: 0.4, borderRadius: 4, margin: '0 auto 14px' }} />
              <div style={{ display: 'inline-block', background: preview.accent, color: preview.bg === '#FBFAF8' ? '#fff' : '#0A0C10', fontSize: 9.5, fontWeight: 700, padding: '6px 14px', borderRadius: 8 }}>
                {preview.cta}
              </div>
            </div>

            {/* Item rows */}
            <div style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: preview.card, borderRadius: 10, padding: 8 }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: preview.accent, opacity: 0.25, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, width: '70%', background: preview.text, opacity: 0.8, borderRadius: 3, marginBottom: 5 }} />
                    <div style={{ height: 5, width: '40%', background: preview.text, opacity: 0.35, borderRadius: 3 }} />
                  </div>
                  <div style={{ height: 7, width: 24, background: preview.accent, borderRadius: 3 }} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
