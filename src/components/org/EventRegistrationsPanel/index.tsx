import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Search, X } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useToast } from '@/lib/useToast'
import { EmptyState, LoadError, Pagination, SelectInput, TextInput } from '@/components/ui'
import type { AuthState, EventAgent, PageMeta, RegistrationAgent, RegistrationDocumentSummary } from '@/lib/types'
import { RegistrationRow } from './RegistrationRow'
import { ReviewPanel } from './ReviewPanel'
import { PreviewModal } from './PreviewModal'
import { STATUS_LABELS, type PreviewingDoc } from './types'

type Variant = 'panel' | 'sheet'

// Résumé des inscrits d'un évènement (statut, contact, état de la revue
// documentaire). Deux habillages pour le même contenu/logique : `panel`
// s'intègre en colonne de détail du maître-détail desktop (EventsManager,
// pas de portail — reste dans le flux normal de la grille), `sheet` devient
// un écran mobile plein écran par-dessus tout (portail vers document.body,
// comme Modal.tsx, pour échapper au containing block que crée l'animation
// d'entrée de page dans OrgSpace dès qu'un ancêtre porte un `transform`).
export function EventRegistrationsPanel({
  auth,
  event,
  variant,
  onClose,
  onRegistrationsChanged,
}: {
  auth: AuthState
  event: EventAgent
  variant: Variant
  onClose: () => void
  // Prévient EventsManager qu'un compteur affiché sur la carte évènement
  // (pendingReviewCount, registeredCount) a pu changer, pour qu'il
  // recharge sa liste — sinon ces compteurs restent périmés jusqu'à ce
  // que l'agent quitte et rouvre le panneau.
  onRegistrationsChanged?: () => void
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
  const [previewing, setPreviewing] = useState<PreviewingDoc | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const { data, meta, loadFailed, showLoading, reload } = usePaginatedResource<RegistrationAgent, PageMeta>({
    fetcher: () =>
      apiCall<{ data: RegistrationAgent[]; meta: PageMeta }>(
        'GET',
        `/inscription/events/${event.id}/registrations?page=${page}&serviceId=${event.serviceId}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
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
    const result = await apiCall('POST', `/inscription/registrations/${reviewing.id}/review?serviceId=${event.serviceId}`, {
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
      onRegistrationsChanged?.()
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer la décision.")
    }
  }

  // Relance manuelle (le citoyen a le mail attendu — paiement ou redépôt —
  // mais tarde à agir) : renvoie le même email, sans changer le statut. Le
  // serveur applique un délai anti-spam entre deux relances (429).
  async function handleResendReminder(r: RegistrationAgent) {
    setResendingId(r.id)
    const result = await apiCall('POST', `/inscription/registrations/${r.id}/resend-reminder?serviceId=${event.serviceId}`, { token: auth.token })
    setResendingId(null)

    if (result.ok) {
      showToast('success', 'Relance envoyée', `${r.firstName} ${r.lastName}`)
    } else if (result.status === 429) {
      showToast('error', 'Trop tôt', 'Une relance a déjà été envoyée récemment pour cette inscription.')
    } else {
      showToast('error', 'Échec', "Impossible d'envoyer la relance.")
    }
  }

  // Annulation côté agent (l'inscrit a demandé par un autre canal, ou
  // no-show à retirer) — même endpoint que l'auto-annulation citoyen, pas
  // de vérification de délai côté agent. Aucun email envoyé au citoyen.
  async function handleCancelRegistration(r: RegistrationAgent) {
    if (!window.confirm(`Annuler l'inscription de ${r.firstName} ${r.lastName} ? Cette action est irréversible.`)) {
      return
    }
    setCancellingId(r.id)
    const result = await apiCall('POST', `/inscription/registrations/${r.id}/cancel?serviceId=${event.serviceId}`, { token: auth.token })
    setCancellingId(null)

    if (result.ok) {
      showToast('success', 'Inscription annulée', `${r.firstName} ${r.lastName}`)
      await reload()
      onRegistrationsChanged?.()
    } else {
      showToast('error', 'Échec', "Impossible d'annuler l'inscription.")
    }
  }

  // Aperçu inline (image/PDF) au lieu de forcer un téléchargement pour
  // consulter une pièce — le blob devient une URL d'objet affichée dans une
  // lightbox, qui offre elle-même un vrai téléchargement si besoin.
  async function openPreview(registrationId: number, doc: RegistrationDocumentSummary, label: string) {
    setPreviewLoadingId(doc.id)
    try {
      const res = await fetch(`${GATEWAY_URL}/inscription/registrations/${registrationId}/documents/${doc.id}?serviceId=${event.serviceId}`, {
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

  // Filet de sécurité si le panneau est démonté (EventsManager change de
  // sélection, ferme le panneau...) pendant qu'un aperçu est ouvert —
  // closePreview() seul ne suffit pas dans ce cas, la blob URL fuirait.
  const previewingRef = useRef(previewing)
  previewingRef.current = previewing
  useEffect(() => {
    return () => {
      if (previewingRef.current) URL.revokeObjectURL(previewingRef.current.url)
    }
  }, [])

  const isSheet = variant === 'sheet'

  const header = (
    <div className={`flex items-center gap-3 border-b border-gray-100 px-4 ${isSheet ? 'py-3' : 'py-4'}`}>
      {isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="squircle -ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
          aria-label="Retour à la liste des évènements"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
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
      {!isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )

  const filters = (
    <div className={`flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3`}>
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          type="text"
          placeholder="Nom, email, référence…"
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
        className={isSheet ? 'w-full' : 'w-52'}
      >
        <option value="">Tous les statuts</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectInput>
    </div>
  )

  const list = (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && showLoading && <p className="py-6 text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && data?.length === 0 && <EmptyState label="Aucune inscription pour ce filtre." />}

      <div className="flex flex-col">
        {data?.map((r) => (
          <RegistrationRow
            key={r.id}
            registration={r}
            isSheet={isSheet}
            resendingId={resendingId}
            cancellingId={cancellingId}
            onReview={openReview}
            onResendReminder={handleResendReminder}
            onCancelRegistration={handleCancelRegistration}
          />
        ))}
      </div>

      {meta && <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />}
    </div>
  )

  const content = (
    <div className={isSheet ? 'flex h-full flex-col' : 'flex h-full min-h-0 flex-col'}>
      {header}
      {filters}
      {list}
    </div>
  )

  return (
    <>
      {isSheet ? (
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden" style={{ fontFamily: 'var(--font-public)' }}>
            {content}
          </div>,
          document.body,
        )
      ) : (
        content
      )}

      {reviewing && (
        <ReviewPanel
          reviewing={reviewing}
          isSheet={isSheet}
          documentRequirements={event.documentRequirements}
          checkedDocIds={checkedDocIds}
          onToggleDocChecked={toggleDocChecked}
          previewLoadingId={previewLoadingId}
          onOpenPreview={openPreview}
          rejectionReason={rejectionReason}
          onChangeRejectionReason={setRejectionReason}
          submittingReview={submittingReview}
          onDecision={handleReview}
          onClose={() => setReviewing(null)}
        />
      )}

      {previewing && <PreviewModal previewing={previewing} onClose={closePreview} />}
    </>
  )
}
