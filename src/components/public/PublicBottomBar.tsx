import type { ReactNode } from 'react'

// Barre d'action du bas — plein largeur, non arrondie, ombre projetée
// vers le haut uniquement (maquette : padding:14px 24px 22px,
// box-shadow:0 -8px 24px -12px rgba(20,25,60,.15)). Toujours hors de la
// zone de scroll (voir `footer` sur PublicShell), jamais une carte
// flottante.
export function PublicBottomBar({
  count,
  totalLabel,
  children,
}: {
  count: number
  totalLabel: string
  children: ReactNode
}) {
  return (
    <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)]">
      <div className="flex items-center gap-3.5 md:mx-auto md:max-w-md">
        <div className="flex-1">
          <p className="text-[11.5px] leading-[1.3] font-medium text-ink-soft">
            {count} billet{count > 1 ? 's' : ''}
          </p>
          <p
            className="text-[20px] leading-[1.2] font-extrabold text-ink"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {totalLabel}
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
