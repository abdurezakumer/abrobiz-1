import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Coffee, Heart, Scissors, ShoppingBag, Star, UtensilsCrossed } from 'lucide-react'
import AbroBizLogo from './AbroBizLogo'

interface Preview {
  name: string
  category: string
  icon: typeof UtensilsCrossed
  bg: string
  card: string
  text: string
  muted: string
  accent: string
  cta: string
  hero: string
  items: [string, string, string][]
}

const PREVIEWS: Preview[] = [
  {
    name: 'Addis Table', category: 'Restaurant · Addis Ababa', icon: UtensilsCrossed, bg: '#17100C', card: '#261A13', text: '#FFF8EC', muted: '#D9C6B0', accent: '#E8943A', cta: 'View menu',
    hero: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=700&h=470&fit=crop&auto=format',
    items: [['Doro wat', 'Berbere · injera', '320 ETB'], ['Beyaynetu', 'Seven-way platter', '220 ETB'], ['Yirgacheffe', 'Freshly brewed', '60 ETB']],
  },
  {
    name: 'Kaffa House', category: 'Coffee · Bole', icon: Coffee, bg: '#20150F', card: '#302015', text: '#FFF5E8', muted: '#D8BDA0', accent: '#E8B04B', cta: 'Order coffee',
    hero: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=700&h=470&fit=crop&auto=format',
    items: [['Flat white', 'Velvety · double shot', '95 ETB'], ['Cold brew', 'Slow-steeped · bright', '120 ETB'], ['Coffee cake', 'Warm · house baked', '85 ETB']],
  },
  {
    name: 'Naya Studio', category: 'Beauty · Kazanchis', icon: Scissors, bg: '#F3EEE9', card: '#FFFFFF', text: '#29201D', muted: '#756762', accent: '#B9795E', cta: 'Book a visit',
    hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&h=470&fit=crop&auto=format',
    items: [['Signature cut', 'Consultation included', '450 ETB'], ['Glow facial', '60 minute ritual', '700 ETB'], ['Nail studio', 'Classic manicure', '300 ETB']],
  },
  {
    name: 'Moya Market', category: 'Shop · Addis Ababa', icon: ShoppingBag, bg: '#101A18', card: '#1A2825', text: '#F1FFF9', muted: '#B6CEC3', accent: '#6FCF97', cta: 'Shop collection',
    hero: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&h=470&fit=crop&auto=format',
    items: [['Linen tote', 'Handmade · natural', '380 ETB'], ['Ceramic set', 'Three-piece set', '620 ETB'], ['Aster candle', 'Local soy wax', '240 ETB']],
  },
]

export default function PhoneMockup({ activeIndex }: { activeIndex: number }) {
  const preview = PREVIEWS[activeIndex % PREVIEWS.length]
  const Icon = preview.icon

  return (
    <div style={{ position: 'relative', width: 270, padding: 9, borderRadius: 40, background: 'linear-gradient(145deg, #3A3E48, #0B0D11 34%, #242832)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 35px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.04)' }}>
      <div style={{ position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)', width: 76, height: 19, borderRadius: 20, background: '#07080A', zIndex: 4 }} />
      <div style={{ borderRadius: 31, overflow: 'hidden', height: 505, position: 'relative', background: preview.bg }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, background: preview.bg, color: preview.text }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '29px 16px 9px', fontSize: 9.5, color: preview.muted }}>
              <span>9:41</span><span style={{ letterSpacing: 2 }}>•••</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 16px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 27, height: 27, borderRadius: 9, background: preview.accent, display: 'grid', placeItems: 'center' }}><Icon size={14} color={preview.bg === '#F3EEE9' ? '#fff' : '#21130C'} /></div>
                <div><div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '-.02em' }}>{preview.name}</div><div style={{ color: preview.muted, fontSize: 8.5, marginTop: 2 }}>{preview.category}</div></div>
              </div>
              <Heart size={15} color={preview.muted} />
            </div>

            <div style={{ margin: '0 12px', height: 154, borderRadius: 17, overflow: 'hidden', position: 'relative', background: `url("${preview.hero}") center/cover` }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,.72))' }} />
              <div style={{ position: 'absolute', left: 13, right: 13, bottom: 12 }}>
                <div style={{ fontSize: 8.5, color: '#fff', opacity: .82, textTransform: 'uppercase', letterSpacing: 1 }}>Welcome to</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 21, color: '#fff', marginTop: 3 }}>{preview.name}</div>
              </div>
            </div>

            <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>Made for your day</div><div style={{ marginTop: 3, fontSize: 9, color: preview.muted }}>Explore our most-loved picks</div></div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: preview.accent, fontSize: 9, fontWeight: 700 }}>{preview.cta} <ArrowUpRight size={12} /></div>
            </div>

            <div style={{ padding: '11px 12px 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {preview.items.map(([name, detail, price], i) => (
                <motion.div key={name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 8, borderRadius: 12, background: preview.card }}>
                  <div style={{ width: 38, height: 35, borderRadius: 8, flexShrink: 0, background: `url("${preview.hero}") center/${125 + i * 18}%`, opacity: .88 }} />
                  <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 10, fontWeight: 650 }}>{name}</div><div style={{ fontSize: 8, color: preview.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div></div>
                  <span style={{ fontSize: 8.5, color: preview.accent, fontWeight: 700, whiteSpace: 'nowrap' }}>{price}</span>
                </motion.div>
              ))}
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '12px 8px 14px', background: `${preview.bg}ee`, borderTop: `1px solid ${preview.muted}22`, color: preview.muted, fontSize: 8 }}>
              <span style={{ color: preview.accent, fontWeight: 700 }}>Home</span><span>Menu</span><span>About</span><span>Contact</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 11, color: 'rgba(240,237,231,.48)', fontSize: 10 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: '#6FCF97', boxShadow: '0 0 10px #6FCF97' }} /> Live storefront preview · <AbroBizLogo size={15} showName={false} light /></div>
    </div>
  )
}
