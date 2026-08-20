import type { ReactNode } from 'react'
import { useSquircle } from '@/lib/useSquircle'
import aregieLogo from '@/assets/aregie-logo.png'

// Badge "AREGIE" — vrai logo institutionnel (voir FORGEJO_REPO/AREGIE),
// texte blanc + accent bleu-acier, pensé pour un fond foncé.
// Mobile : reste dans le flux, en bas du contenu défilant (il y a une
// barre d'action fixe en bas de l'écran, pas la peine de la chevaucher).
// Desktop : plus de barre d'action fixe (voir PublicPurchasePage), donc
// ancré en bas à droite de l'écran entier — "toute la page", pas juste le
// contenu.
function AregieBadge() {
  const squircle = useSquircle<HTMLDivElement>(8)
  return (
    <div className="mt-4 flex items-center justify-end gap-1.5 md:fixed md:right-6 md:bottom-5 md:mt-0">
      <p className="text-[10px] font-medium text-ink-faint">Propulsé par</p>
      <div
        ref={squircle.ref}
        style={squircle.style}
        className="flex shrink-0 items-center rounded-lg bg-aregie-deep px-2.5 py-[5px]"
      >
        <img src={aregieLogo} alt="AREGIE" className="h-[10px] w-auto" />
      </div>
    </div>
  )
}

// Coquille commune aux pages publiques — cadre à hauteur fixe (comme le
// cadre téléphone de la maquette) : le contenu défile à l'intérieur, la
// barre d'action (si fournie) reste hors du scroll, toujours au vrai bas
// de l'écran plutôt que "sticky" (qui ne colle qu'une fois qu'il y a
// assez de contenu à faire défiler).
export function PublicShell({
  background = 'bg-white',
  header,
  footer,
  children,
}: {
  background?: string
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={`flex h-svh flex-col ${background}`}
      style={{ fontFamily: 'var(--font-public)' }}
    >
      {header}
      <div className="flex-1 overflow-y-auto px-6 py-1 pb-6">
        {children}
        <AregieBadge />
      </div>
      {footer}
    </div>
  )
}
