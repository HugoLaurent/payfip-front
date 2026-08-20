import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  /** Décalage (s) avant le départ de l'animation d'entrée — utile pour faire
   * arriver plusieurs Card en cascade plutôt que toutes en même temps que
   * la transition de page (sinon les deux se confondent et l'entrée de la
   * Card devient imperceptible). */
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay }}
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}
    >
      {children}
    </motion.div>
  )
}
