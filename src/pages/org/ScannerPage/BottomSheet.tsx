import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import type { ReactNode } from 'react'

// Panneau escamotable posé sur le viseur, jamais un portail vers
// document.body : il doit rester dans le cadre du scanner (mobile plein
// écran ou colonne desktop), pas recouvrir toute la page.
export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = '88%',
}: {
  open: boolean
  onClose?: () => void
  children: ReactNode
  maxHeight?: string
}) {
  // Glisser vers le bas depuis la poignée seulement (pas depuis le
  // contenu, qui a son propre scroll interne) : dragControls + un
  // déclenchement manuel au toucher de la poignée, pattern standard
  // framer-motion pour un panneau qu'on ne peut saisir que par une zone
  // dédiée. dragConstraints à 0 des deux côtés + elasticity 1 en bas
  // seulement laisse suivre le doigt vers le bas sans jamais pouvoir
  // remonter au-delà de sa position ouverte.
  const dragControls = useDragControls()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-30 flex flex-col justify-end overscroll-contain bg-black/55"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose?.()
            }}
            className="flex flex-col gap-3.5 overscroll-contain rounded-t-[28px] bg-white px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]"
            style={{ maxHeight }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex shrink-0 cursor-grab touch-none justify-center py-1.5 active:cursor-grabbing"
            >
              <div className="h-[5px] w-11 rounded-full bg-gray-200" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default BottomSheet
