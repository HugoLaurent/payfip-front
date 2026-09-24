import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, Eye } from 'lucide-react'
import { DangerButton, PrimaryButton, SecondaryButton, Textarea } from '@/components/ui'
import type { DocumentRequirement, RegistrationAgent, RegistrationDocumentSummary } from '@/lib/types'
import { STATUS_LABELS } from './types'

type Decision = 'approve' | 'reject' | 'request_more_documents' | 'revert'

// Fiche de revue d'un inscrit — checklist des pièces déposées (cochage
// obligatoire avant validation) puis décision (valider/compléter/rejeter),
// ou juste le statut si déjà traité. Deux habillages : tiroir bas mobile
// (isSheet, actions atteignables au pouce) ou modale centrée desktop.
export function ReviewPanel({
  reviewing,
  isSheet,
  documentRequirements,
  checkedDocIds,
  onToggleDocChecked,
  previewLoadingId,
  onOpenPreview,
  rejectionReason,
  onChangeRejectionReason,
  submittingReview,
  onDecision,
  onClose,
}: {
  reviewing: RegistrationAgent
  isSheet: boolean
  documentRequirements: DocumentRequirement[] | null
  checkedDocIds: Set<number>
  onToggleDocChecked: (documentId: number) => void
  previewLoadingId: number | null
  onOpenPreview: (registrationId: number, doc: RegistrationDocumentSummary, label: string) => void
  rejectionReason: string
  onChangeRejectionReason: (value: string) => void
  submittingReview: boolean
  onDecision: (decision: Decision) => void
  onClose: () => void
}) {
  const currentDocs = reviewing.documents?.filter((d) => d.isCurrent) ?? []
  const isPending = reviewing.status === 'awaiting_review'
  const allDocsChecked = currentDocs.length === 0 || currentDocs.every((d) => checkedDocIds.has(d.id))
  const canRevert =
    reviewing.status === 'awaiting_payment' || (reviewing.status === 'confirmed' && reviewing.paymentMethod === 'free')

  const body = (
    <>
      <div className="flex items-center gap-3">
        <div className="squircle flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aregie-tint/20 text-sm font-bold text-aregie-deep">
          {reviewing.firstName[0]?.toUpperCase()}
          {reviewing.lastName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            {reviewing.firstName} {reviewing.lastName}
          </h3>
          <p className="truncate text-xs text-gray-400">
            {reviewing.email} · {reviewing.registrationReference}
          </p>
        </div>
      </div>

      {currentDocs.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11.5px] font-semibold text-gray-500">
            Documents déposés
            {isPending && <span className="ml-1 font-normal text-gray-400">— cochez chaque pièce conforme</span>}
          </p>
          <div className="space-y-1.5">
            {currentDocs.map((d) => {
              const label = documentRequirements?.find((req) => req.key === d.documentKey)?.label
              const checked = checkedDocIds.has(d.id)
              return (
                <div key={d.id} className="squircle flex w-full items-center gap-2.5 rounded-xl border border-gray-200 px-3.5 py-2.5">
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => onToggleDocChecked(d.id)}
                      aria-pressed={checked}
                      aria-label={`Marquer ${label ?? d.filename} comme conforme`}
                      className={`squircle flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                        checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-gray-400'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenPreview(reviewing.id, d, label ?? d.filename)}
                    disabled={previewLoadingId === d.id}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left transition disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{label ?? d.filename}</p>
                      {label && <p className="truncate text-xs text-gray-400">{d.filename}</p>}
                    </div>
                    {previewLoadingId === d.id ? (
                      <span className="shrink-0 text-xs text-gray-400">…</span>
                    ) : (
                      <Eye size={15} className="shrink-0 text-gray-400" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isPending ? (
        <>
          <p className="mt-5 mb-3 text-sm text-gray-500">
            Valider les justificatifs déposés, demander un document en plus (les documents déjà envoyés restent
            valables), ou rejeter — le message est vu tel quel par le citoyen.
          </p>
          <label className="mb-1.5 block text-[11.5px] font-semibold text-gray-500">
            Message pour le citoyen
            {rejectionReason.trim() === '' && <span className="ml-1 font-normal text-gray-400">(obligatoire sauf pour valider)</span>}
          </label>
          <Textarea
            value={rejectionReason}
            onChange={(e) => onChangeRejectionReason(e.target.value)}
            placeholder="Ex. Le document fourni est illisible, merci d'en déposer un nouveau."
            rows={3}
            className="mb-4"
          />
          <div className={isSheet ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
            <PrimaryButton
              type="button"
              onClick={() => onDecision('approve')}
              disabled={submittingReview || !allDocsChecked}
              title={!allDocsChecked ? 'Cochez chaque document comme conforme avant de valider' : undefined}
              className={isSheet ? 'col-span-2 justify-center' : 'flex-1 justify-center'}
            >
              {submittingReview ? '…' : 'Valider les justificatifs'}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => onDecision('request_more_documents')}
              disabled={submittingReview || !rejectionReason.trim()}
              className={isSheet ? 'justify-center py-2.5' : 'flex-1 justify-center py-2.5'}
            >
              + de documents
            </SecondaryButton>
            <DangerButton
              type="button"
              onClick={() => onDecision('reject')}
              disabled={submittingReview || !rejectionReason.trim()}
              className={isSheet ? 'justify-center py-2.5' : 'flex-1 justify-center py-2.5'}
            >
              Rejeter
            </DangerButton>
          </div>
          {currentDocs.length > 0 && !allDocsChecked && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Cochez les {currentDocs.length} document(s) comme conformes pour activer la validation.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 mb-3">
          <p className="text-sm text-gray-500">
            Statut : <span className="font-semibold text-gray-700">{STATUS_LABELS[reviewing.status]}</span> — déjà traité.
          </p>
          {canRevert && (
            <SecondaryButton type="button" onClick={() => onDecision('revert')} disabled={submittingReview} className="mt-3 w-full justify-center">
              {submittingReview ? '…' : 'Annuler la validation (erreur ?)'}
            </SecondaryButton>
          )}
        </div>
      )}
      <SecondaryButton type="button" onClick={onClose} className="mt-2 w-full justify-center">
        {isPending ? 'Annuler' : 'Fermer'}
      </SecondaryButton>
    </>
  )

  if (isSheet) {
    // Fiche inscrit en tiroir bas plutôt qu'en modale centrée : les
    // actions (valider/rejeter) restent atteignables au pouce en bas
    // d'écran, comme le reste du parcours mobile de cet écran.
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed inset-0 z-[60] flex items-end bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="squircle max-h-[88vh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-20px_rgba(20,25,60,0.4)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
          {body}
        </motion.div>
      </motion.div>,
      document.body,
    )
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="squircle w-full max-w-lg rounded-[22px] bg-white p-7 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </motion.div>,
    document.body,
  )
}
