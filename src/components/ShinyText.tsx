import { motion } from 'framer-motion'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Lightweight, source-owned version of the React Bits Shiny Text pattern. */
export default function ShinyText({ text, color, accent }: { text: string; color: string; accent: string }) {
  return (
    <motion.span
      aria-label={text}
      animate={prefersReducedMotion ? {} : { backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
      style={{
        display: 'inline-block', color: 'transparent', backgroundImage: `linear-gradient(110deg, ${color} 20%, ${color} 38%, ${accent} 50%, ${color} 62%, ${color} 80%)`,
        backgroundSize: '220% 100%', backgroundClip: 'text', WebkitBackgroundClip: 'text', fontSize: 11, fontWeight: 700,
        letterSpacing: 2.2, textTransform: 'uppercase',
      }}
    >
      {text}
    </motion.span>
  )
}
