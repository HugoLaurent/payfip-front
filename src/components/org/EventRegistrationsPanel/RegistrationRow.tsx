import { Paperclip } from 'lucide-react'
import { DangerButton, PrimaryButton, SecondaryButton, StatusBadge } from '@/components/ui'
import { euros } from '@/lib/format'
import type { RegistrationAgent } from '@/lib/types'
import { STATUS_LABELS, STATUS_TINTS } from './types'

// Une ligne d'inscrit — tout le contenu se serre à gauche (`flex-wrap`
// sans `flex-1`/`justify-between`, rien qui s'étire) au lieu d'écarter
// nom/statut d'un côté et montant/actions de l'autre : un nom court
// laissait sinon un grand vide au milieu de la ligne, quelle que soit la
// largeur de la colonne de détail. Le nom tronque à 200px max ; email et
// référence passent sur une seconde ligne (`w-full` force le retour dans
// le flex-wrap) plutôt que de pousser le reste plus loin encore.
export function RegistrationRow({
  registration: r,
  isSheet,
  resendingId,
  cancellingId,
  onReview,
  onResendReminder,
  onCancelRegistration,
}: {
  registration: RegistrationAgent
  isSheet: boolean
  resendingId: number | null
  cancellingId: number | null
  onReview: (r: RegistrationAgent) => void
  onResendReminder: (r: RegistrationAgent) => void
  onCancelRegistration: (r: RegistrationAgent) => void
}) {
  const docs = r.documents?.filter((d) => d.isCurrent) ?? []
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-2.5 ${isSheet ? '' : 'border-t border-gray-100 first:border-t-0'}`}
    >
      <p className="max-w-[200px] truncate text-sm font-semibold text-gray-900">
        {r.firstName} {r.lastName}
      </p>
      <StatusBadge label={STATUS_LABELS[r.status]} className={`${STATUS_TINTS[r.status]} px-2.5 py-1 text-xs`} />
      <span className="text-sm font-bold text-gray-900">{r.amountCents === 0 ? 'Gratuit' : euros(r.amountCents)}</span>
      {docs.length > 0 && (
        <button
          type="button"
          onClick={() => onReview(r)}
          className="squircle flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-200 hover:text-aregie-deep"
          aria-label={`Voir les ${docs.length} document(s) de ${r.firstName} ${r.lastName}`}
        >
          <Paperclip size={13} />
          {docs.length}
        </button>
      )}
      {r.status === 'awaiting_review' && (
        <PrimaryButton type="button" onClick={() => onReview(r)} className="shrink-0 px-3 py-1.5 text-xs">
          Vérifier
        </PrimaryButton>
      )}
      {(r.status === 'awaiting_payment' || r.status === 'rejected') && (
        <SecondaryButton
          type="button"
          onClick={() => onResendReminder(r)}
          disabled={resendingId === r.id}
          className="shrink-0 px-3 py-1.5 text-xs"
        >
          {resendingId === r.id ? '…' : 'Relancer'}
        </SecondaryButton>
      )}
      {r.status !== 'cancelled' && r.status !== 'expired' && (
        <DangerButton
          type="button"
          onClick={() => onCancelRegistration(r)}
          disabled={cancellingId === r.id}
          className="shrink-0 px-3 py-1.5 text-xs"
        >
          {cancellingId === r.id ? '…' : 'Annuler'}
        </DangerButton>
      )}
      <p className="w-full truncate text-xs text-gray-400">
        {r.email} · {r.registrationReference}
        {r.quantity > 1 ? ` · ${r.quantity} participants` : ''}
      </p>
    </div>
  )
}
