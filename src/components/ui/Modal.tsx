import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  // Portail vers document.body : un Modal ouvert depuis un ancêtre animé
  // (Sidebar en tiroir mobile, Card en motion.div…) hérite sinon du
  // containing block que ce parent crée dès qu'il porte un `transform`
  // CSS — le modal se retrouve piégé dans sa boîte au lieu d'être centré
  // sur toute la page.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-aregie-deep">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
