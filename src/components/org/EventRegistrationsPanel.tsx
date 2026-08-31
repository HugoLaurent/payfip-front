import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, Download, Eye, Paperclip, Search, X } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import {
  Card,
  DangerButton,
  EmptyState,
  LoadError,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
  Textarea,
} from '@/components/ui'
import type { AuthState, EventAgent, PageMeta, RegistrationAgent, RegistrationDocumentSummary } from '@/lib/types'

const STATUS_LABELS: Record<RegistrationAgent['status'], string> = {
  waitlisted: "Liste d'attente",
  awaiting_review: 'À vérifier',
  rejected: 'Rejeté',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

const STATUS_TINTS: Record<RegistrationAgent['status'], string> = {
  waitlisted: 'bg-blue-50 text-blue-700',
  awaiting_review: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  awaiting_payment: 'bg-orange-50 text-orange-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
}

// Résumé des inscrits d'un évènement (statut, contact, état de la revue
// documentaire) — panneau large plutôt que le Modal partagé (max-w-md,
// trop étroit pour une liste tabulaire avec pièces jointes).
export function EventRegistrationsPanel({
  auth,
  event,
  onClose,
}: {
  auth: AuthState
  event: EventAgent
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [reviewing, setReviewing] = useState<RegistrationAgent | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  // Documents cochés "conforme" par l'agent pour l'inscription en cours de
  // revue — état local uniquement, jamais envoyé au serveur : sert juste à
  // empêcher un clic sur "Valider" avant d'avoir vraiment regardé chaque
  // pièce (voir openReview, qui le réinitialise à chaque ouverture).
  const [checkedDocIds, setCheckedDocIds] = useState<Set<number>>(new Set())
  const [previewing, setPreviewing] = useState<{ url: string; mimeType: string; filename: string; label: string } | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)

  const { data, meta, loadFailed, showLoading, reload } = usePaginatedResource<RegistrationAgent, PageMeta>({
    fetcher: () =>
      apiCall<{ data: RegistrationAgent[]; meta: PageMeta }>(
        'GET',
        `/inscription/events/${event.id}/registrations?page=${page}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
        { token: auth.token },
      ),
    deps: [event.id, status, q, page],
  })

  function openReview(r: RegistrationAgent) {
    setReviewing(r)
    setRejectionReason('')
    setCheckedDocIds(new Set())
  }

  function toggleDocChecked(documentId: number) {
    setCheckedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(documentId)) next.delete(documentId)
      else next.add(documentId)
      return next
    })
  }

  async function handleReview(decision: 'approve' | 'reject' | 'request_more_documents' | 'revert') {
    if (!reviewing) return
    if ((decision === 'reject' || decision === 'request_more_documents') && !rejectionReason.trim()) return

    setSubmittingReview(true)
    const result = await apiCall('POST', `/inscription/registrations/${reviewing.id}/review`, {
      token: auth.token,
      body: decision === 'approve' || decision === 'revert' ? { decision } : { decision, rejectionReason: rejectionReason.trim() },
    })
    setSubmittingReview(false)

    if (result.ok) {
      const successLabel =
        decision === 'approve'
          ? 'Justificatifs validés'
          : decision === 'reject'
            ? 'Inscription rejetée'
            : decision === 'revert'
              ? 'Validation annulée'
              : 'Complément demandé'
      showToast('success', successLabel, `${reviewing.firstName} ${reviewing.lastName}`)
      setReviewing(null)
      setRejectionReason('')
      setCheckedDocIds(new Set())
      await reload()
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer la décision.")
    }
  }

  // Relance manuelle (le citoyen a le mail attendu — paiement ou redépôt —
  // mais tarde à agir) : renvoie le même email, sans changer le statut. Le
  // serveur applique un délai anti-spam entre deux relances (429).
  async function handleResendReminder(r: RegistrationAgent) {
    setResendingId(r.id)
    const result = await apiCall('POST', `/inscription/registrations/${r.id}/resend-reminder`, { token: auth.token })
    setResendingId(null)

    if (result.ok) {
      showToast('success', 'Relance envoyée', `${r.firstName} ${r.lastName}`)
    } else if (result.status === 429) {
      showToast('error', 'Trop tôt', 'Une relance a déjà été envoyée récemment pour cette inscription.')
    } else {
      showToast('error', 'Échec', "Impossible d'envoyer la relance.")
    }
  }

  // Aperçu inline (image/PDF) au lieu de forcer un téléchargement pour
  // consulter une pièce — le blob devient une URL d'objet affichée dans une
  // lightbox, qui offre elle-même un vrai téléchargement si besoin.
  async function openPreview(registrationId: number, doc: RegistrationDocumentSummary, label: string) {
    setPreviewLoadingId(doc.id)
    try {
      const res = await fetch(`${GATEWAY_URL}/inscription/registrations/${registrationId}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (!res.ok) throw new Error('preview_failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewing({ url, mimeType: doc.mimeType, filename: doc.filename, label })
    } catch {
      showToast('error', 'Échec', "Impossible d'afficher le document.")
    } finally {
      setPreviewLoadingId(null)
    }
  }

  function closePreview() {
    if (previewing) URL.revokeObjectURL(previewing.url)
    setPreviewing(null)
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="squircle flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              Inscrits — {event.title}
            </h3>
            {meta && (
              <p className="text-xs text-gray-400">
                {meta.total} inscription(s)
                {event.pendingReviewCount > 0 && (
                  <span className="font-semibold text-aregie-coral"> · {event.pendingReviewCount} à vérifier</span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-6 py-3">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <TextInput
              type="text"
              placeholder="Rechercher (nom, email, référence)…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          <SelectInput
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="w-52"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loadFailed && <LoadError onRetry={reload} />}
          {!loadFailed && showLoading && <p className="py-6 text-sm text-gray-500">Chargement…</p>}
          {!loadFailed && data?.length === 0 && <EmptyState label="Aucune inscription pour ce filtre." />}

          <div className="flex flex-col gap-2">
            {data?.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-3 p-0 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {r.email} · {r.registrationReference}
                    {r.quantity > 1 ? ` · ${r.quantity} participants` : ''}
                  </p>
                </div>
                <StatusBadge label={STATUS_LABELS[r.status]} className={STATUS_TINTS[r.status]} />
                <p className="w-20 shrink-0 text-right text-sm font-bold text-gray-900">
                  {r.amountCents === 0 ? 'Gratuit' : euros(r.amountCents)}
                </p>
                {r.documents && r.documents.filter((d) => d.isCurrent).length > 0 && (
                  <button
                    type="button"
                    onClick={() => openReview(r)}
                    className="squircle flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-200 hover:text-aregie-deep"
                    aria-label={`Voir les ${r.documents.filter((d) => d.isCurrent).length} document(s) de ${r.firstName} ${r.lastName}`}
                  >
                    <Paperclip size={13} />
                    {r.documents.filter((d) => d.isCurrent).length}
                  </button>
                )}
                {r.status === 'awaiting_review' && (
                  <PrimaryButton type="button" onClick={() => openReview(r)} className="shrink-0 px-3 py-1.5 text-xs">
                    Vérifier
                  </PrimaryButton>
                )}
                {(r.status === 'awaiting_payment' || r.status === 'rejected') && (
                  <SecondaryButton
                    type="button"
                    onClick={() => handleResendReminder(r)}
                    disabled={resendingId === r.id}
                    className="shrink-0 px-3 py-1.5 text-xs"
                  >
                    {resendingId === r.id ? '…' : 'Relancer'}
                  </SecondaryButton>
                )}
              </Card>
            ))}
          </div>

          {meta && <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />}
        </div>
      </motion.div>

      {reviewing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReviewing(null)}
        >
          <div
            className="squircle w-full max-w-lg rounded-[22px] bg-white p-7 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              {reviewing.firstName} {reviewing.lastName}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {reviewing.email} · {reviewing.registrationReference}
            </p>

            {(() => {
              const currentDocs = reviewing.documents?.filter((d) => d.isCurrent) ?? []
              const isPending = reviewing.status === 'awaiting_review'
              const allDocsChecked = currentDocs.length === 0 || currentDocs.every((d) => checkedDocIds.has(d.id))
              const canRevert =
                reviewing.status === 'awaiting_payment' ||
                (reviewing.status === 'confirmed' && reviewing.paymentMethod === 'free')

              return (
                <>
                  {currentDocs.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <p className="text-[11.5px] font-semibold text-gray-500">
                        Documents déposés
                        {isPending && <span className="ml-1 font-normal text-gray-400">— cochez chaque pièce conforme</span>}
                      </p>
                      <div className="space-y-1.5">
                        {currentDocs.map((d) => {
                          const label = event.documentRequirements?.find((req) => req.key === d.documentKey)?.label
                          const checked = checkedDocIds.has(d.id)
                          return (
                            <div
                              key={d.id}
                              className="squircle flex w-full items-center gap-2.5 rounded-xl border border-gray-200 px-3.5 py-2.5"
                            >
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => toggleDocChecked(d.id)}
                                  aria-pressed={checked}
                                  aria-label={`Marquer ${label ?? d.filename} comme conforme`}
                                  className={`squircle flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                                    checked
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : 'border-gray-300 text-transparent hover:border-gray-400'
                                  }`}
                                >
                                  <Check size={14} strokeWidth={3} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openPreview(reviewing.id, d, label ?? d.filename)}
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
                        Valider les justificatifs déposés, demander un document en plus (les documents déjà envoyés
                        restent valables), ou rejeter — le message est vu tel quel par le citoyen.
                      </p>
                      <label className="mb-1.5 block text-[11.5px] font-semibold text-gray-500">
                        Message pour le citoyen
                        {rejectionReason.trim() === '' && <span className="ml-1 font-normal text-gray-400">(obligatoire sauf pour valider)</span>}
                      </label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ex. Le document fourni est illisible, merci d'en déposer un nouveau."
                        rows={3}
                        className="mb-4"
                      />
                      <div className="flex gap-2">
                        <PrimaryButton
                          type="button"
                          onClick={() => handleReview('approve')}
                          disabled={submittingReview || !allDocsChecked}
                          title={!allDocsChecked ? 'Cochez chaque document comme conforme avant de valider' : undefined}
                          className="flex-1 justify-center"
                        >
                          {submittingReview ? '…' : 'Valider'}
                        </PrimaryButton>
                        <SecondaryButton
                          type="button"
                          onClick={() => handleReview('request_more_documents')}
                          disabled={submittingReview || !rejectionReason.trim()}
                          className="flex-1 justify-center py-2.5"
                        >
                          + de documents
                        </SecondaryButton>
                        <DangerButton
                          type="button"
                          onClick={() => handleReview('reject')}
                          disabled={submittingReview || !rejectionReason.trim()}
                          className="flex-1 justify-center py-2.5"
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
                        Statut : <span className="font-semibold text-gray-700">{STATUS_LABELS[reviewing.status]}</span> —
                        déjà traité.
                      </p>
                      {canRevert && (
                        <SecondaryButton
                          type="button"
                          onClick={() => handleReview('revert')}
                          disabled={submittingReview}
                          className="mt-3 w-full justify-center"
                        >
                          {submittingReview ? '…' : 'Annuler la validation (erreur ?)'}
                        </SecondaryButton>
                      )}
                    </div>
                  )}
                  <SecondaryButton type="button" onClick={() => setReviewing(null)} className="mt-2 w-full justify-center">
                    {isPending ? 'Annuler' : 'Fermer'}
                  </SecondaryButton>
                </>
              )
            })()}
          </div>
        </motion.div>
      )}

      {previewing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={closePreview}
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
                  onClick={closePreview}
                  className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 p-4">
              {previewing.mimeType.startsWith('image/') ? (
                <img
                  src={previewing.url}
                  alt={previewing.filename}
                  className="mx-auto max-h-full max-w-full rounded-lg"
                />
              ) : (
                <iframe
                  src={previewing.url}
                  title={previewing.filename}
                  className="h-[75vh] w-full rounded-lg border-0 bg-white"
                />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>,
    document.body,
  )
}
