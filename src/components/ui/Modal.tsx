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
      style={{ fontFamily: 'var(--font-public)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="squircle max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white p-6 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
