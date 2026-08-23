import { UtensilsCrossed, Coffee, Scissors, ShoppingBag, BedDouble, Store } from 'lucide-react'

const ITEMS = [
  { icon: UtensilsCrossed, label: 'Restaurants' },
  { icon: Coffee, label: 'Cafés & Bakeries' },
  { icon: Scissors, label: 'Salons & Beauty' },
  { icon: ShoppingBag, label: 'Retail Shops' },
  { icon: BedDouble, label: 'Hotels' },
  { icon: Store, label: 'And more' },
]

export default function CategoryMarquee() {
  const track = [...ITEMS, ...ITEMS] // duplicated for a seamless loop

  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 0' }}>
      <div className="marquee-track" style={{ display: 'flex', width: 'max-content', gap: 40 }}>
        {track.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <item.icon size={16} color="#D4A853" />
            <span style={{ fontSize: 13.5, color: 'rgba(240,237,231,0.5)', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <style>{`
        .marquee-track { animation: marquee-scroll 22s linear infinite; }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }
      `}</style>
    </div>
  )
}
