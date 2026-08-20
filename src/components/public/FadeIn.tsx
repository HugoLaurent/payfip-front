import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// Enveloppe d'entrée animée (fondu + léger glissement, en cascade via
// `delay`) — sans style visuel imposé : chaque section reprend le style
// exact de la maquette (fond, rayon, ombre propres à cet élément-là),
// la maquette n'utilisant pas une "carte" générique unique partout.
export function FadeIn({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
