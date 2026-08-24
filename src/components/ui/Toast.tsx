import { Check, X } from 'lucide-react'
import type { ToastVariant } from '@/lib/toastContext'

export function ToastCard({
  variant,
  title,
  message,
  onDismiss,
}: {
  variant: ToastVariant
  title: string
  message: string
  onDismiss: () => void
}) {
  const isSuccess = variant === 'success'

  return (
    <div
      role="status"
      style={{ fontFamily: 'var(--font-public)' }}
      className={`squircle flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-[0_12px_28px_-10px_rgba(20,25,60,0.45)] ${
        isSuccess ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
        {isSuccess ? <Check size={14} /> : <X size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </p>
        <p className="text-xs opacity-90">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-white/70 transition hover:text-white"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  )
}
