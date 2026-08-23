import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/** Wrap any single element (a Link, a button) to give it a subtle magnetic pull toward the cursor. */
export default function MagneticButton({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 15 })
  const springY = useSpring(y, { stiffness: 200, damping: 15 })

  function handleMouseMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3)
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3)
  }

  function reset() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={reset} style={{ x: springX, y: springY, display: 'inline-block' }} whileTap={{ scale: 0.96 }}>
      {children}
    </motion.div>
  )
}
