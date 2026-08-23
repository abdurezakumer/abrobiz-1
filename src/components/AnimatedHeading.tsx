import { motion } from 'framer-motion'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function AnimatedHeading({ text, style }: { text: string; style?: React.CSSProperties }) {
  if (prefersReducedMotion) {
    return <h1 style={style}>{text}</h1>
  }

  const words = text.split(' ')

  return (
    <motion.h1
      style={{ ...style, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.28em' }}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ display: 'inline-block' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.h1>
  )
}
