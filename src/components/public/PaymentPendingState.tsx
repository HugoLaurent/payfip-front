import { Loader2 } from 'lucide-react'

export function PaymentPendingState({
  label,
  maxAttemptsReached,
}: {
  label: string
  maxAttemptsReached: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 size={28} className="animate-spin text-aregie-deep" />
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      {maxAttemptsReached && (
        <p className="text-xs text-ink-faint">
          Ça prend plus de temps que prévu — rechargez cette page dans quelques instants.
        </p>
      )}
    </div>
  )
}
