import { AlertTriangle, XCircle } from 'lucide-react'
import { PublicGhostButton } from './PublicButtons'

export function PaymentFailedState({
  expired,
  label,
  retryError,
  retrying,
  onRetry,
}: {
  expired: boolean
  label: string
  retryError: string | null
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 pt-10 text-center">
      {expired ? <AlertTriangle size={32} className="text-amber-500" /> : <XCircle size={32} className="text-red-600" />}
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-sm text-ink-soft">Aucune somme n'a été prélevée. Vous pouvez réessayer le paiement.</p>
      {retryError && <p className="text-sm text-red-600">{retryError}</p>}
      <PublicGhostButton type="button" onClick={onRetry} disabled={retrying} className="w-full">
        {retrying ? 'Redirection…' : 'Réessayer le paiement'}
      </PublicGhostButton>
    </div>
  )
}
