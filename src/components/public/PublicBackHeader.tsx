import { ArrowLeft } from 'lucide-react'
import { useSquircle } from '@/lib/useSquircle'

// En-tête "retour" — écran email de la maquette (pas de bandeau de
// marque, juste une flèche retour + le titre de l'étape).
export function PublicBackHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  const squircle = useSquircle<HTMLButtonElement>(10)
  return (
    <div className="flex items-center gap-3 px-6 pt-[14px] pb-3">
      <button
        type="button"
        onClick={onBack}
        ref={squircle.ref}
        style={squircle.style}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.01_260)] text-[oklch(0.3_0.02_260)]"
      >
        <ArrowLeft size={16} strokeWidth={2.5} />
      </button>
      <p
        className="text-base leading-[1.2] font-bold text-ink"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </p>
    </div>
  )
}
