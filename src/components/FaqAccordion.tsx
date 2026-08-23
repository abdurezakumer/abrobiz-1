import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export interface FaqItem {
  question: string
  answer: string
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => {
        const open = openIndex === i
        return (
          <div key={item.question} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                background: 'none', border: 'none', cursor: 'pointer', padding: '16px 18px', textAlign: 'left',
                fontSize: 14.5, fontWeight: 600, color: '#F0EDE7', fontFamily: 'inherit',
              }}
            >
              {item.question}
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0, display: 'flex' }}>
                <ChevronDown size={17} color="#D4A853" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ padding: '0 18px 16px', fontSize: 13.5, color: 'rgba(240,237,231,0.55)', lineHeight: 1.6 }}>{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
