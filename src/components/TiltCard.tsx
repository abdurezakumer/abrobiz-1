import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const MAX_TILT_DEG = 7

export default function TiltCard({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const springConfig = { stiffness: 200, damping: 20 }
  const sx = useSpring(px, springConfig)
  const sy = useSpring(py, springConfig)
  const rotateX = useTransform(sy, [0, 1], [MAX_TILT_DEG, -MAX_TILT_DEG])
  const rotateY = useTransform(sx, [0, 1], [-MAX_TILT_DEG, MAX_TILT_DEG])

  if (prefersReducedMotion) {
    return <div style={style}>{children}</div>
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }

  function reset() {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      style={{ ...style, rotateX, rotateY, transformPerspective: 600 }}
    >
      {children}
    </motion.div>
  )
}
