import { SecondaryButton } from './Buttons'

/** À afficher à la place de "Chargement…" quand un appel a échoué — jamais laisser un écran bloqué sans issue. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="squircle flex flex-col items-center gap-3 rounded-2xl border border-dashed border-red-200 bg-red-50/50 py-8 text-center">
      <p className="text-sm text-red-600">Échec du chargement.</p>
      <SecondaryButton type="button" onClick={onRetry}>
        Réessayer
      </SecondaryButton>
    </div>
  )
}
