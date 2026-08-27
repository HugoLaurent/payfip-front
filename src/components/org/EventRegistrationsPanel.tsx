import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import { DangerButton, EmptyState, LoadError, Pagination, PrimaryButton, SecondaryButton, SelectInput, TextInput, Textarea } from '@/components/ui'
import type { AuthState, EventAgent, PageMeta, RegistrationAgent } from '@/lib/types'

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

  const { data, meta, loadFailed, showLoading, reload } = usePaginatedResource<RegistrationAgent, PageMeta>({
    fetcher: () =>
      apiCall<{ data: RegistrationAgent[]; meta: PageMeta }>(
        'GET',
        `/inscription/events/${event.id}/registrations?page=${page}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
        { token: auth.token },
      ),
    deps: [event.id, status, q, page],
  })

  async function handleReview(decision: 'approve' | 'reject') {
    if (!reviewing) return
    if (decision === 'reject' && !rejectionReason.trim()) return

    setSubmittingReview(true)
    const result = await apiCall('POST', `/inscription/registrations/${reviewing.id}/review`, {
      token: auth.token,
      body: decision === 'reject' ? { decision, rejectionReason: rejectionReason.trim() } : { decision },
    })
    setSubmittingReview(false)

    if (result.ok) {
      showToast('success', decision === 'approve' ? 'Justificatifs validés' : 'Inscription rejetée', `${reviewing.firstName} ${reviewing.lastName}`)
      setReviewing(null)
      setRejectionReason('')
      await reload()
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer la décision.")
    }
  }

  function downloadDocument(registrationId: number, documentId: number, filename: string) {
    fetch(`${GATEWAY_URL}/inscription/registrations/${registrationId}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('download_failed'))))
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => showToast('error', 'Échec', 'Impossible de télécharger le document.'))
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
            {meta && <p className="text-xs text-gray-400">{meta.total} inscription(s)</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-gray-100 px-6 py-3">
          <TextInput
            type="text"
            placeholder="Rechercher (nom, email, référence)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className="flex-1"
          />
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

          <div className="divide-y divide-gray-100">
            {data?.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {r.email} · {r.registrationReference}
                    {r.quantity > 1 ? ` · ${r.quantity} participants` : ''}
                  </p>
                </div>
                <span className={`squircle shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_TINTS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
                <p className="w-20 shrink-0 text-right text-sm font-bold text-gray-900">
                  {r.amountCents === 0 ? 'Gratuit' : euros(r.amountCents)}
                </p>
                {r.documents && r.documents.length > 0 && (
                  <div className="flex shrink-0 gap-1">
                    {r.documents
                      .filter((d) => d.isCurrent)
                      .map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => downloadDocument(r.id, d.id, d.filename)}
                          className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-aregie-deep"
                          aria-label={`Télécharger ${d.filename}`}
                          title={d.filename}
                        >
                          <Download size={14} />
                        </button>
                      ))}
                  </div>
                )}
                {r.status === 'awaiting_review' && (
                  <PrimaryButton type="button" onClick={() => setReviewing(r)} className="shrink-0 px-3 py-1.5 text-xs">
                    Vérifier
                  </PrimaryButton>
                )}
              </div>
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
            className="squircle w-full max-w-md rounded-[20px] bg-white p-6 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              {reviewing.firstName} {reviewing.lastName}
            </h3>
            <p className="mb-3 text-sm text-gray-500">
              Valider les justificatifs déposés, ou rejeter avec un motif — le citoyen le verra tel quel.
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motif du rejet (obligatoire si vous rejetez)"
              rows={3}
              className="mb-3"
            />
            <div className="flex gap-2">
              <PrimaryButton
                type="button"
                onClick={() => handleReview('approve')}
                disabled={submittingReview}
                className="flex-1 justify-center"
              >
                {submittingReview ? '…' : 'Valider'}
              </PrimaryButton>
              <DangerButton
                type="button"
                onClick={() => handleReview('reject')}
                disabled={submittingReview || !rejectionReason.trim()}
                className="flex-1 justify-center py-2.5"
              >
                Rejeter
              </DangerButton>
            </div>
            <SecondaryButton type="button" onClick={() => setReviewing(null)} className="mt-2 w-full justify-center">
              Annuler
            </SecondaryButton>
          </div>
        </motion.div>
      )}
    </motion.div>,
    document.body,
  )
}
