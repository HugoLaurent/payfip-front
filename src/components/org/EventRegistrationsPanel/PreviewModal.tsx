import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import type { PreviewingDoc } from './types'

// Lightbox d'aperçu inline (image/PDF) d'une pièce jointe — ouverte
// depuis ReviewPanel.tsx, un vrai téléchargement reste disponible ici.
export function PreviewModal({ previewing, onClose }: { previewing: PreviewingDoc; onClose: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="squircle flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_60px_-20px_rgba(20,25,60,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{previewing.label}</p>
            <p className="truncate text-xs text-gray-400">{previewing.filename}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={previewing.url}
              download={previewing.filename}
              className="squircle flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
            >
              <Download size={13} />
              Télécharger
            </a>
            <button
              type="button"
              onClick={onClose}
              className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 p-4">
          {previewing.mimeType.startsWith('image/') ? (
            <img src={previewing.url} alt={previewing.filename} className="mx-auto max-h-full max-w-full rounded-lg" />
          ) : (
            <iframe src={previewing.url} title={previewing.filename} className="h-[75vh] w-full rounded-lg border-0 bg-white" />
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
