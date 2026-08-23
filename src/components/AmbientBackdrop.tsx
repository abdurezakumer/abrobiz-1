import { motion } from 'framer-motion'
import type { StorefrontTheme } from '../lib/storefrontTheme'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function AmbientBackdrop({ theme, accentColor }: { theme: StorefrontTheme; accentColor: string }) {
  if (theme.visualStyle === 'minimal' || theme.layout === 'restaurant-cafe') return null

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, opacity: 0.9 }}>
      {theme.visualStyle === 'aurora' && (
        <>
          <motion.div
            animate={prefersReducedMotion ? {} : { x: [0, 80, -20, 0], y: [0, -30, 50, 0], scale: [1, 1.18, 0.94, 1] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: '70vw', height: '70vw', maxWidth: 760, maxHeight: 760, top: '-28vw', left: '-12vw', borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}66 0%, #5FE7C022 34%, transparent 68%)`, filter: 'blur(18px)' }}
          />
          <motion.div
            animate={prefersReducedMotion ? {} : { x: [0, -60, 20, 0], y: [0, 40, -30, 0], scale: [1, 0.9, 1.12, 1] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: '60vw', height: '60vw', maxWidth: 640, maxHeight: 640, right: '-15vw', top: '28vh', borderRadius: '50%', background: `radial-gradient(circle, #6E8CFF44 0%, ${accentColor}22 38%, transparent 70%)`, filter: 'blur(30px)' }}
          />
        </>
      )}
      {theme.visualStyle === 'luxury' && (
        <>
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: [0, 8, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: 620, height: 620, top: -330, right: -180, borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}38 0%, transparent 67%)`, filter: 'blur(8px)' }}
          />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.16, backgroundImage: `linear-gradient(120deg, transparent 0 48%, ${accentColor}33 49%, transparent 50%), linear-gradient(35deg, transparent 0 70%, ${accentColor}22 71%, transparent 72%)`, backgroundSize: '460px 460px, 320px 320px' }} />
        </>
      )}
      {theme.visualStyle === 'heritage' && (
        <>
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: [0, -5, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: 700, height: 700, left: '-300px', top: '18vh', borderRadius: '50%', border: `1px solid ${accentColor}28`, boxShadow: `0 0 0 40px ${accentColor}0b, 0 0 0 80px ${accentColor}08` }}
          />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.16, backgroundImage: `radial-gradient(${accentColor}38 1px, transparent 1px)`, backgroundSize: '26px 26px', maskImage: 'linear-gradient(to bottom, black, transparent 70%)' }} />
        </>
      )}
      {theme.visualStyle === 'grid' && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: `linear-gradient(${accentColor} 1px, transparent 1px), linear-gradient(90deg, ${accentColor} 1px, transparent 1px)`, backgroundSize: '48px 48px', maskImage: 'linear-gradient(to bottom, black, transparent 75%)' }} />
      )}
    </div>
  )
}
