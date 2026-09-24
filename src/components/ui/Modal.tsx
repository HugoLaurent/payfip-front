import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Échap pour fermer, Tab/Shift+Tab piégés dans le modal (focus trap), et
  // le focus revient à l'élément qui avait le focus avant l'ouverture —
  // sans ça, un clavier ou lecteur d'écran perd le contexte dès qu'un
  // Modal s'ouvre par-dessus la page.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? dialogRef.current)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="squircle max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white p-6 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
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
