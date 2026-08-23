import { useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion'
import type { StorefrontVisualStyle, TemplateSlug } from '../types'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function SpotlightHero({
  templateSlug, visualStyle, accentColor, children, minHeight = 320, coverUrl, heroBg,
}: {
  templateSlug: TemplateSlug
  visualStyle?: StorefrontVisualStyle
  accentColor: string
  children: ReactNode
  minHeight?: number
  coverUrl?: string
  heroBg?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  const mx = useMotionValue(50)
  const my = useMotionValue(30)
  const springX = useSpring(mx, { stiffness: 80, damping: 20 })
  const springY = useSpring(my, { stiffness: 80, damping: 20 })
  const glowBackground = useMotionTemplate`radial-gradient(500px circle at ${springX}% ${springY}%, ${accentColor}22, transparent 70%)`

  function handleMouseMove(e: React.MouseEvent) {
    if (prefersReducedMotion) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set(((e.clientX - rect.left) / rect.width) * 100)
    my.set(((e.clientY - rect.top) / rect.height) * 100)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'relative', overflow: 'hidden', minHeight,
        ...(coverUrl && { background: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${coverUrl}) center/cover` }),
        ...(!coverUrl && heroBg && { background: heroBg }),
      }}
    >
      {!coverUrl && <Backdrop templateSlug={templateSlug} visualStyle={visualStyle} accentColor={accentColor} />}

      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            opacity: hovering ? 1 : 0.55, transition: 'opacity 0.4s',
            background: glowBackground,
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

function Backdrop({ templateSlug, visualStyle, accentColor }: { templateSlug: TemplateSlug; visualStyle?: StorefrontVisualStyle; accentColor: string }) {
  if (visualStyle === 'aurora') {
    return (
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, background: `radial-gradient(ellipse at 50% 0%, ${accentColor}40, transparent 60%)` }}>
        <motion.div animate={prefersReducedMotion ? {} : { x: [0, 80, -30, 0], y: [0, 35, -20, 0], rotate: [0, 8, -5, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', width: '72%', height: 260, top: -120, left: '14%', borderRadius: '50%', background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}66, #8DE7FF44, ${accentColor}00)`, filter: 'blur(28px)' }} />
        <motion.div animate={prefersReducedMotion ? {} : { x: [0, -40, 50, 0], scale: [1, 1.12, 0.95, 1] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', width: '52%', height: 220, right: -100, bottom: -80, borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}44, transparent 70%)`, filter: 'blur(24px)' }} />
      </div>
    )
  }

  if (visualStyle === 'luxury') {
    return <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, background: `radial-gradient(ellipse at 50% -20%, ${accentColor}38, transparent 62%), linear-gradient(135deg, transparent 0 48%, ${accentColor}0d 49%, transparent 50%)`, backgroundSize: 'auto, 34px 34px' }} />
  }

  if (visualStyle === 'heritage') {
    return <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, background: `radial-gradient(circle at 50% 0%, ${accentColor}44, transparent 58%), repeating-radial-gradient(circle at 50% 120%, transparent 0 24px, ${accentColor}0c 25px 26px)` }} />
  }

  if (templateSlug === 'modern-dark') {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `linear-gradient(${accentColor}14 1px, transparent 1px), linear-gradient(90deg, ${accentColor}14 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
        }}
      />
    )
  }

  if (templateSlug === 'traditional-warm') {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${accentColor}33, transparent 65%)`,
        }}
      />
    )
  }

  // clean-minimal: soft, slow-drifting color blobs — subtle, not a "purple AI blob" cliché since
  // it uses the business's own accent color and stays very low-opacity.
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <motion.div
        animate={prefersReducedMotion ? {} : { x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-5%', width: 260, height: 260, borderRadius: '50%', background: accentColor, opacity: 0.08, filter: 'blur(60px)' }}
      />
      <motion.div
        animate={prefersReducedMotion ? {} : { x: [0, -20, 0], y: [0, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-15%', right: '0%', width: 220, height: 220, borderRadius: '50%', background: accentColor, opacity: 0.07, filter: 'blur(60px)' }}
      />
    </div>
  )
}
